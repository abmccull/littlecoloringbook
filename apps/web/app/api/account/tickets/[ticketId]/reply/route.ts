import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addTicketMessage, getTicketForCustomer } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../../../lib/auth";

const schema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await context.params;
  const ticket = await getTicketForCustomer({ ticketId, customerId: session.customerId });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.ticket.status === "closed") {
    return NextResponse.json({ error: "Ticket is closed" }, { status: 409 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply", issues: parsed.error.flatten() }, { status: 400 });
  }

  const message = await addTicketMessage({
    ticketId,
    author: "customer",
    authorEmail: session.email,
    body: parsed.data.body,
    internal: false,
  });

  return NextResponse.json({ ok: true, messageId: message?.id ?? null });
}
