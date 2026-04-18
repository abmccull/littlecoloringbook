import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTicketsForCustomer, openTicket, ticketCategoryValues } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../lib/auth";
import { sendTicketReceivedEmail, sendAdminNewTicketEmail } from "../../../../lib/ticket-email";

const createSchema = z.object({
  orderId: z.string().trim().min(1).optional(),
  category: z.enum(ticketCategoryValues),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(10000),
});

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tickets = await listTicketsForCustomer(session.customerId, 50);
  return NextResponse.json({ tickets });
}

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await openTicket({
    customerId: session.customerId,
    orderId: parsed.data.orderId ?? null,
    category: parsed.data.category,
    subject: parsed.data.subject,
    body: parsed.data.body,
    customerEmail: session.email,
  });

  if (!result) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Fire confirmation emails — non-blocking
  Promise.all([
    sendTicketReceivedEmail({
      to: session.email,
      firstName: session.displayName ?? null,
      ticket: result.ticket,
    }).catch((error) => console.error("sendTicketReceivedEmail failed", error)),
    sendAdminNewTicketEmail({
      ticket: result.ticket,
      customerEmail: session.email,
      firstMessage: parsed.data.body,
    }).catch((error) => console.error("sendAdminNewTicketEmail failed", error)),
  ]);

  return NextResponse.json({ ticketId: result.ticket.id, status: result.ticket.status });
}
