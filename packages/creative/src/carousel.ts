/**
 * carousel_image kind producer.
 *
 * Pipeline:
 *  1. Derive per-card copy if brief.cards is absent
 *  2. For each card:
 *     a. Render a Gemini hero (shared source photo; visualPrompt varied per card)
 *     b. Optionally autofill Canva template with per-card copy
 *     c. Derive aspect_1x1 + aspect_4x5 crops
 *     d. Upload hero + crops to GCS
 *     e. Insert DB rows
 *  3. Return { briefId, cards: [...] }
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { buildColoringPrompt } from "@littlecolorbook/pipeline";
import type { DeliveryMode } from "@littlecolorbook/shared";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import type { InsertCreativeBriefInput } from "@littlecolorbook/db/repositories";
import type {
  CreativeBriefParsed,
  CarouselCard,
  CarouselCardResult,
  ProduceResult,
  ComplianceReport,
} from "./types";
import { renderColoringPageImage } from "./gemini";
import { deriveAspectCrops } from "./cropping";
import { tagsToTagsJson } from "./tagging";
import { CanvaClient } from "./canva/client";
import { DEFAULT_CANVA_FIELD_MAPPING } from "./canva/types";
import type { CanvaAutofillField } from "./canva/types";
import type { ProduceCreativeOptions } from "./orchestrator";

const GCS_BUCKET = "exports" as const;

// Carousel only uploads 1:1 and 4:5 — IG carousel uses a single consistent ratio.
const CAROUSEL_CROP_KEYS = ["aspect_1x1", "aspect_4x5"] as const;
type CarouselCropKey = (typeof CAROUSEL_CROP_KEYS)[number];

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Default card copy derivation ────────────────────────────────────────────

function deriveDefaultCards(brief: CreativeBriefParsed): CarouselCard[] {
  const cardCount = brief.cardCount;
  const cards: CarouselCard[] = [];

  // Card 1: hook + swipe prompt
  cards.push({
    hook: brief.hook,
    body: "Swipe to see more →",
    cta: brief.cta,
    visualPrompt: brief.visualPrompt,
  });

  // Cards 2..N-1: body sentence variations
  const sentences = brief.body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const middleCount = cardCount - 2;
  for (let i = 0; i < middleCount; i++) {
    const sentence = sentences[i % sentences.length] ?? brief.body;
    cards.push({
      hook: `${i + 2} of ${cardCount}`,
      body: sentence,
      cta: brief.cta,
      // Slightly vary the visual prompt for each card for diversity
      visualPrompt: `${brief.visualPrompt} — variation ${i + 2}`,
    });
  }

  // Card N: CTA
  cards.push({
    hook: brief.cta,
    body: brief.concept,
    cta: brief.cta,
    visualPrompt: `${brief.visualPrompt} — final card`,
  });

  return cards;
}

// ─── Per-card Canva autofill ──────────────────────────────────────────────────

async function maybeRunCanvaAutofillForCard(
  geminiBuffer: Buffer,
  card: CarouselCard,
  templateId: string,
  fieldMapping: Record<string, "hook" | "body" | "cta" | "hero_image">,
  client: CanvaClient,
): Promise<{ heroBuffer: Buffer; canvaMeta?: { canvaDesignId: string } | { canvaFailed: true; canvaError: string } }> {
  try {
    const { asset_id } = await client.uploadAsset({
      buffer: geminiBuffer,
      mimeType: "image/png",
      name: "carousel_card_image",
    });

    const autofillData: Record<string, CanvaAutofillField> = {};
    for (const [canvaKey, briefField] of Object.entries(fieldMapping)) {
      if (briefField === "hero_image") {
        autofillData[canvaKey] = { type: "image", asset_id };
      } else if (briefField === "hook") {
        autofillData[canvaKey] = { type: "text", text: card.hook };
      } else if (briefField === "body") {
        autofillData[canvaKey] = { type: "text", text: card.body };
      } else if (briefField === "cta") {
        autofillData[canvaKey] = { type: "text", text: card.cta };
      }
    }

    const { designId } = await client.autofillBrandTemplate({
      brandTemplateId: templateId,
      data: autofillData,
    });

    const { downloadUrl } = await client.exportDesign({ designId, format: "png" });
    const finishedBuffer = await client.fetchDesignAsBuffer({ downloadUrl });

    return {
      heroBuffer: finishedBuffer,
      canvaMeta: { canvaDesignId: designId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[creative/carousel] Canva autofill failed for card — using raw Gemini hero. Error: ${message}`);
    return {
      heroBuffer: geminiBuffer,
      canvaMeta: { canvaFailed: true, canvaError: message },
    };
  }
}

// ─── Main producer ────────────────────────────────────────────────────────────

export async function produceCarouselImage(
  brief: CreativeBriefParsed,
  report: ComplianceReport,
  opts: ProduceCreativeOptions,
): Promise<ProduceResult> {
  if (!opts.sourceImagePath) {
    throw new Error(
      "opts.sourceImagePath is required for carousel_image. Provide a source photo path.",
    );
  }

  const sourceBuffer = readFileSync(opts.sourceImagePath);
  const sourceMimeType = opts.sourceImagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  // Resolve cards — use brief.cards if provided, else derive defaults
  const cards: CarouselCard[] = brief.cards && brief.cards.length > 0
    ? brief.cards
    : deriveDefaultCards(brief);

  const isCanvaEnabled = process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED === "true";
  const templateId = brief.canvaTemplateId ?? null;
  const fieldMapping = brief.canvaFieldMapping ?? DEFAULT_CANVA_FIELD_MAPPING;

  const canvaClient = (isCanvaEnabled && templateId)
    ? (opts.canvaClient ?? new CanvaClient())
    : null;

  // Insert the brief row once
  const briefId = generateId();

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

  // Process each card sequentially to respect Canva rate limits
  const cardResults: CarouselCardResult[] = [];

  for (const card of cards) {
    const prompt = buildColoringPrompt({
      attempt: 0,
      deliveryMode: "sample" as DeliveryMode,
      jobKind: "sample",
      pageNumber: 1,
      sourceLabel: card.visualPrompt,
    });

    const rendered = await renderColoringPageImage({
      sourceImageBuffer: sourceBuffer,
      mimeType: sourceMimeType,
      prompt,
    });

    let heroBuffer = rendered.buffer;

    if (canvaClient && templateId) {
      const { heroBuffer: canvaHero } = await maybeRunCanvaAutofillForCard(
        heroBuffer,
        card,
        templateId,
        fieldMapping,
        canvaClient,
      );
      heroBuffer = canvaHero;
    }

    // Derive crops — only 1:1 and 4:5 for carousel
    const allCrops = await deriveAspectCrops(heroBuffer);

    const heroAssetId = generateId();
    const cropAssetIds: Record<CarouselCropKey, string> = {
      aspect_1x1: generateId(),
      aspect_4x5: generateId(),
    };

    const heroGcsObject = `creative-library/${heroAssetId}.png`;

    await uploadObject({
      bucket: GCS_BUCKET,
      objectPath: heroGcsObject,
      body: heroBuffer,
      contentType: "image/png",
      cacheControl: "public, max-age=31536000",
    });

    for (const key of CAROUSEL_CROP_KEYS) {
      await uploadObject({
        bucket: GCS_BUCKET,
        objectPath: `creative-library/crops/${heroAssetId}/${key}.png`,
        body: allCrops[key],
        contentType: "image/png",
        cacheControl: "public, max-age=31536000",
      });
    }

    await insertCreativeAsset({
      id: heroAssetId,
      briefId,
      source: "agent_generated",
      kind: "hero_image",
      gcsBucket: GCS_BUCKET,
      gcsObject: heroGcsObject,
      mimeType: "image/png",
      tagsJson,
      complianceStatus: report.status,
      complianceCheckedAt: new Date(),
      complianceReportJson: reportJson,
      consentSource: "internal",
      createdBy: opts.createdBy,
    });

    for (const key of CAROUSEL_CROP_KEYS) {
      await insertCreativeAsset({
        id: cropAssetIds[key],
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

    cardResults.push({
      heroAssetId,
      cropAssetIds: {
        aspect_1x1: cropAssetIds.aspect_1x1,
        aspect_4x5: cropAssetIds.aspect_4x5,
      },
    });
  }

  return {
    briefId,
    cards: cardResults,
    complianceStatus: report.status,
  };
}
