"use client";

import { useEffect } from "react";
import { trackEvent } from "./analytics-provider";

type TrackPageEventProps = {
  eventName: string;
  eventProperties?: Record<string, unknown>;
};

export function TrackPageEvent({ eventName, eventProperties }: TrackPageEventProps) {
  useEffect(() => {
    trackEvent(eventName, eventProperties ?? {});
  }, [eventName, eventProperties]);

  return null;
}
