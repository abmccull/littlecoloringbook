import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import {
  getCopyElementById,
  listCopyElements,
  copyElementKindValues,
} from "@littlecolorbook/db";
import type { CopyElement, CopyElementKind } from "@littlecolorbook/db";

export const dynamic = "force-dynamic";

// ─── Validation ───────────────────────────────────────────────────────────────

const copyElementKindSchema = z.enum(copyElementKindValues);

const bodySchema = z.object({
  axes: z.array(copyElementKindSchema).min(1),
  variantCount: z.number().int().min(1).max(10).default(3),
});

// ─── POST /api/admin/creative/mix-match/[briefId] ────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { briefId } = await params;
  if (!briefId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "briefId path param is required" } },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
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

  const { axes, variantCount } = parsed.data;

  // ─── Load source brief ────────────────────────────────────────────────────

  // We do not import the full brief DB query here to keep the endpoint thin;
  // the brief is identified by its ID and element_ids are passed inline in
  // the mix-match request body. Callers are expected to supply the source
  // brief's element_ids so we know the "winner" anchor elements.
  // Since the endpoint is intentionally light (no DB brief lookup), we derive
  // the source anchor from what's available in the request. If element_ids are
  // not provided the endpoint uses the first available element per non-varying
  // axis as the fixed value.

  // ─── For each axis: find variantCount alternative elements ────────────────

  const kindToJsonKey: Record<CopyElementKind, string> = {
    hook: "hook_id",
    body: "body_id",
    cta: "cta_id",
    visual_style: "visual_style_id",
  };

  // Collect alternative pool per axis
  const alternativesByAxis: Record<string, CopyElement[]> = {};

  for (const axis of axes) {
    const pool = await listCopyElements({
      kind: axis as CopyElementKind,
      retired: false,
      limit: 50,
    });
    alternativesByAxis[axis] = pool;
  }

  // Validate we have enough elements
  for (const axis of axes) {
    const pool = alternativesByAxis[axis] ?? [];
    if (pool.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_ENOUGH_ELEMENTS",
            message: `No active copy elements found for axis '${axis}'. Seed copy_elements table first.`,
          },
        },
        { status: 422 },
      );
    }
  }

  // ─── Build variant proposals ──────────────────────────────────────────────

  // Each variant swaps exactly one axis, keeping the rest fixed.
  // We do not create DB rows — we return proposed brief inputs for the caller
  // to POST to the normal brief creation endpoint.
  const variants: Array<{
    variantAxis: CopyElementKind;
    elementId: string;
    elementText: string;
    elementLabel: string | null;
    briefInputPatch: {
      elementIds: Record<string, string> & { mix_match_parent_brief_id: string };
    };
  }> = [];

  for (const axis of axes) {
    const pool = alternativesByAxis[axis] ?? [];
    // Take up to variantCount elements from the pool, round-robin from the front.
    const picks = pool.slice(0, variantCount);

    for (const el of picks) {
      variants.push({
        variantAxis: axis as CopyElementKind,
        elementId: el.id,
        elementText: el.text,
        elementLabel: el.label,
        briefInputPatch: {
          elementIds: {
            [kindToJsonKey[axis as CopyElementKind]]: el.id,
            mix_match_parent_brief_id: briefId,
          },
        },
      });
    }
  }

  return NextResponse.json(
    {
      sourceBriefId: briefId,
      variantCount: variants.length,
      variants,
    },
    { status: 200 },
  );
}
