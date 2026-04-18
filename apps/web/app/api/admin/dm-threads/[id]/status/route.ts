import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { markDmThreadStatus, getDmThreadById, dmThreadStatusValues } from "@littlecolorbook/db";
import type { DmThreadStatus } from "@littlecolorbook/db";

const statusSchema = z.object({
  status: z.enum(dmThreadStatusValues),
  assignedTo: z.string().email().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const existing = await getDmThreadById(id);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `DM thread ${id} not found` } },
      { status: 404 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(payload);
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

  const { status, assignedTo } = parsed.data;

  const thread = await markDmThreadStatus({
    id,
    status: status as DmThreadStatus,
    assignedTo: assignedTo ?? undefined,
  });

  return NextResponse.json({ ok: true, thread });
}
