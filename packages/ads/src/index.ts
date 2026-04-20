export { createCampaign, updateCampaign, pauseCampaign, getCampaign } from "./campaigns";
export { createAdSet, updateAdSet, pauseAdSet, getAdSet } from "./adsets";
export { createAd, updateAd, pauseAd, getAd } from "./ads";
export { uploadAdImage, uploadAdImageRaw, uploadAdImageBufferRaw } from "./adimages";
export { createAdCreative, createAdCreativeFromPost } from "./creatives";
export { fetchAdsInsights } from "./insights";
export { createCustomAudience, createLookalikeAudience } from "./audiences";
export { generateDailyBriefs, buildBanditArmsFromPerformance } from "./brief-generator";
export { bundledCampaignTaxonomy } from "./campaign-taxonomy";
export type { LearnedPriors, ElementPriorRow, SamplingMode } from "./brief-generator";
export {
  sampleBeta,
  thompsonSample,
  topK,
  confidenceInterval95,
  retirementCandidates,
  hotStreakCandidates,
} from "./thompson-sampling";
export type { BanditArm } from "./thompson-sampling";
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
export { executeProposal } from "./agent-executor";
export type { ProposalExecutionContext, ExecuteProposalResult } from "./agent-executor";
export {
  agentProposalInputSchema,
  classifyProposalApproval,
  pauseAdPayloadSchema,
  scaleBudgetPayloadSchema,
  duplicateToScalingCampaignPayloadSchema,
  requestCreativePayloadSchema,
  updateTargetingPayloadSchema,
  updateAudiencePayloadSchema,
  reportInsightPayloadSchema,
  flagRiskPayloadSchema,
} from "./agent-proposals";
export type { AgentProposalInput, AgentProposalKind } from "./agent-proposals";
export { computeOutcomeDelta } from "./outcome-reflection";
export type { MetricsSummary, OutcomeDelta } from "./outcome-reflection";
