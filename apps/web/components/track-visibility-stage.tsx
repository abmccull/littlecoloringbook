"use client";

import { useEffect } from "react";
import type { BuyerJourneyStage } from "../lib/buyer-journey";
import { trackBuyerJourneyStage } from "./analytics-provider";

type TrackVisibilityStageProps = {
  targetId: string;
  stage: BuyerJourneyStage;
  stageProperties?: Record<string, unknown>;
  onceKey?: string;
  threshold?: number;
};

export function TrackVisibilityStage({
  targetId,
  stage,
  stageProperties,
  onceKey,
  threshold = 0.35,
}: TrackVisibilityStageProps) {
  useEffect(() => {
    const node = document.getElementById(targetId);

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const hasReachedThreshold = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= threshold,
        );

        if (!hasReachedThreshold) {
          return;
        }

        trackBuyerJourneyStage(stage, stageProperties ?? {}, { onceKey });
        observer.disconnect();
      },
      {
        threshold: [threshold],
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [onceKey, stage, stageProperties, targetId, threshold]);

  return null;
}
