export { createCampaign, updateCampaign, pauseCampaign, getCampaign } from "./campaigns";
export { createAdSet, updateAdSet, pauseAdSet, getAdSet } from "./adsets";
export { createAd, updateAd, pauseAd, getAd } from "./ads";
export { uploadAdImageRaw, createAdCreative, createAdCreativeFromPost } from "./creatives";
export { fetchAdsInsights } from "./insights";
export { createCustomAudience, createLookalikeAudience } from "./audiences";
export { generateDailyBriefs } from "./brief-generator";
export {
  evaluateKillRules,
  evaluateWinnerRules,
  evaluateFatigue,
  parseRulesFromTaxonomy,
} from "./rules";
export type {
  MetricsSnapshot,
  RuleDecision,
  KillRules,
  WinnerRules,
  FatigueOptions,
} from "./rules";
export type {
  AdObjective,
  OptimizationGoal,
  AdStatus,
  BillingEvent,
  TargetingSpec,
  AdsInsightsField,
  AdBrief,
  MetaCreateResult,
  AdsApiError,
} from "./types";
export { targetingSpecSchema, adsInsightsFieldSchema, ADS_INSIGHTS_FIELDS } from "./types";
