import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { insertCreativeRequest, listCreativeRequests } from "@littlecolorbook/db";

// ─── Validation schemas ───────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.enum(["pending", "fulfilled", "rejected", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
  briefJson: z.record(z.string(), z.unknown()).refine(
    (v) => typeof v === "object" && v !== null,
    { message: "briefJson must be a non-null object" },
  ),
});

// ─── GET — list creative requests ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const { status, limit, offset } = parsed.data;

  const rows = await listCreativeRequests({ status, limit, offset });

  return NextResponse.json({ creativeRequests: rows, count: rows.length });
}

// ─── POST — manually create a creative request ────────────────────────────────

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const id = `creq_${randomUUID().replace(/-/g, "")}`;
  const row = await insertCreativeRequest({ id, briefJson: parsed.data.briefJson });

  return NextResponse.json({ ok: true, creativeRequest: row }, { status: 201 });
}
