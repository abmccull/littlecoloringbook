import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";
import {
  listDmKeywordResponses,
  updateDmKeywordResponse,
  deleteDmKeywordResponse,
  dmPlatformValues,
  keywordResponseMatchKindValues,
} from "@littlecolorbook/db";
import type { DmPlatform, KeywordResponseMatchKind } from "@littlecolorbook/db";

export const dynamic = "force-dynamic";

// ─── GET — detail ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  // listDmKeywordResponses returns all; filter to find the one row.
  // (We don't have a getById helper — keeping the repo surface minimal.)
  const all = await listDmKeywordResponses();
  const rule = all.find((r) => r.id === id);
  if (!rule) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Keyword response ${id} not found` } },
      { status: 404 },
    );
  }

  return NextResponse.json({ rule });
}

// ─── PATCH — update ───────────────────────────────────────────────────────────

const patchBodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  matchKind: z.enum(keywordResponseMatchKindValues).optional(),
  matchPattern: z.string().min(1).max(1000).optional(),
  responseBody: z.string().min(1).max(4000).optional(),
  platform: z.enum(dmPlatformValues).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } },
      { status: 400 },
    );
  }

  const parsed = patchBodySchema.safeParse(raw);
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

  const { platform, matchKind, ...rest } = parsed.data;

  const rule = await updateDmKeywordResponse({
    id,
    patch: {
      ...rest,
      ...(matchKind !== undefined ? { matchKind: matchKind as KeywordResponseMatchKind } : {}),
      ...(platform !== undefined ? { platform: (platform ?? null) as DmPlatform | null } : {}),
    },
  });

  if (!rule) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Keyword response ${id} not found` } },
      { status: 404 },
    );
  }

  return NextResponse.json({ rule });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const deleted = await deleteDmKeywordResponse(id);

  if (!deleted) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Keyword response ${id} not found` } },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
