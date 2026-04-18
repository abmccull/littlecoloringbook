import { NextRequest, NextResponse } from "next/server";
import { getBroadcastById, markBroadcastStatus } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { cancelBroadcast } from "../../../../../../lib/resend-broadcasts";

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
  if (broadcast.status === "cancelled" || broadcast.status === "sent") {
    return NextResponse.json({ error: `Already ${broadcast.status}` }, { status: 409 });
  }

  if (broadcast.resendBroadcastId) {
    try {
      await cancelBroadcast(broadcast.resendBroadcastId);
    } catch (error) {
      console.warn("broadcast cancel: Resend cancel failed (continuing to mark local status)", error);
    }
  }

  await markBroadcastStatus({ id: broadcast.id, status: "cancelled" });
  return NextResponse.json({ ok: true });
}
