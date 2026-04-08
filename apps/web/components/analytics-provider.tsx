"use client";

import { useEffect } from "react";
import Script from "next/script";
import posthog from "posthog-js";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    posthog?: typeof posthog;
  }
}

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const analyticsDebug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

let posthogInitialized = false;

function debugAnalytics(eventName: string, properties: Record<string, unknown>) {
  if (analyticsDebug) {
    console.info("[analytics]", eventName, properties);
  }
}

export function trackEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }

  if (gaMeasurementId && typeof window.gtag === "function") {
    window.gtag("event", eventName, properties);
  }

  if (window.posthog) {
    window.posthog.capture(eventName, properties);
  }

  debugAnalytics(eventName, properties);
}

export function AnalyticsProvider() {
  useEffect(() => {
    if (!posthogKey || posthogInitialized) {
      return;
    }

    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: false,
      persistence: "localStorage+cookie",
    });

    window.posthog = posthog;
    posthogInitialized = true;
  }, []);

  return (
    <>
      {gaMeasurementId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
          <Script id="littlecolorbook-ga" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}');
            `}
          </Script>
        </>
      ) : null}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
