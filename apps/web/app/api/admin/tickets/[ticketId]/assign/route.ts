import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assignTicket } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";

const schema = z.object({
  assignedAdminEmail: z.string().trim().email(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignee", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await assignTicket({ ticketId, assignedAdminEmail: parsed.data.assignedAdminEmail });
  return NextResponse.json({ ok: true, assignedAdminEmail: row?.assignedAdminEmail });
}
