import "server-only";

import {
  appendOrderEvent,
  findRefundByStripeRefundId,
  getOrderById,
  getOrderPortalSummaryByOrderId,
  incrementOrderRefundedCents,
  setOrderStatus,
  updateRefundStatus,
  type RefundRow,
} from "@littlecolorbook/db";
import { getStripe, isStripeConfigured } from "./stripe";
import { cancelLuluPrintJob } from "./lulu";
import { captureServerEvent } from "./posthog-server";

function mapStripeRefundStatus(status: string | null | undefined): "processing" | "succeeded" | "failed" | "voided" {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "pending":
      return "processing";
    case "canceled":
      return "voided";
    case "failed":
      return "failed";
    default:
      return "processing";
  }
}

/**
 * Execute a refund request via Stripe. Idempotent by virtue of the
 * refund row being created first and its id used as the Stripe
 * idempotency key. Updates our refund row with the Stripe response
 * and (on success) increments orders.refunded_cents.
 */
export async function executeRefund(input: {
  refund: RefundRow;
  approvedByEmail: string;
  cancelLulu?: boolean;
}): Promise<{ ok: boolean; status: RefundRow["status"]; message?: string }> {
  const refund = input.refund;

  if (!isStripeConfigured()) {
    return { ok: false, status: "failed", message: "stripe_not_configured" };
  }

  const order = await getOrderById(refund.orderId);
  if (!order) return { ok: false, status: "failed", message: "order_not_found" };
  if (!order.stripePaymentIntentId) {
    return { ok: false, status: "failed", message: "no_payment_intent_on_order" };
  }

  // Flip to processing first so admin UI shows the attempt.
  await updateRefundStatus({
    id: refund.id,
    status: "processing",
    approvedByEmail: input.approvedByEmail,
  });

  // Attempt Lulu cancel before the Stripe refund so we don't refund
  // money and then fail to cancel production. If Lulu cancel fails, we
  // still proceed — the tier computer is responsible for not promising
  // a cancel we can't deliver.
  if (input.cancelLulu && order.luluPrintJobId) {
    const cancel = await cancelLuluPrintJob(order.luluPrintJobId);
    await appendOrderEvent(order.id, "refund.lulu_cancel", {
      refundId: refund.id,
      ok: cancel.ok,
      status: cancel.status ?? null,
      error: cancel.error ?? null,
    }).catch(() => null);
  }

  try {
    const stripe = getStripe();
    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: refund.amountCents,
        reason: refund.reason === "fraud" ? "fraudulent" : "requested_by_customer",
        metadata: {
          refund_id: refund.id,
          order_id: order.id,
          policy_tier: refund.policyTier,
        },
      },
      { idempotencyKey: refund.id },
    );

    const mapped = mapStripeRefundStatus(stripeRefund.status ?? null);
    await updateRefundStatus({
      id: refund.id,
      status: mapped,
      stripeRefundId: stripeRefund.id,
      refundedCents: stripeRefund.amount ?? refund.amountCents,
      stripeError: null,
    });

    if (mapped === "succeeded") {
      await incrementOrderRefundedCents({
        orderId: order.id,
        addCents: stripeRefund.amount ?? refund.amountCents,
      });
      await appendOrderEvent(order.id, "refund.succeeded", {
        refundId: refund.id,
        stripeRefundId: stripeRefund.id,
        amountCents: stripeRefund.amount ?? refund.amountCents,
        policyTier: refund.policyTier,
      });
      if (order.customerId) {
        captureServerEvent({
          event: "refund_succeeded",
          distinctId: order.customerId,
          properties: {
            orderId: order.id,
            refundId: refund.id,
            amountCents: stripeRefund.amount ?? refund.amountCents,
            policyTier: refund.policyTier,
            reason: refund.reason,
          },
        });
      }
      // Move order status into a refund-aware terminal state.
      const summary = await getOrderPortalSummaryByOrderId(order.id);
      const shouldCancel =
        summary &&
        !["shipped", "delivered", "refunded"].includes(summary.order.status);
      if (shouldCancel) {
        await setOrderStatus(order.id, "refunded", "refund.order_refunded", {
          refundId: refund.id,
        });
      } else if (summary && summary.order.status !== "refunded") {
        // For shipped/delivered orders we still mark refunded for
        // accounting purposes.
        await setOrderStatus(order.id, "refunded", "refund.order_refunded_post_ship", {
          refundId: refund.id,
        });
      }
    }

    return { ok: mapped === "succeeded" || mapped === "processing", status: mapped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "stripe_refund_failed";
    await updateRefundStatus({
      id: refund.id,
      status: "failed",
      stripeError: { message },
    });
    await appendOrderEvent(order.id, "refund.failed", {
      refundId: refund.id,
      error: message,
    }).catch(() => null);
    return { ok: false, status: "failed", message };
  }
}

/**
 * Reconcile a Stripe-side refund state change (webhook) back to our
 * refund row.
 */
export async function reconcileStripeRefund(input: {
  stripeRefundId: string;
  status: string | null;
  amount: number | null;
  failureReason?: string | null;
}) {
  const row = await findRefundByStripeRefundId(input.stripeRefundId);
  if (!row) return { handled: false, reason: "no_row_for_stripe_refund" };

  const mapped = mapStripeRefundStatus(input.status);
  const patch: Parameters<typeof updateRefundStatus>[0] = {
    id: row.id,
    status: mapped,
  };
  if (input.amount !== null) patch.refundedCents = input.amount;
  if (input.failureReason) patch.stripeError = { message: input.failureReason };
  await updateRefundStatus(patch);

  if (mapped === "succeeded" && row.status !== "succeeded" && input.amount) {
    await incrementOrderRefundedCents({ orderId: row.orderId, addCents: input.amount });
  }

  return { handled: true, refundId: row.id, status: mapped };
}
