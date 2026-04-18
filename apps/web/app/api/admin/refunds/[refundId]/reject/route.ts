import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRefundById, updateRefundStatus } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";

const schema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ refundId: string }> },
) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { refundId } = await context.params;
  const refund = await getRefundById(refundId);
  if (!refund) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (refund.status === "succeeded" || refund.status === "processing") {
    return NextResponse.json({ error: `Already ${refund.status}` }, { status: 409 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload ?? {});

  await updateRefundStatus({
    id: refund.id,
    status: "voided",
    approvedByEmail: session.email ?? "admin",
    notes: parsed.success ? parsed.data.notes ?? null : null,
  });

  return NextResponse.json({ ok: true, status: "voided" });
}
