import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { buildColoringPrompt } from "@littlecolorbook/pipeline";
import type { DeliveryMode } from "@littlecolorbook/shared";
import { uploadObject } from "@littlecolorbook/shared/storage";
import {
  insertCreativeBrief,
  insertCreativeAsset,
  updateCreativeAssetCompliance,
} from "@littlecolorbook/db/repositories";
import {
  creativeBriefInputSchema,
  ComplianceRejectedError,
  NotImplementedError,
  type CreativeBriefInput,
  type ProduceResult,
  type ComplianceReport,
  type CropKey,
  cropKeys,
} from "./types.js";
import { scanText } from "./compliance.js";
import { renderColoringPageImage } from "./gemini.js";
import { deriveAspectCrops } from "./cropping.js";
import { tagsToTagsJson } from "./tagging.js";

const GCS_BUCKET = "exports" as const;

function generateId(): string {
  return crypto.randomUUID();
}

export type ProduceCreativeOptions = {
  sourceImagePath?: string;
  createdBy?: string;
};

export async function produceCreative(
  briefInput: CreativeBriefInput,
  opts: ProduceCreativeOptions = {},
): Promise<ProduceResult> {
  // 1. Validate the brief
  const parsed = creativeBriefInputSchema.parse(briefInput);

  // 2. Compliance scan on brief copy
  const report = scanText({
    caption: parsed.caption,
    hook: parsed.hook,
    body: parsed.body,
    cta: parsed.cta,
  });

  if (report.status === "rejected") {
    throw new ComplianceRejectedError(report);
  }

  if (report.status === "warned") {
    console.warn(
      "[creative/orchestrator] Brief has compliance warnings:",
      report.warnings.map((w) => w.code).join(", "),
    );
  }

  // 3. Dispatch by kind
  if (parsed.kind !== "static_image") {
    throw new NotImplementedError(`Creative kind '${parsed.kind}' — deferred to later phase.`);
  }

  return produceStaticImage(parsed, report, opts);
}

async function produceStaticImage(
  brief: CreativeBriefInput,
  report: ComplianceReport,
  opts: ProduceCreativeOptions,
): Promise<ProduceResult> {
  if (!opts.sourceImagePath) {
    throw new Error(
      "opts.sourceImagePath is required for static_image in MVP. Provide a source photo path.",
    );
  }

  // a. Read source image from disk
  const sourceBuffer = readFileSync(opts.sourceImagePath);
  const sourceMimeType = opts.sourceImagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  // b. Build prompt via pipeline helper; visual_prompt serves as sourceLabel
  const prompt = buildColoringPrompt({
    attempt: 0,
    deliveryMode: "sample" as DeliveryMode,
    jobKind: "sample",
    pageNumber: 1,
    sourceLabel: brief.visualPrompt,
  });

  // c. Render via Gemini
  const rendered = await renderColoringPageImage({
    sourceImageBuffer: sourceBuffer,
    mimeType: sourceMimeType,
    prompt,
  });

  // d. Derive 4 aspect crops
  const crops = await deriveAspectCrops(rendered.buffer);

  // e. Generate IDs
  const briefId = generateId();
  const heroAssetId = generateId();
  const cropAssetIds: Record<CropKey, string> = {
    aspect_1x1: generateId(),
    aspect_4x5: generateId(),
    aspect_9x16: generateId(),
    aspect_16x9: generateId(),
  };

  // f. Upload hero + crops to GCS
  const heroObject = `creative-library/${heroAssetId}.png`;
  await uploadObject({
    bucket: GCS_BUCKET,
    objectPath: heroObject,
    body: rendered.buffer,
    contentType: "image/png",
    cacheControl: "public, max-age=31536000",
  });

  for (const key of cropKeys) {
    await uploadObject({
      bucket: GCS_BUCKET,
      objectPath: `creative-library/crops/${heroAssetId}/${key}.png`,
      body: crops[key],
      contentType: "image/png",
      cacheControl: "public, max-age=31536000",
    });
  }

  // g. Build tags JSON from brief
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

  // h. Insert DB rows
  await insertCreativeBrief({
    id: briefId,
    kind: brief.kind,
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
    id: heroAssetId,
    briefId,
    source: "agent_generated",
    kind: "hero_image",
    gcsBucket: GCS_BUCKET,
    gcsObject: heroObject,
    mimeType: "image/png",
    tagsJson,
    complianceStatus: report.status,
    complianceCheckedAt: new Date(),
    complianceReportJson: reportJson,
    consentSource: "internal",
    createdBy: opts.createdBy,
  });

  for (const key of cropKeys) {
    const cropId = cropAssetIds[key];
    await insertCreativeAsset({
      id: cropId,
      briefId,
      source: "agent_generated",
      kind: key,
      parentAssetId: heroAssetId,
      gcsBucket: GCS_BUCKET,
      gcsObject: `creative-library/crops/${heroAssetId}/${key}.png`,
      mimeType: "image/png",
      tagsJson,
      complianceStatus: report.status,
      complianceCheckedAt: new Date(),
      complianceReportJson: null,
      consentSource: "internal",
      createdBy: opts.createdBy,
    });
  }

  return {
    briefId,
    heroAssetId,
    crops: {
      aspect_1x1: cropAssetIds.aspect_1x1,
      aspect_4x5: cropAssetIds.aspect_4x5,
      aspect_9x16: cropAssetIds.aspect_9x16,
      aspect_16x9: cropAssetIds.aspect_16x9,
    },
    complianceStatus: report.status,
  };
}
