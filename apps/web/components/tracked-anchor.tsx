"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import type { BuyerJourneyStage } from "../lib/buyer-journey";
import { trackBuyerJourneyStage, trackEvent } from "./analytics-provider";

type TrackedAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventName: string;
  eventProperties?: Record<string, unknown>;
  journeyStage?: BuyerJourneyStage;
  journeyProperties?: Record<string, unknown>;
  journeyOnceKey?: string;
};

export function TrackedAnchor({
  eventName,
  eventProperties,
  journeyStage,
  journeyProperties,
  journeyOnceKey,
  onClick,
  ...props
}: TrackedAnchorProps) {
  return (
    <a
      {...props}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        trackEvent(eventName, eventProperties ?? {});

        if (journeyStage) {
          trackBuyerJourneyStage(journeyStage, journeyProperties ?? {}, {
            onceKey: journeyOnceKey,
          });
        }

        onClick?.(event);
      }}
    />
  );
}
