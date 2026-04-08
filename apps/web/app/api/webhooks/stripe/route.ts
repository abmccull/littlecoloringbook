import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getOrderByStripeCheckoutSessionId,
  isDatabaseConfigured,
  markOrderCheckoutExpired,
  markOrderPaidFromCheckout,
} from "@littlecolorbook/db";
import { getStripe, getStripeWebhookSecret, getVerifiedStripeAccountId, isStripeConfigured } from "../../../../lib/stripe";
import { deliverLifecycleEmail } from "../../../../lib/lifecycle-email";
import { dispatchInternalJob } from "../../../../lib/internal-jobs";

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) {
    return null;
  }

  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

async function resolveOrderId(session: Stripe.Checkout.Session) {
  const directOrderId = session.metadata?.orderId ?? session.client_reference_id;

  if (directOrderId) {
    return directOrderId;
  }

  const order = await getOrderByStripeCheckoutSessionId(session.id);
  return order?.id ?? null;
}

function allowDevWebhookStub() {
  return process.env.NODE_ENV !== "production";
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

  try {
    await getVerifiedStripeAccountId();
    const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = await resolveOrderId(session);
      let jobQueued = false;

      if (orderId) {
        await markOrderPaidFromCheckout({
          orderId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: getPaymentIntentId(session),
          amountTotalCents: session.amount_total,
          rawEventId: event.id,
        });
        try {
          await deliverLifecycleEmail({
            orderId,
            template: "order-paid",
          });
        } catch (error) {
          console.error("Failed to send order-paid email", error);
        }

        try {
          await dispatchInternalJob({
            path: "/api/internal/jobs/process-paid-order",
            body: {
              orderId,
            },
          });
          jobQueued = true;
        } catch (error) {
          console.error("Failed to queue paid order processing", error);
        }
      }

      return NextResponse.json({ received: true, mode: "verified", eventType: event.type, eventId: event.id, orderId, jobQueued });
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
      }

      return NextResponse.json({ received: true, mode: "verified", eventType: event.type, eventId: event.id, orderId });
    }

    return NextResponse.json({ received: true, mode: "verified", eventType: event.type, eventId: event.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
