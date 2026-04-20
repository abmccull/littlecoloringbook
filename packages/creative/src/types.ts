import { z } from "zod";

// ─── Enum value arrays (mirrors DB schema) ────────────────────────────────────

export const creativeBriefKindValues = [
  "static_image",
  "carousel_image",
  "stop_motion_reveal",
  "ugc_narrated",
  "slideshow_narration_video",
] as const;

export const creativeAssetSourceValues = [
  "pipeline_test_batch",
  "agent_generated",
  "customer_sample",
  "stock",
  "manual_upload",
] as const;

export const creativeAssetKindValues = [
  "hero_image",
  "aspect_1x1",
  "aspect_4x5",
  "aspect_9x16",
  "aspect_16x9",
  "video",
  "voiceover",
  "composite",
] as const;

export const creativeAssetComplianceStatusValues = [
  "pending",
  "passed",
  "warned",
  "rejected",
] as const;

export type CreativeBriefKind = (typeof creativeBriefKindValues)[number];
export type CreativeAssetSource = (typeof creativeAssetSourceValues)[number];
export type CreativeAssetKind = (typeof creativeAssetKindValues)[number];
export type CreativeAssetComplianceStatus = (typeof creativeAssetComplianceStatusValues)[number];

// Crop keys are a subset of asset kinds
export const cropKeys = ["aspect_1x1", "aspect_4x5", "aspect_9x16", "aspect_16x9"] as const;
export type CropKey = (typeof cropKeys)[number];

// ─── Tags JSON shape ──────────────────────────────────────────────────────────

export const creativeAssetTagsJsonSchema = z.object({
  concept: z.string().optional(),
  format: z.string().optional(),
  persona: z.string().optional(),
  occasion: z.string().optional(),
  offer: z.string().optional(),
  hook_family: z.string().optional(),
  cta: z.string().optional(),
  visual_style: z.string().optional(),
  audience_tag: z.string().optional(),
});

export type CreativeAssetTagsJson = z.infer<typeof creativeAssetTagsJsonSchema>;

// ─── Brief input (validated by orchestrator) ─────────────────────────────────

export const voiceFamilyValues = [
  "warm_conversational_female",
  "upbeat_female",
  "calm_premium_female",
  "friendly_gift_guide",
] as const;

export type VoiceFamilyValue = (typeof voiceFamilyValues)[number];

export const targetAspectRatioValues = ["9:16", "1:1", "4:5", "16:9"] as const;
export type TargetAspectRatio = (typeof targetAspectRatioValues)[number];

// Per-card copy for carousel
export const carouselCardSchema = z.object({
  hook: z.string().min(1).max(500),
  body: z.string().min(1).max(1000),
  cta: z.string().min(1).max(200),
  visualPrompt: z.string().min(1).max(2000),
});
export type CarouselCard = z.infer<typeof carouselCardSchema>;

/** Phase 7a: element_ids shape stored on creative_briefs.element_ids */
export const briefElementIdsSchema = z.object({
  hook_id: z.string().optional(),
  body_id: z.string().optional(),
  cta_id: z.string().optional(),
  visual_style_id: z.string().optional(),
  mix_match_parent_brief_id: z.string().optional(),
});

export type BriefElementIds = z.infer<typeof briefElementIdsSchema>;

export const creativeBriefInputSchema = z.object({
  kind: z.enum(creativeBriefKindValues),
  concept: z.string().min(1).max(200),
  format: z.string().min(1).max(100),
  hook: z.string().min(1).max(500),
  body: z.string().min(1).max(1000),
  cta: z.string().min(1).max(200),
  persona: z.string().max(100).nullish(),
  occasion: z.string().max(100).nullish(),
  offerCode: z.string().max(50).nullish(),
  visualPrompt: z.string().min(1).max(2000),
  voiceFamily: z.enum(voiceFamilyValues).nullish(),
  tags: creativeAssetTagsJsonSchema.optional(),
  // Optional override — if provided the orchestrator uses it directly
  caption: z.string().max(2000).nullish(),
  // ─── Canva Connect autofill (Phase 2b) ─────────────────────────────────────
  /** Canva Brand Template ID — required to activate the autofill overlay step */
  canvaTemplateId: z.string().max(200).nullish(),
  /**
   * Maps Canva template field keys to brief copy properties.
   * Values must be one of: 'hook' | 'body' | 'cta' | 'hero_image'.
   * Defaults to DEFAULT_CANVA_FIELD_MAPPING when omitted.
   */
  canvaFieldMapping: z
    .record(z.string(), z.enum(["hook", "body", "cta", "hero_image"]))
    .optional(),
  // ─── Sharp compositor (alternative to Canva) ───────────────────────────────
  /**
   * Pick a server-side layout for the static hero. When set, the
   * orchestrator runs the sharp compositor after Gemini, overlaying
   * hook/body/cta per the named variant. Ignored when `canvaTemplateId`
   * is also set (Canva takes precedence). Omit to skip compositing —
   * the raw Gemini hero is used as-is.
   */
  compositorVariant: z
    .enum(["hero_v1", "hero_v2", "hero_v3", "before_after"])
    .nullish(),
  /**
   * Public URL for the original source photo. Required for the
   * "before_after" compositor variant — the orchestrator composites
   * [source photo | coloring page] before applying text overlays.
   */
  sourcePhotoUrl: z.string().url().nullish(),
  /**
   * Pre-rendered hero image URL. When set, the orchestrator skips the
   * Gemini render step entirely and uses this image as the base for
   * the compositor. Used to recycle vetted coloring pages from the
   * seed library or previously-consented customer samples — zero
   * per-ad image-gen cost.
   */
  heroImageUrl: z.string().url().nullish(),
  // ─── Phase 7a: copy element IDs ────────────────────────────────────────────
  /**
   * When present, the orchestrator hydrates actual copy text from the DB using
   * getCopyElementById. Inline hook/body/cta must still be provided as
   * fallback values (used if element hydration fails or DB is unconfigured).
   */
  elementIds: briefElementIdsSchema.nullish(),
  // ─── carousel_image fields ──────────────────────────────────────────────────
  /** Number of cards in the carousel (3–10, default 5). */
  cardCount: z.number().int().min(3).max(10).optional().default(5),
  /** Per-card copy. If absent, derived automatically from base brief. */
  cards: z.array(carouselCardSchema).optional(),
  // ─── Video kind fields ──────────────────────────────────────────────────────
  /** Target video duration in seconds (5–90, default 15). Used by video kinds. */
  targetDurationSeconds: z.number().min(5).max(90).optional().default(15),
  /** Custom narration script. If absent, derived from hook + body + cta. */
  narrationScript: z.string().max(5000).optional(),
  /** Target aspect ratio for video output (default 9:16 for Reels). */
  targetAspectRatio: z.enum(targetAspectRatioValues).optional().default("9:16"),
});

/** The type callers pass into produceCreative() — fields with .default() are optional. */
export type CreativeBriefInput = z.input<typeof creativeBriefInputSchema>;

/** The internal parsed type after Zod defaults are applied — used inside orchestrator/producers. */
export type CreativeBriefParsed = z.infer<typeof creativeBriefInputSchema>;

// ─── DB-shaped rows (loosely typed mirror of schema.ts) ──────────────────────

export type CreativeBrief = {
  id: string;
  kind: CreativeBriefKind;
  concept: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  persona: string | null;
  occasion: string | null;
  offerCode: string | null;
  visualPrompt: string;
  voiceFamily: string | null;
  briefVersion: string;
  deterministicSeed: string | null;
  elementIds: BriefElementIds | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreativeAsset = {
  id: string;
  briefId: string | null;
  source: CreativeAssetSource;
  kind: CreativeAssetKind;
  parentAssetId: string | null;
  gcsBucket: string;
  gcsObject: string;
  mimeType: string;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: string | null;
  tagsJson: CreativeAssetTagsJson;
  complianceStatus: CreativeAssetComplianceStatus;
  complianceCheckedAt: Date | null;
  complianceReportJson: Record<string, unknown> | null;
  consentSource: string | null;
  consentProof: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Orchestrator result ──────────────────────────────────────────────────────

/** Per-card result for carousel_image kind */
export type CarouselCardResult = {
  heroAssetId: string;
  cropAssetIds: {
    aspect_1x1: string;
    aspect_4x5: string;
  };
};

export type ProduceResult = {
  briefId: string;
  /** Present for static_image kind */
  heroAssetId?: string;
  /** Present for static_image kind */
  crops?: {
    aspect_1x1: string;
    aspect_4x5: string;
    aspect_9x16: string;
    aspect_16x9: string;
  };
  /** Present for carousel_image kind */
  cards?: CarouselCardResult[];
  /** Present for video kinds */
  videoAssetId?: string;
  /** Present for video kinds — actual duration of the rendered video */
  durationSeconds?: number;
  /** Present when audio was uploaded separately (UGC / slideshow) */
  audioAssetId?: string;
  complianceStatus: "passed" | "warned" | "rejected";
  metadata?: {
    /** Set when the Canva autofill pipeline ran successfully */
    canvaDesignId?: string;
    /** Set to true when Canva was attempted but failed; raw Gemini hero was used */
    canvaFailed?: boolean;
    /** Human-readable error message from the failed Canva step */
    canvaError?: string;
  };
};

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class MissingClientError extends Error {
  constructor(clientName: string, requiredBy: string) {
    super(
      `[creative/orchestrator] ${clientName} client is required for '${requiredBy}' kind but was not provided in ProduceCreativeOptions.`,
    );
    this.name = "MissingClientError";
  }
}

export class VideoGenerationError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[creative/video] ${stage}: ${message}`);
    this.name = "VideoGenerationError";
  }
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export type ComplianceIssue = {
  code: string;
  message: string;
  evidence?: string;
};

export type ComplianceReport = {
  status: "passed" | "warned" | "rejected";
  warnings: ComplianceIssue[];
  errors: ComplianceIssue[];
  policyVersion: string;
};

// ─── Custom errors ────────────────────────────────────────────────────────────

export class ComplianceRejectedError extends Error {
  constructor(public readonly report: ComplianceReport) {
    super(`Creative brief rejected by compliance scanner: ${report.errors.map((e) => e.code).join(", ")}`);
    this.name = "ComplianceRejectedError";
  }
}

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`);
    this.name = "NotImplementedError";
  }
}
