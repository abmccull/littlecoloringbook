import { NextRequest, NextResponse } from "next/server";
import { getBroadcastById, markBroadcastStatus } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { sendBroadcastNow } from "../../../../../../lib/resend-broadcasts";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ broadcastId: string }> },
) {
  const session = await requireAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { broadcastId } = await context.params;
  const broadcast = await getBroadcastById(broadcastId);
  if (!broadcast) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!broadcast.resendBroadcastId) {
    return NextResponse.json({ error: "No Resend broadcast attached" }, { status: 409 });
  }
  if (broadcast.status === "sent" || broadcast.status === "cancelled") {
    return NextResponse.json({ error: `Already ${broadcast.status}` }, { status: 409 });
  }

  try {
    const result = await sendBroadcastNow(broadcast.resendBroadcastId);
    await markBroadcastStatus({ id: broadcast.id, status: "sending" });
    return NextResponse.json({ ok: true, resendStatus: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    await markBroadcastStatus({ id: broadcast.id, status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
