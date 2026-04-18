import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import {
  getDmThreadById,
  setDmThreadTicket,
  openTicket,
  ticketCategoryValues,
  ticketPriorityValues,
} from "@littlecolorbook/db";
import type { TicketCategory, TicketPriority } from "@littlecolorbook/db";

const escalateSchema = z.object({
  /**
   * The customer ID to attach this ticket to.
   * Required because the tickets table has a non-nullable FK to customers.
   * If the DM sender is not yet a customer in the system, create/upsert one
   * before calling this endpoint.
   */
  customerId: z.string().min(1),
  subject: z.string().min(1).max(240),
  body: z.string().min(1).max(5000),
  category: z.enum(ticketCategoryValues).default("other"),
  priority: z.enum(ticketPriorityValues).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const thread = await getDmThreadById(id);
  if (!thread) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `DM thread ${id} not found` } },
      { status: 404 },
    );
  }

  if (thread.ticketId) {
    return NextResponse.json(
      {
        error: {
          code: "ALREADY_ESCALATED",
          message: `This thread is already linked to ticket ${thread.ticketId}.`,
          ticketId: thread.ticketId,
        },
      },
      { status: 409 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = escalateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const { customerId, subject, body, category, priority } = parsed.data;

  // Open a support ticket linked to the customer.
  const result = await openTicket({
    customerId,
    category: category as TicketCategory,
    subject,
    body,
    priority: (priority as TicketPriority | undefined) ?? "normal",
    metadata: {
      source: "dm_escalation",
      dmThreadId: thread.id,
      dmPlatform: thread.platform,
      dmPlatformUserId: thread.platformUserId,
    },
  });

  if (!result) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Failed to create ticket — database not configured" } },
      { status: 503 },
    );
  }

  // Link the ticket back to the thread.
  const updatedThread = await setDmThreadTicket({ id: thread.id, ticketId: result.ticket.id });

  return NextResponse.json(
    {
      ok: true,
      ticketId: result.ticket.id,
      ticket: result.ticket,
      firstMessage: result.firstMessage,
      thread: updatedThread,
    },
    { status: 201 },
  );
}
