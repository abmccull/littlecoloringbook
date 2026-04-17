import { NextRequest, NextResponse } from "next/server";
import { recordSupportAction, setOrderStatus } from "@littlecolorbook/db";
import { z } from "zod";
import { requireAdminApiSession } from "../../../../../../lib/auth";

const resubmitSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const session = await requireAdminApiSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = resubmitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resubmission request", issues: parsed.error.flatten() }, { status: 400 });
  }

  await recordSupportAction({
    orderId,
    actionType: "resubmit_lulu",
    notes: parsed.data.reason ?? null,
    createdBy: session?.email ?? null,
  });
  await setOrderStatus(orderId, "awaiting_print_submission", "support.lulu_resubmission_requested", {
    reason: parsed.data.reason ?? null,
    createdBy: session?.email ?? null,
  });

  return NextResponse.json({ ok: true, orderId, status: "awaiting_print_submission" });
}
