import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAdminTicketDetail,
  setTicketStatus,
  ticketStatusValues,
} from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { sendTicketResolvedEmail } from "../../../../../../lib/ticket-email";

const schema = z.object({
  status: z.enum(ticketStatusValues),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await context.params;
  const before = await getAdminTicketDetail(ticketId);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status", issues: parsed.error.flatten() }, { status: 400 });
  }

  const after = await setTicketStatus({
    ticketId,
    status: parsed.data.status,
    actorEmail: session.email ?? null,
  });

  if (parsed.data.status === "resolved" && before.ticket.status !== "resolved" && after) {
    sendTicketResolvedEmail({
      to: before.ticket.customerEmail,
      firstName: before.ticket.customerFirstName,
      ticket: after,
    }).catch((error) => console.error("sendTicketResolvedEmail failed", error));
  }

  return NextResponse.json({ ok: true, status: after?.status });
}
