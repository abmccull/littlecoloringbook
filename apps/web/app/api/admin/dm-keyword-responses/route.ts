import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  listDmKeywordResponses,
  insertDmKeywordResponse,
  dmPlatformValues,
  keywordResponseMatchKindValues,
} from "@littlecolorbook/db";
import type { DmPlatform, KeywordResponseMatchKind } from "@littlecolorbook/db";

export const dynamic = "force-dynamic";

// ─── GET — list all ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const rules = await listDmKeywordResponses();
  return NextResponse.json({ rules, count: rules.length });
}

// ─── POST — create ────────────────────────────────────────────────────────────

const createBodySchema = z.object({
  label: z.string().min(1).max(200),
  matchKind: z.enum(keywordResponseMatchKindValues),
  matchPattern: z.string().min(1).max(1000),
  responseBody: z.string().min(1).max(4000),
  platform: z.enum(dmPlatformValues).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } },
      { status: 400 },
    );
  }

  const parsed = createBodySchema.safeParse(raw);
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

  const { label, matchKind, matchPattern, responseBody, platform, enabled } = parsed.data;

  const id = `dmkr_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const rule = await insertDmKeywordResponse({
    id,
    label,
    matchKind: matchKind as KeywordResponseMatchKind,
    matchPattern,
    responseBody,
    platform: (platform ?? null) as DmPlatform | null,
    enabled: enabled ?? true,
  });

  if (!rule) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database not configured" } },
      { status: 503 },
    );
  }

  return NextResponse.json({ rule }, { status: 201 });
}
