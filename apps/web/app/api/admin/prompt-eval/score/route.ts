// Admin-gated scoring endpoint for the prompt-eval harness. Accepts a
// cell's 1–5 overall score, optional sub-dimensions, and free-text notes,
// persists them on the prompt_eval_samples row, and stamps scored_at +
// scored_by from the admin session.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { upsertPromptEvalScore } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

const scoreSchema = z.object({
  id: z.string().min(1),
  overallScore: z.number().int().min(1).max(5).nullable(),
  scoreDimensions: z
    .object({
      faceQuality: z.number().int().min(1).max(5).optional(),
      lineQuality: z.number().int().min(1).max(5).optional(),
      sceneFaithfulness: z.number().int().min(1).max(5).optional(),
      artifactFree: z.number().int().min(1).max(5).optional(),
    })
    .nullable()
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Drop empty sub-dimensions (treat "—" selections as absent)
  const rawDims = parsed.data.scoreDimensions ?? null;
  const dims =
    rawDims && Object.values(rawDims).some((v) => typeof v === "number")
      ? rawDims
      : null;

  const sample = await upsertPromptEvalScore({
    id: parsed.data.id,
    overallScore: parsed.data.overallScore,
    scoreDimensions: dims,
    notes: parsed.data.notes ?? null,
    scoredBy: session.email ?? session.userId,
  });

  if (!sample) {
    return NextResponse.json({ error: "Sample not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    sample: {
      id: sample.id,
      overallScore: sample.overallScore,
      scoreDimensions: sample.scoreDimensions,
      notes: sample.notes,
      scoredAt: sample.scoredAt ? sample.scoredAt.toISOString() : null,
      scoredBy: sample.scoredBy,
    },
  });
}
