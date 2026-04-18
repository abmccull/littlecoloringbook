import { z } from "zod";

// ─── Enum value arrays (mirrors DB schema) ────────────────────────────────────

export const creativeBriefKindValues = [
  "static_image",
  "carousel_image",
  "stop_motion_reveal",
  "ugc_narrated",
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
  voiceFamily: z.string().max(100).nullish(),
  tags: creativeAssetTagsJsonSchema.optional(),
  // Optional override — if provided the orchestrator uses it directly
  caption: z.string().max(2000).nullish(),
});

export type CreativeBriefInput = z.infer<typeof creativeBriefInputSchema>;

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

export type ProduceResult = {
  briefId: string;
  heroAssetId: string;
  crops: {
    aspect_1x1: string;
    aspect_4x5: string;
    aspect_9x16: string;
    aspect_16x9: string;
  };
  complianceStatus: "passed" | "warned" | "rejected";
};

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
