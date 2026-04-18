import { NextRequest, NextResponse } from "next/server";
import { listSlaBreachedTickets, markTicketSlaBreachNotified } from "@littlecolorbook/db";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { sendAdminSlaBreachEmail } from "../../../../lib/ticket-email";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const breached = await listSlaBreachedTickets(50);
  if (breached.length === 0) {
    return NextResponse.json({ accepted: true, breached: 0 });
  }

  try {
    await sendAdminSlaBreachEmail({
      tickets: breached.map((t) => ({
        id: t.id,
        subject: t.subject,
        customerEmail: t.customerEmail,
        category: t.category,
        firstResponseDueAt: t.firstResponseDueAt,
      })),
    });

    for (const t of breached) {
      await markTicketSlaBreachNotified(t.id).catch((error) =>
        console.error("sla-breach-sweep: mark notified failed", t.id, error),
      );
    }

    return NextResponse.json({
      accepted: true,
      breached: breached.length,
      notified: breached.length,
    });
  } catch (error) {
    console.error("sla-breach-sweep: email failed", error);
    return NextResponse.json(
      {
        accepted: false,
        breached: breached.length,
        error: error instanceof Error ? error.message : "email_failed",
      },
      { status: 500 },
    );
  }
}
