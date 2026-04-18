import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  adSpendPlatformValues,
  createAdSpendEntry,
  deleteAdSpendEntry,
  listAdSpendEntries,
} from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../lib/auth";

const createSchema = z.object({
  spendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(adSpendPlatformValues),
  campaign: z.string().trim().max(120).nullable().optional(),
  amountCents: z.number().int().positive(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const deleteSchema = z.object({ id: z.string().trim().min(1) });

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await listAdSpendEntries({ limit: 500 });
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await createAdSpendEntry({
    spendDate: parsed.data.spendDate,
    platform: parsed.data.platform,
    campaign: parsed.data.campaign ?? null,
    amountCents: parsed.data.amountCents,
    notes: parsed.data.notes ?? null,
    recordedByEmail: session.email ?? null,
  });

  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deleteAdSpendEntry(parsed.data.id);
  return NextResponse.json({ ok: true });
}
