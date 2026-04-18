import { z } from "zod";

export type AdObjective =
  | "OUTCOME_SALES"
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_APP_PROMOTION";

export type OptimizationGoal =
  | "OFFSITE_CONVERSIONS"
  | "LINK_CLICKS"
  | "IMPRESSIONS"
  | "LANDING_PAGE_VIEWS"
  | "LEAD_GENERATION"
  | "THRUPLAY"
  | "REACH"
  | "PAGE_LIKES";

export type AdStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export type BillingEvent = "IMPRESSIONS" | "LINK_CLICKS" | "THRUPLAY";

// Meta's targeting spec is enormous; we use a permissive shape with typed
// minimum fields. Callers may pass any additional targeting keys.
export type TargetingSpec = {
  geo_locations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
  };
  age_min?: number;
  age_max?: number;
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  [key: string]: unknown;
};

export const targetingSpecSchema: z.ZodType<TargetingSpec> = z
  .object({
    geo_locations: z
      .object({
        countries: z.array(z.string()).optional(),
        regions: z.array(z.object({ key: z.string() })).optional(),
        cities: z
          .array(
            z.object({
              key: z.string(),
              radius: z.number().optional(),
              distance_unit: z.string().optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    age_min: z.number().int().min(13).max(65).optional(),
    age_max: z.number().int().min(13).max(65).optional(),
    publisher_platforms: z.array(z.string()).optional(),
    facebook_positions: z.array(z.string()).optional(),
    instagram_positions: z.array(z.string()).optional(),
  })
  .passthrough();

export const ADS_INSIGHTS_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "spend",
  "cpm",
  "cpc",
  "ctr",
  "cpp",
  "frequency",
  "actions",
  "action_values",
  "cost_per_action_type",
  "unique_clicks",
  "unique_ctr",
  "inline_link_clicks",
  "inline_link_click_ctr",
  "video_thruplay_watched_actions",
  "video_play_curve_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "outbound_clicks",
  "outbound_clicks_ctr",
  "website_ctr",
  "date_start",
  "date_stop",
] as const;

export type AdsInsightsField = (typeof ADS_INSIGHTS_FIELDS)[number];

export const adsInsightsFieldSchema = z.enum(ADS_INSIGHTS_FIELDS);

// Brief produced by generateDailyBriefs for one ad slot.
export type AdBrief = {
  slotKey: string;
  concept: string;
  format: string;
  persona: string;
  occasion: string;
  offerCode: string;
  hook: string;
  body: string;
  cta: string;
  visualPrompt: string;
  imageAssetIds?: string[];
  linkUrl: string;
};

// Returned from Meta Graph API campaign/adset/ad create calls.
export type MetaCreateResult = { id: string };

export class AdsApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly subcode: number | null,
    message: string,
  ) {
    super(message);
    this.name = "AdsApiError";
  }
}
