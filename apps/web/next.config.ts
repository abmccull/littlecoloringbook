import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: [
    "@littlecolorbook/shared",
    "@littlecolorbook/db",
    "@littlecolorbook/pipeline",
    "@littlecolorbook/meta",
    "@littlecolorbook/ads",
    "@littlecolorbook/queue",
    "@littlecolorbook/jobs",
    "@littlecolorbook/social",
    "@littlecolorbook/creative",
    "@littlecolorbook/gamma",
    "@littlecolorbook/voiceover",
  ],
};

const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default sentryOrg && sentryProject
  ? withSentryConfig(nextConfig, {
      org: sentryOrg,
      project: sentryProject,
      authToken: sentryAuthToken,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      tunnelRoute: "/monitoring",
    })
  : nextConfig;
