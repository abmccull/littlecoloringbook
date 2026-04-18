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
import type { InsertCreativeBriefInput } from "@littlecolorbook/db/repositories";
import type { GammaClient } from "@littlecolorbook/gamma";
import type { ElevenLabsClient } from "@littlecolorbook/voiceover";
import {
  creativeBriefInputSchema,
  ComplianceRejectedError,
  MissingClientError,
  type CreativeBriefInput,
  type CreativeBriefParsed,
  type ProduceResult,
  type ComplianceReport,
  type CropKey,
  cropKeys,
} from "./types.js";
import { scanText } from "./compliance.js";
import { renderColoringPageImage } from "./gemini.js";
import { deriveAspectCrops } from "./cropping.js";
import { tagsToTagsJson } from "./tagging.js";
import { CanvaClient } from "./canva/client.js";
import { DEFAULT_CANVA_FIELD_MAPPING } from "./canva/types.js";
import type { CanvaAutofillField } from "./canva/types.js";
import { produceCarouselImage } from "./carousel.js";
import { produceStopMotionReveal } from "./video/stop-motion.js";
import { produceSlideshowNarrationVideo } from "./video/slideshow-narration.js";
import { produceUgcNarrated } from "./video/ugc-narrated.js";

const GCS_BUCKET = "exports" as const;

function generateId(): string {
  return crypto.randomUUID();
}

export type ProduceCreativeOptions = {
  sourceImagePath?: string;
  createdBy?: string;
  /** Override for the Canva client instance — used in tests */
  canvaClient?: CanvaClient;
  /** Gamma client — required for slideshow_narration_video kind */
  gammaClient?: GammaClient;
  /** ElevenLabs client — required for ugc_narrated and slideshow_narration_video kinds */
  voiceoverClient?: ElevenLabsClient;
  /** Skip compliance scan — used in tests */
  skipCompliance?: boolean;
};

export async function produceCreative(
  briefInput: CreativeBriefInput,
  opts: ProduceCreativeOptions = {},
): Promise<ProduceResult> {
  // 1. Validate the brief
  const parsed = creativeBriefInputSchema.parse(briefInput);

  // 2. Compliance scan on brief copy (unless skipped in tests)
  let report: ComplianceReport;

  if (opts.skipCompliance) {
    report = { status: "passed", warnings: [], errors: [], policyVersion: "skip" };
  } else {
    report = scanText({
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
  }

  // 3. Dispatch by kind
  switch (parsed.kind) {
    case "static_image":
      return produceStaticImage(parsed, report, opts);

    case "carousel_image":
      return produceCarouselImage(parsed, report, opts);

    case "stop_motion_reveal":
      return produceStopMotionReveal(parsed, report, opts);

    case "slideshow_narration_video": {
      if (!opts.gammaClient) {
        throw new MissingClientError("gammaClient", "slideshow_narration_video");
      }
      if (!opts.voiceoverClient) {
        throw new MissingClientError("voiceoverClient", "slideshow_narration_video");
      }
      return produceSlideshowNarrationVideo(parsed, report, opts, {
        gammaClient: opts.gammaClient,
        voiceoverClient: opts.voiceoverClient,
      });
    }

    case "ugc_narrated": {
      if (!opts.voiceoverClient) {
        throw new MissingClientError("voiceoverClient", "ugc_narrated");
      }
      return produceUgcNarrated(parsed, report, opts, {
        voiceoverClient: opts.voiceoverClient,
      });
    }

    default: {
      // TypeScript exhaustiveness check — should never reach here
      const _exhaustive: never = parsed.kind;
      throw new Error(`Unhandled creative kind: ${String(_exhaustive)}`);
    }
  }
}

async function produceStaticImage(
  brief: CreativeBriefParsed,
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

  // c. Render via Gemini — produces the hero illustration
  const rendered = await renderColoringPageImage({
    sourceImageBuffer: sourceBuffer,
    mimeType: sourceMimeType,
    prompt,
  });

  // d. Optional Canva autofill overlay
  const { heroBuffer, canvaMeta } = await maybeRunCanvaAutofill(rendered.buffer, brief, opts);

  // e. Derive 4 aspect crops from (potentially Canva-enhanced) hero
  const crops = await deriveAspectCrops(heroBuffer);

  // f. Generate IDs
  const briefId = generateId();
  const heroAssetId = generateId();
  const cropAssetIds: Record<CropKey, string> = {
    aspect_1x1: generateId(),
    aspect_4x5: generateId(),
    aspect_9x16: generateId(),
    aspect_16x9: generateId(),
  };

  // g. Upload hero + crops to GCS
  const heroObject = `creative-library/${heroAssetId}.png`;
  await uploadObject({
    bucket: GCS_BUCKET,
    objectPath: heroObject,
    body: heroBuffer,
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

  // h. Build tags JSON from brief
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

  // i. Insert DB rows
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
    metadata: canvaMeta,
  };
}

// ─── Canva autofill overlay (optional) ───────────────────────────────────────

type CanvaMeta =
  | { canvaDesignId: string }
  | { canvaFailed: true; canvaError: string }
  | undefined;

async function maybeRunCanvaAutofill(
  geminiBuffer: Buffer,
  brief: CreativeBriefParsed,
  opts: ProduceCreativeOptions,
): Promise<{ heroBuffer: Buffer; canvaMeta: CanvaMeta }> {
  // Feature flag: must be explicitly enabled
  const isEnabled = process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED === "true";
  const templateId = brief.canvaTemplateId ?? null;

  if (!isEnabled || !templateId) {
    // Skip Canva — return Gemini hero as-is
    return { heroBuffer: geminiBuffer, canvaMeta: undefined };
  }

  try {
    const client = opts.canvaClient ?? new CanvaClient();

    // Step 1: Upload Gemini hero to Canva asset library
    const { asset_id } = await client.uploadAsset({
      buffer: geminiBuffer,
      mimeType: "image/png",
      name: "hero_image",
    });

    // Step 2: Build autofill data from field mapping
    const fieldMapping = brief.canvaFieldMapping ?? DEFAULT_CANVA_FIELD_MAPPING;
    const autofillData: Record<string, CanvaAutofillField> = {};

    for (const [canvaKey, briefField] of Object.entries(fieldMapping)) {
      if (briefField === "hero_image") {
        autofillData[canvaKey] = { type: "image", asset_id };
      } else if (briefField === "hook") {
        autofillData[canvaKey] = { type: "text", text: brief.hook };
      } else if (briefField === "body") {
        autofillData[canvaKey] = { type: "text", text: brief.body };
      } else if (briefField === "cta") {
        autofillData[canvaKey] = { type: "text", text: brief.cta };
      }
    }

    // Step 3: Autofill brand template → designId
    const { designId } = await client.autofillBrandTemplate({
      brandTemplateId: templateId,
      data: autofillData,
    });

    // Step 4: Export design to PNG → signed download URL
    const { downloadUrl } = await client.exportDesign({ designId, format: "png" });

    // Step 5: Fetch the finished image buffer
    const finishedBuffer = await client.fetchDesignAsBuffer({ downloadUrl });

    return {
      heroBuffer: finishedBuffer,
      canvaMeta: { canvaDesignId: designId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[creative/orchestrator] Canva autofill failed — falling back to raw Gemini hero. Error: ${message}`,
    );
    return {
      heroBuffer: geminiBuffer,
      canvaMeta: { canvaFailed: true, canvaError: message },
    };
  }
}
