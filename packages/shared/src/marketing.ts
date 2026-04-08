import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OfferCode } from "./offers";

export const marketingOfferIds = [
  "sample-free",
  "pdf-10",
  "pdf-30",
  "pdf-50",
  "pdf-100",
  "print-30",
  "print-50",
  "print-100",
] as const satisfies readonly OfferCode[];

export const marketingPlatforms = ["tiktok", "instagram_reels", "meta_ads", "pinterest", "email"] as const;
export const marketingOrderStyles = [
  "sample",
  "pdf_preview",
  "print_mockup",
  "bundle_mockup",
  "proof_pair",
  "book_preview",
  "cover_variant",
  "proof_video",
] as const;
export const marketingBundleOffers = ["none", "solo", "sibling_set", "sibling_trio", "custom"] as const;
export const marketingAspectRatios = ["9:16", "4:5", "1:1", "3:4", "16:9"] as const;
export const marketingOutputFormats = ["png", "jpeg", "webp", "mp4"] as const;
export const marketingVoiceFamilies = [
  "warm_conversational_female",
  "upbeat_female",
  "calm_premium_female",
  "friendly_gift_guide",
] as const;
export const marketingExperimentModes = ["early_account", "mature_account"] as const;
export const marketingWinnerStatuses = ["winner", "near_winner", "neutral", "loser", "fatigued"] as const;
export const marketingRecommendedActions = [
  "exploit",
  "adjacent",
  "explore",
  "pause",
  "promote_to_paid",
  "localize",
  "retire",
] as const;
export const marketingAssetTypes = [
  "sample_page",
  "before_after_pair",
  "book_preview_image",
  "book_preview_video",
  "print_mockup",
  "cover_variant",
  "ugc_b_roll",
  "thumbnail",
] as const;

export type MarketingOfferId = (typeof marketingOfferIds)[number];
export type MarketingPlatform = (typeof marketingPlatforms)[number];
export type MarketingOrderStyle = (typeof marketingOrderStyles)[number];
export type MarketingBundleOffer = (typeof marketingBundleOffers)[number];
export type MarketingVoiceFamily = (typeof marketingVoiceFamilies)[number];
export type MarketingExperimentMode = (typeof marketingExperimentModes)[number];
export type MarketingWinnerStatus = (typeof marketingWinnerStatuses)[number];
export type MarketingRecommendedAction = (typeof marketingRecommendedActions)[number];
export type MarketingAssetType = (typeof marketingAssetTypes)[number];

export const marketingOfferIdSchema = z.enum(marketingOfferIds);
export const marketingPlatformSchema = z.enum(marketingPlatforms);
export const marketingOrderStyleSchema = z.enum(marketingOrderStyles);
export const marketingBundleOfferSchema = z.enum(marketingBundleOffers);
export const marketingVoiceFamilySchema = z.enum(marketingVoiceFamilies);
export const marketingExperimentModeSchema = z.enum(marketingExperimentModes);
export const marketingWinnerStatusSchema = z.enum(marketingWinnerStatuses);
export const marketingRecommendedActionSchema = z.enum(marketingRecommendedActions);
export const marketingAssetTypeSchema = z.enum(marketingAssetTypes);

const optionalTrimmedString = z.string().trim().min(1).optional().nullable();

export const internalProductAssetRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  sourceAssetIds: z.array(z.string().trim().min(1)).min(1),
  orderStyle: marketingOrderStyleSchema,
  offerId: marketingOfferIdSchema,
  pageCountOffer: z.number().int().min(1),
  deliveryMode: z.enum(["pdf", "print"]).optional(),
  bundleOffer: marketingBundleOfferSchema.default("none"),
  childFirstName: z.string().trim().max(80).optional().nullable(),
  occasion: z.string().trim().max(80).optional().nullable(),
  outputFormats: z.array(z.enum(marketingOutputFormats)).min(1),
  aspectRatios: z.array(z.enum(marketingAspectRatios)).min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const internalProductAssetResponseAssetSchema = z.object({
  assetId: z.string().trim().min(1),
  assetType: marketingAssetTypeSchema,
  sourceAssetIds: z.array(z.string().trim().min(1)).optional(),
  storageUrl: z.string().trim().min(1),
  previewUrl: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  width: z.number().int().min(1).optional().nullable(),
  height: z.number().int().min(1).optional().nullable(),
  durationMs: z.number().int().min(1).optional().nullable(),
  offerId: marketingOfferIdSchema,
  pageCountOffer: z.number().int().min(1),
  bundleOffer: marketingBundleOfferSchema,
  occasion: z.string().trim().max(80).optional().nullable(),
  renderProfile: z.string().trim().max(120).optional().nullable(),
  createdAt: z.string().datetime(),
});

export const internalProductAssetResponseSchema = z.object({
  requestId: z.string().trim().min(1),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  assets: z.array(internalProductAssetResponseAssetSchema),
  provider: z.enum(["internal-renderer", "gemini"]),
  createdAt: z.string().datetime(),
  error: z.string().trim().optional().nullable(),
});

export const marketingArcadsBatchVariantSchema = z.object({
  avatarId: z.string().trim().min(1),
  deliveryStyle: z.string().trim().min(1),
  visualStyle: z.string().trim().min(1),
  durationTarget: z.number().int().min(1).max(180),
});

export const marketingArcadsBatchCreateRequestSchema = z.object({
  scriptFamilyId: z.string().trim().min(1),
  scriptText: z.string().trim().min(1),
  variants: z.array(marketingArcadsBatchVariantSchema).min(1),
  cutawayAssetIds: z.array(z.string().trim().min(1)).default([]),
  offerId: marketingOfferIdSchema,
  occasion: optionalTrimmedString,
  platform: marketingPlatformSchema,
  ctaText: z.string().trim().max(240).optional().nullable(),
});

export const marketingVoiceRenderRequestSchema = z.object({
  scriptText: z.string().trim().min(1),
  voiceId: z.string().trim().min(1),
  voiceFamily: marketingVoiceFamilySchema,
  emotionStyle: z.string().trim().max(80).optional().nullable(),
  language: z.string().trim().min(2).max(16),
  speed: z.number().positive().max(3).default(1),
  outputFormat: z.enum(["mp3", "wav"]).default("mp3"),
});

export const metricsDailyRowSchema = z.object({
  assetId: z.string().trim().min(1),
  platform: marketingPlatformSchema,
  accountId: optionalTrimmedString,
  campaignId: optionalTrimmedString,
  adsetId: optionalTrimmedString,
  adId: optionalTrimmedString,
  publishDate: z.string().date().optional().nullable(),
  reportDate: z.string().date(),
  views: z.number().min(0).optional().nullable(),
  impressions: z.number().min(0).optional().nullable(),
  spend: z.number().min(0).optional().nullable(),
  hookRate: z.number().min(0).optional().nullable(),
  holdRate: z.number().min(0).optional().nullable(),
  watchThroughRate: z.number().min(0).optional().nullable(),
  ctr: z.number().min(0).optional().nullable(),
  cpc: z.number().min(0).optional().nullable(),
  cpm: z.number().min(0).optional().nullable(),
  profileVisits: z.number().min(0).optional().nullable(),
  shares: z.number().min(0).optional().nullable(),
  saves: z.number().min(0).optional().nullable(),
  comments: z.number().min(0).optional().nullable(),
  landingPageSessions: z.number().min(0).optional().nullable(),
  landingPageOptIns: z.number().min(0).optional().nullable(),
  optInRate: z.number().min(0).optional().nullable(),
  purchases: z.number().min(0).optional().nullable(),
  purchaseRate: z.number().min(0).optional().nullable(),
  revenue: z.number().min(0).optional().nullable(),
  cac: z.number().min(0).optional().nullable(),
  printAttachRate: z.number().min(0).optional().nullable(),
  bundleAttachRate: z.number().min(0).optional().nullable(),
  offerId: marketingOfferIdSchema.optional().nullable(),
  occasion: optionalTrimmedString,
  personaId: optionalTrimmedString,
  voiceId: optionalTrimmedString,
  formatId: optionalTrimmedString,
});

export const marketingMetricsDailyIngestRequestSchema = z.object({
  reportDate: z.string().date(),
  rows: z.array(z.unknown()).default([]),
});

export const experimentDecisionSchema = z.object({
  assetId: z.string().trim().min(1),
  reportDate: z.string().date(),
  organicScore: z.number().optional().nullable(),
  paidScore: z.number().optional().nullable(),
  winnerStatus: marketingWinnerStatusSchema,
  fatigueStatus: z.enum(["fresh", "stable", "watch", "fatigued"]).optional().nullable(),
  recommendedAction: marketingRecommendedActionSchema,
  reasonCodes: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const marketingExperimentsRankRequestSchema = z.object({
  reportDate: z.string().date(),
  mode: marketingExperimentModeSchema.default("early_account"),
  rows: z.array(metricsDailyRowSchema).optional(),
});

export const marketingQueueAssetSchema = z.object({
  assetId: z.string().trim().min(1),
  platform: marketingPlatformSchema,
  caption: z.string().trim().max(4000).optional().nullable(),
  offerId: marketingOfferIdSchema.optional().nullable(),
  occasion: optionalTrimmedString,
  notes: z.string().trim().max(1000).optional().nullable(),
  publishAt: z.string().datetime().optional().nullable(),
});

export const marketingPublishWindowSchema = z.object({
  platform: marketingPlatformSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const marketingOrganicQueueRequestSchema = z.object({
  date: z.string().date(),
  assets: z.array(marketingQueueAssetSchema).default([]),
  publishWindows: z.array(marketingPublishWindowSchema).default([]),
});

export const marketingPaidQueueRequestSchema = z.object({
  date: z.string().date(),
  assets: z.array(marketingQueueAssetSchema).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const marketingWeeklySynthesisRequestSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  topAssets: z.array(z.string().trim().min(1)).default([]),
  topLearnings: z.array(z.string().trim().min(1)).default([]),
  kills: z.array(z.string().trim().min(1)).default([]),
  scaleRecommendations: z.array(z.string().trim().min(1)).default([]),
  occasion: z.string().trim().max(80).optional().nullable(),
});

export type InternalProductAssetRequest = z.infer<typeof internalProductAssetRequestSchema>;
export type InternalProductAssetResponse = z.infer<typeof internalProductAssetResponseSchema>;
export type InternalProductAssetResponseAsset = z.infer<typeof internalProductAssetResponseAssetSchema>;
export type MarketingArcadsBatchCreateRequest = z.infer<typeof marketingArcadsBatchCreateRequestSchema>;
export type MarketingVoiceRenderRequest = z.infer<typeof marketingVoiceRenderRequestSchema>;
export type MetricsDailyRow = z.infer<typeof metricsDailyRowSchema>;
export type MarketingMetricsDailyIngestRequest = z.infer<typeof marketingMetricsDailyIngestRequestSchema>;
export type ExperimentDecision = z.infer<typeof experimentDecisionSchema>;
export type MarketingExperimentsRankRequest = z.infer<typeof marketingExperimentsRankRequestSchema>;
export type MarketingOrganicQueueRequest = z.infer<typeof marketingOrganicQueueRequestSchema>;
export type MarketingPaidQueueRequest = z.infer<typeof marketingPaidQueueRequestSchema>;
export type MarketingWeeklySynthesisRequest = z.infer<typeof marketingWeeklySynthesisRequestSchema>;

export function createMarketingRequestId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}
