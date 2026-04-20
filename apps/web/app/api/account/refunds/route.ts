import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createRefundRequest,
  getLuluProductionCostForOrder,
  getOrderForCustomer,
  listRefundsForOrder,
  openTicket,
  refundReasonValues,
} from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../lib/auth";
import { computeRefundTier } from "../../../../lib/refund-tier";
import { executeRefund } from "../../../../lib/refund-executor";

const schema = z.object({
  orderId: z.string().trim().min(1),
  reason: z.enum(refundReasonValues),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const summary = await getOrderForCustomer({
    orderId: parsed.data.orderId,
    customerId: session.customerId,
  });
  if (!summary) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const [existingRefunds, luluProductionCostCents] = await Promise.all([
    listRefundsForOrder(summary.order.id),
    getLuluProductionCostForOrder(summary.order.id),
  ]);
  const alreadyRefundedCents = existingRefunds
    .filter((r) => r.status === "succeeded" || r.status === "processing")
    .reduce((acc, r) => acc + (r.refundedCents ?? r.amountCents), 0);

  const decision = computeRefundTier({
    summary,
    reason: parsed.data.reason,
    alreadyRefundedCents,
    luluProductionCostCents,
  });

  // Always open a ticket for the refund so admin + customer have a
  // conversation surface. Auto-approved refunds also get a ticket so
  // nothing falls off the radar.
  const ticket = await openTicket({
    customerId: session.customerId,
    orderId: summary.order.id,
    category: "refund_request",
    subject: `Refund request: ${summary.order.id}`,
    body: parsed.data.notes
      ? `Reason: ${parsed.data.reason}\n\n${parsed.data.notes}`
      : `Reason: ${parsed.data.reason}`,
    customerEmail: session.email,
    metadata: { policy_tier: decision.tier, reason: parsed.data.reason },
  });

  const refund = await createRefundRequest({
    orderId: summary.order.id,
    ticketId: ticket?.ticket.id ?? null,
    reason: parsed.data.reason,
    amountCents: decision.amountCents,
    policyTier: decision.tier,
    requestedByEmail: session.email,
    notes: parsed.data.notes ?? null,
    metadata: {
      cancelLulu: decision.cancelLulu,
      replacementOnly: decision.replacementOnly ?? false,
    },
    initialStatus: decision.autoApprove ? "approved" : "requested",
  });

  if (!refund) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let executed: Awaited<ReturnType<typeof executeRefund>> | null = null;
  if (decision.autoApprove && decision.amountCents > 0 && !decision.replacementOnly) {
    executed = await executeRefund({
      refund,
      approvedByEmail: "auto@policy",
      cancelLulu: decision.cancelLulu,
    });
  }

  return NextResponse.json({
    ok: true,
    refundId: refund.id,
    ticketId: ticket?.ticket.id ?? null,
    tier: decision.tier,
    amountCents: decision.amountCents,
    autoApproved: decision.autoApprove,
    summary: decision.customerFacingSummary,
    executed: executed ?? null,
  });
}
