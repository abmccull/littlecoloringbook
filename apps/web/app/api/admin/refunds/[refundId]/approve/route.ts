import { NextRequest, NextResponse } from "next/server";
import { getRefundById } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { executeRefund } from "../../../../../../lib/refund-executor";

export async function POST(
  _request: NextRequest,
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

  const cancelLulu = Boolean((refund.metadata as Record<string, unknown>)?.cancelLulu);
  const result = await executeRefund({
    refund,
    approvedByEmail: session.email ?? "admin",
    cancelLulu,
  });

  return NextResponse.json(result);
}
