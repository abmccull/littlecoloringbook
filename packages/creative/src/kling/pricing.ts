// Kling credit pricing table — source of truth for budget estimation
// before we submit a job. Kling does NOT expose a balance endpoint, so
// we enforce the monthly cap client-side using these estimates plus
// the `credits_spent` returned on the completion response.
//
// Numbers sourced from Kling's February 2026 pricing page and
// community-validated rates for older models (see
// tasks/kling-research-2026-04-20.md in the research output).
//
// Treat these as UPPER BOUNDS. Actual billed credits are stored on the
// kling_usage row after the job completes; budget enforcement uses
// max(estimated, spent) when computing spend.

import type { KlingModel, KlingMode, KlingResolution } from "./types";

type PricingKey = `${KlingModel}/${KlingMode}/${KlingResolution}`;

// Credits per second of output video, no audio. With audio adds +3–4
// credits/s on supported models; voice control add-on is +2/s. Those
// surcharges are layered on in `estimateCredits` below.
const CREDITS_PER_SECOND: Partial<Record<PricingKey, number>> = {
  "kling-v1-6/std/720p": 2, // ~10 credits for 5s
  "kling-v1-6/pro/1080p": 7, // ~35 credits for 5s
  "kling-v2-0/pro/1080p": 7, // Master-tier only
  "kling-v2-1/std/720p": 3,
  "kling-v2-1/pro/1080p": 7, // recommended sweet spot, ~35 credits/5s
  "kling-v3-0/std/720p": 6, // Kling 3.0 published
  "kling-v3-0/pro/1080p": 8, // Kling 3.0 published, audio-off rate
};

export type EstimateInput = {
  model: KlingModel;
  mode: KlingMode;
  resolution: KlingResolution;
  /** Output duration in seconds. Kling API caps at 5 or 10 today. */
  durationSec: number;
  withAudio?: boolean;
  withVoiceControl?: boolean;
};

/**
 * Estimate credit cost for a single Kling generation. Always returns
 * an integer (credits are whole units). Throws if the model/mode/
 * resolution combo is unknown so we fail closed rather than silently
 * under-estimate.
 */
export function estimateCredits(input: EstimateInput): number {
  const key: PricingKey = `${input.model}/${input.mode}/${input.resolution}`;
  const baseRate = CREDITS_PER_SECOND[key];
  if (baseRate == null) {
    throw new Error(
      `Unknown Kling pricing for ${key}. Update packages/creative/src/kling/pricing.ts when a new model/mode ships.`,
    );
  }
  const audioSurcharge = input.withAudio ? 3 : 0;
  const voiceSurcharge = input.withVoiceControl ? 2 : 0;
  const perSecond = baseRate + audioSurcharge + voiceSurcharge;
  return Math.ceil(perSecond * input.durationSec);
}

/**
 * How many clips fit in a credit budget at a given model/mode/
 * resolution/duration. Handy for dashboards + pacing math.
 */
export function capacityInBudget(budget: number, input: EstimateInput): number {
  const perClip = estimateCredits(input);
  return perClip === 0 ? Infinity : Math.floor(budget / perClip);
}
