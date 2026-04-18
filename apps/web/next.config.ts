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
  // Packages with native bindings or platform-conditional requires.
  // Turbopack can't resolve @ffmpeg-installer's optional per-platform
  // sub-packages; marking external so Next resolves at runtime instead.
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "sharp",
    "@anthropic-ai/sdk",
    "@google-cloud/storage",
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
