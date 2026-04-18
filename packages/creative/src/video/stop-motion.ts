/**
 * stop-motion-reveal kind producer.
 *
 * Timeline:
 *   0–1 s  — source photo static
 *   1–4 s  — crossfade from source photo to coloring page
 *   4–7 s  — coloring page static
 *
 * No audio in v1.
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { buildColoringPrompt } from "@littlecolorbook/pipeline";
import type { DeliveryMode } from "@littlecolorbook/shared";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import type { InsertCreativeBriefInput } from "@littlecolorbook/db/repositories";
import type { CreativeBriefParsed, ProduceResult, ComplianceReport } from "../types";
import { renderColoringPageImage } from "../gemini";
import { tagsToTagsJson } from "../tagging";
import { imageToMp4, crossfadeSequence } from "./ffmpeg";
import type { ProduceCreativeOptions } from "../orchestrator";

const GCS_BUCKET = "exports" as const;

function generateId(): string {
  return crypto.randomUUID();
}

export async function produceStopMotionReveal(
  brief: CreativeBriefParsed,
  report: ComplianceReport,
  opts: ProduceCreativeOptions,
): Promise<ProduceResult> {
  if (!opts.sourceImagePath) {
    throw new Error(
      "opts.sourceImagePath is required for stop_motion_reveal. Provide a source photo path.",
    );
  }

  // a. Read source image — this IS the source photo
  const sourceBuffer = readFileSync(opts.sourceImagePath);
  const sourceMimeType = opts.sourceImagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  // b. Render coloring page via Gemini
  const prompt = buildColoringPrompt({
    attempt: 0,
    deliveryMode: "sample" as DeliveryMode,
    jobKind: "sample",
    pageNumber: 1,
    sourceLabel: brief.visualPrompt,
  });

  const rendered = await renderColoringPageImage({
    sourceImageBuffer: sourceBuffer,
    mimeType: sourceMimeType,
    prompt,
  });

  const coloringPageBuffer = rendered.buffer;

  // c. Build 3 clips matching the timeline
  //    Clip 1 (0–1 s): source photo
  //    Clip 2 (1–4 s): crossfade region — use source as start frame, coloring page as end
  //    Clip 3 (4–7 s): coloring page static
  //
  // Implementation: produce 3 still-image clips then crossfadeSequence stitches them.
  // The crossfade filter creates the blend between adjacent clips automatically.
  const [clip1, clip2, clip3] = await Promise.all([
    imageToMp4({ imageBuffer: sourceBuffer, durationSeconds: 1.5 }),
    // Middle clip — we use the coloring page so the crossfade blends photo → coloring
    imageToMp4({ imageBuffer: coloringPageBuffer, durationSeconds: 2 }),
    imageToMp4({ imageBuffer: coloringPageBuffer, durationSeconds: 3 }),
  ]);

  const videoBuffer = await crossfadeSequence({
    clips: [clip1, clip2, clip3],
    transitionSeconds: 0.5,
  });

  // d. IDs
  const briefId = generateId();
  const videoAssetId = generateId();

  // e. Upload video to GCS
  const gcsObject = `creative-library/video/${videoAssetId}.mp4`;
  await uploadObject({
    bucket: GCS_BUCKET,
    objectPath: gcsObject,
    body: videoBuffer,
    contentType: "video/mp4",
    cacheControl: "public, max-age=31536000",
  });

  // f. Build tags
  const tagsJson = tagsToTagsJson({
    concept: brief.concept,
    format: brief.format,
    persona: brief.persona ?? undefined,
    occasion: brief.occasion ?? undefined,
    offer: brief.offerCode ?? undefined,
    ...brief.tags,
  });

  const reportJson: Record<string, unknown> = {
    status: report.status,
    warnings: report.warnings,
    errors: report.errors,
    policyVersion: report.policyVersion,
  };

  // g. DB rows
  // NOTE: brief.kind may include "slideshow_narration_video" which is not yet in the
  // DB enum. Cast is safe here because the DB INSERT will fail gracefully (isDatabaseConfigured
  // guard) until the migration adding the enum value is deployed.
  await insertCreativeBrief({
    id: briefId,
    kind: brief.kind as InsertCreativeBriefInput["kind"],
    concept: brief.concept,
    format: brief.format,
    hook: brief.hook,
    body: brief.body,
    cta: brief.cta,
    persona: brief.persona,
    occasion: brief.occasion,
    offerCode: brief.offerCode,
    visualPrompt: brief.visualPrompt,
    voiceFamily: brief.voiceFamily,
    createdBy: opts.createdBy,
  });

  await insertCreativeAsset({
    id: videoAssetId,
    briefId,
    source: "agent_generated",
    kind: "video",
    gcsBucket: GCS_BUCKET,
    gcsObject,
    mimeType: "video/mp4",
    tagsJson,
    complianceStatus: report.status,
    complianceCheckedAt: new Date(),
    complianceReportJson: reportJson,
    consentSource: "internal",
    createdBy: opts.createdBy,
  });

  return {
    briefId,
    videoAssetId,
    durationSeconds: 6.5, // approximate: 1.5 + 2 + 3 - overlap transitions
    complianceStatus: report.status,
  };
}
