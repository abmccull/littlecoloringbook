import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getOrderById,
  getOrderByStripeCheckoutSessionId,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
  markOrderCheckoutExpired,
  markOrderPaidFromCheckout,
  markStripeWebhookProcessed,
  recordStripeWebhookReceipt,
} from "@littlecolorbook/db";
import {
  getStripe,
  getStripeWebhookSecret,
  getVerifiedStripeAccountId,
  isStripeConfigured,
} from "../../../../lib/stripe";
import { deliverLifecycleEmail } from "../../../../lib/lifecycle-email";
import { ensureCustomerAccount } from "../../../../lib/customer-account";
import {
  enrollInAbandonment,
  enrollInPostPurchase,
} from "../../../../lib/sequence-enrollment";
import { reconcileStripeRefund } from "../../../../lib/refund-executor";
import { captureServerEvent } from "../../../../lib/posthog-server";

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) {
    return null;
  }
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

async function resolveOrderId(session: Stripe.Checkout.Session) {
  const directOrderId = session.metadata?.orderId ?? session.client_reference_id;
  if (directOrderId) return directOrderId;
  const order = await getOrderByStripeCheckoutSessionId(session.id);
  return order?.id ?? null;
}

function allowDevWebhookStub() {
  // Explicit opt-in; no longer enabled by default in dev. This prevents a
  // misconfigured environment from silently accepting unsigned webhook events.
  return process.env.ALLOW_STRIPE_WEBHOOK_STUB === "true" && process.env.NODE_ENV !== "production";
}

async function handleCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const orderId = await resolveOrderId(session);
  if (!orderId) {
    return { orderId: null, accountStatus: "no_order" as const };
  }

  await markOrderPaidFromCheckout({
    orderId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: getPaymentIntentId(session),
    amountTotalCents: session.amount_total,
    rawEventId: event.id,
  });

  const [orderRow, summary] = await Promise.all([
    getOrderById(orderId),
    getOrderPortalSummaryByOrderId(orderId),
  ]);
  const customerEmail = session.customer_details?.email ?? summary?.customer?.email ?? null;
  const customerId = orderRow?.customerId ?? null;

  let accountStatus: "skipped" | "created" | "linked" | "already_linked" | "error" = "skipped";

  if (customerEmail && customerId) {
    try {
      const result = await ensureCustomerAccount({
        email: customerEmail,
        customerId,
        displayName: session.customer_details?.name ?? summary?.customer?.firstName ?? null,
        source: "post_purchase",
        sendMagicLink: true,
      });
      accountStatus = result.status;
    } catch (error) {
      console.error("stripe webhook: ensureCustomerAccount failed", error);
      accountStatus = "error";
    }
  }

  try {
    await deliverLifecycleEmail({ orderId, template: "order-paid" });
  } catch (error) {
    console.error("Failed to send order-paid email", error);
  }

  // Note: Neon Auth sends its own sign-in email when ensureCustomerAccount
  // triggers sendSignInOtp. We no longer send a separate account-welcome
  // email from Resend here — Neon's email + the existing order-paid email
  // cover the ground without duplicating an inbox hit.

  // Post-purchase sequence enrollment — fires the first "thank you" email
  // 1 day after checkout. For PDF orders this runs before delivery is
  // confirmed, which is the intended behavior (the thank-you email is
  // generic and relevant to both PDF and print).
  if (customerId) {
    try {
      await enrollInPostPurchase({ customerId, orderId });
    } catch (error) {
      console.error("stripe webhook: enrollInPostPurchase failed", error);
    }

    captureServerEvent({
      event: "order_paid",
      distinctId: customerId,
      properties: {
        orderId,
        email: customerEmail,
        totalCents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        accountStatus,
        deliveryMode: orderRow?.deliveryMode ?? null,
        offerCode: orderRow?.selectedOfferCode ?? null,
      },
    });
  }

  return { orderId, accountStatus };
}

export async function POST(request: NextRequest) {
  const payload = await request.text();

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const webhookSecret = getStripeWebhookSecret();

  if (!isStripeConfigured() || !webhookSecret) {
    if (!allowDevWebhookStub()) {
      return NextResponse.json({ error: "Stripe webhook configuration is incomplete." }, { status: 503 });
    }

    return NextResponse.json({
      received: true,
      mode: "dev-stub",
      bytes: payload.length,
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    await getVerifiedStripeAccountId();
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let candidateOrderId: string | null = null;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    try {
      candidateOrderId = await resolveOrderId(event.data.object as Stripe.Checkout.Session);
    } catch {
      candidateOrderId = null;
    }
  }

  const receipt = await recordStripeWebhookReceipt({
    stripeEventId: event.id,
    type: event.type,
    orderId: candidateOrderId,
    payload: event as unknown as Record<string, unknown>,
  });

  if (!receipt.firstSeen) {
    return NextResponse.json({
      received: true,
      mode: "verified",
      eventType: event.type,
      eventId: event.id,
      duplicate: true,
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const result = await handleCheckoutCompleted(event, event.data.object as Stripe.Checkout.Session);
      await markStripeWebhookProcessed({
        stripeEventId: event.id,
        status: "processed",
        orderId: result.orderId,
      });
      return NextResponse.json({
        received: true,
        mode: "verified",
        eventType: event.type,
        eventId: event.id,
        orderId: result.orderId,
        accountStatus: result.accountStatus,
      });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = await resolveOrderId(session);

      if (orderId) {
        await markOrderCheckoutExpired({
          orderId,
          stripeCheckoutSessionId: session.id,
          rawEventId: event.id,
        });

        // Abandonment sequence enrollment — only if we can reach the
        // customer and the session had a real email attached.
        const customerEmail = session.customer_details?.email ?? null;
        if (customerEmail) {
          try {
            const row = await getOrderById(orderId);
            if (row?.customerId) {
              await enrollInAbandonment({
                customerId: row.customerId,
                orderId,
                checkoutResumeUrl: null,
              });
            }
          } catch (error) {
            console.error("stripe webhook: enrollInAbandonment failed", error);
          }
        }
      }

      await markStripeWebhookProcessed({
        stripeEventId: event.id,
        status: "processed",
        orderId,
      });

      return NextResponse.json({
        received: true,
        mode: "verified",
        eventType: event.type,
        eventId: event.id,
        orderId,
      });
    }

    if (event.type === "charge.refunded" || event.type === "refund.updated") {
      const refundObj = (event.type === "refund.updated"
        ? (event.data.object as Stripe.Refund)
        : null) ?? null;
      if (refundObj) {
        await reconcileStripeRefund({
          stripeRefundId: refundObj.id,
          status: refundObj.status ?? null,
          amount: refundObj.amount ?? null,
          failureReason: refundObj.failure_reason ?? null,
        });
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const refundsList = charge.refunds?.data ?? [];
        for (const r of refundsList) {
          await reconcileStripeRefund({
            stripeRefundId: r.id,
            status: r.status ?? null,
            amount: r.amount ?? null,
            failureReason: r.failure_reason ?? null,
          });
        }
      }
      await markStripeWebhookProcessed({
        stripeEventId: event.id,
        status: "processed",
      });
      return NextResponse.json({
        received: true,
        mode: "verified",
        eventType: event.type,
        eventId: event.id,
      });
    }

    await markStripeWebhookProcessed({
      stripeEventId: event.id,
      status: "ignored",
    });

    return NextResponse.json({
      received: true,
      mode: "verified",
      eventType: event.type,
      eventId: event.id,
    });
  } catch (error) {
    await markStripeWebhookProcessed({
      stripeEventId: event.id,
      status: "failed",
    });

    const message = error instanceof Error ? error.message : "Webhook handler failed";
    console.error("Stripe webhook handler error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
