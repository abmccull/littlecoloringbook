"use client";

import { useEffect } from "react";
import type { BuyerJourneyStage } from "../lib/buyer-journey";
import { trackBuyerJourneyStage } from "./analytics-provider";

type TrackBuyerJourneyStageProps = {
  stage: BuyerJourneyStage;
  stageProperties?: Record<string, unknown>;
  onceKey?: string;
  enabled?: boolean;
};

export function TrackBuyerJourneyStage({
  stage,
  stageProperties,
  onceKey,
  enabled = true,
}: TrackBuyerJourneyStageProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    trackBuyerJourneyStage(stage, stageProperties ?? {}, { onceKey });
  }, [enabled, onceKey, stage, stageProperties]);

  return null;
}
