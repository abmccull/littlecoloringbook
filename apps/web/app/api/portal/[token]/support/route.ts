import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderPortalSummary, recordSupportAction, setOrderStatus } from "@littlecolorbook/db";

const supportSchema = z.object({
  message: z.string().trim().min(10).max(1000),
});

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = supportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await recordSupportAction({
    orderId: summary.order.id,
    actionType: "mark_support_required",
    notes: parsed.data.message,
    createdBy: summary.customer?.email ?? null,
  });
  await setOrderStatus(summary.order.id, "support_required", "support.customer_requested", {
    requesterEmail: summary.customer?.email ?? null,
    note: parsed.data.message,
  });

  return NextResponse.json({ ok: true, orderId: summary.order.id, status: "support_required" });
}
