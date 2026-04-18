import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addTicketMessage, getAdminTicketDetail } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { sendTicketAdminRepliedEmail } from "../../../../../../lib/ticket-email";

const schema = z.object({
  body: z.string().trim().min(1).max(10000),
  internal: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await context.params;
  const detail = await getAdminTicketDetail(ticketId);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply", issues: parsed.error.flatten() }, { status: 400 });
  }

  const message = await addTicketMessage({
    ticketId,
    author: "admin",
    authorEmail: session.email ?? null,
    body: parsed.data.body,
    internal: parsed.data.internal ?? false,
  });

  if (!(parsed.data.internal ?? false)) {
    // Public reply — email the customer asynchronously.
    sendTicketAdminRepliedEmail({
      to: detail.ticket.customerEmail,
      firstName: detail.ticket.customerFirstName,
      ticket: detail.ticket,
      replyBody: parsed.data.body,
    }).catch((error) => console.error("sendTicketAdminRepliedEmail failed", error));
  }

  return NextResponse.json({ ok: true, messageId: message?.id ?? null });
}
