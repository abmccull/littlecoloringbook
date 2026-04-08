import { z } from "zod";

export type LuluEnv = {
  luluClientKey: string;
  luluClientSecret: string;
  luluApiBaseUrl: string;
  luluAuthTokenUrl: string;
  luluPodPackageId?: string;
};

export type ServerEnv = LuluEnv & {
  geminiApiKey: string;
};

export type StorageEnv = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  uploadsBucket: string;
  exportsBucket: string;
};

export type EmailEnv = {
  resendApiKey: string;
  fromEmail: string;
  supportEmail: string;
};

export type AnalyticsEnv = {
  gaMeasurementId: string | null;
  posthogKey: string | null;
  posthogHost: string;
  analyticsDebug: boolean;
};

const rawLuluEnvSchema = z.object({
  LULU_CLIENT_KEY: z.string().min(1, "LULU_CLIENT_KEY is required"),
  LULU_CLIENT_SECRET: z.string().min(1, "LULU_CLIENT_SECRET is required"),
  LULU_API_BASE_URL: z.string().url().default("https://api.lulu.com"),
  LULU_AUTH_TOKEN_URL: z.string().url().optional(),
  LULU_POD_PACKAGE_ID: z.string().min(1).optional(),
});

const rawGeminiEnvSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

const rawStorageEnvSchema = z.object({
  GCS_PROJECT_ID: z.string().min(1, "GCS_PROJECT_ID is required"),
  GCS_CLIENT_EMAIL: z.string().email("GCS_CLIENT_EMAIL must be a valid service-account email"),
  GCS_PRIVATE_KEY: z.string().min(1, "GCS_PRIVATE_KEY is required"),
  GCS_BUCKET_UPLOADS: z.string().min(1, "GCS_BUCKET_UPLOADS is required"),
  GCS_BUCKET_EXPORTS: z.string().min(1, "GCS_BUCKET_EXPORTS is required"),
});

const rawEmailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().email("RESEND_FROM_EMAIL must be a valid sender email"),
  SUPPORT_EMAIL: z.string().email("SUPPORT_EMAIL must be a valid support email").default("support@littlecolorbook.com"),
});

function getDefaultLuluAuthTokenUrl(apiBaseUrl: string) {
  return new URL("/auth/realms/glasstree/protocol/openid-connect/token", apiBaseUrl).toString();
}

export function getLuluEnv(): LuluEnv {
  const parsed = rawLuluEnvSchema.parse({
    LULU_CLIENT_KEY: process.env.LULU_CLIENT_KEY,
    LULU_CLIENT_SECRET: process.env.LULU_CLIENT_SECRET,
    LULU_API_BASE_URL: process.env.LULU_API_BASE_URL ?? "https://api.lulu.com",
    LULU_AUTH_TOKEN_URL: process.env.LULU_AUTH_TOKEN_URL,
    LULU_POD_PACKAGE_ID: process.env.LULU_POD_PACKAGE_ID,
  });

  return {
    luluClientKey: parsed.LULU_CLIENT_KEY,
    luluClientSecret: parsed.LULU_CLIENT_SECRET,
    luluApiBaseUrl: parsed.LULU_API_BASE_URL,
    luluAuthTokenUrl: parsed.LULU_AUTH_TOKEN_URL ?? getDefaultLuluAuthTokenUrl(parsed.LULU_API_BASE_URL),
    luluPodPackageId: parsed.LULU_POD_PACKAGE_ID,
  };
}

export function getServerEnv(): ServerEnv {
  const luluEnv = getLuluEnv();
  const geminiEnv = rawGeminiEnvSchema.parse({
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });

  const geminiApiKey = geminiEnv.GEMINI_API_KEY ?? geminiEnv.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!geminiApiKey) {
    throw new Error("Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.");
  }

  return {
    ...luluEnv,
    geminiApiKey,
  };
}

export function getEmailEnv(): EmailEnv {
  const parsed = rawEmailEnvSchema.parse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL ?? "support@littlecolorbook.com",
  });

  return {
    resendApiKey: parsed.RESEND_API_KEY,
    fromEmail: parsed.RESEND_FROM_EMAIL,
    supportEmail: parsed.SUPPORT_EMAIL,
  };
}

export function getAnalyticsEnv(): AnalyticsEnv {
  return {
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null,
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null,
    posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    analyticsDebug: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true",
  };
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function getStorageEnv(): StorageEnv {
  const parsed = rawStorageEnvSchema.parse({
    GCS_PROJECT_ID: process.env.GCS_PROJECT_ID,
    GCS_CLIENT_EMAIL: process.env.GCS_CLIENT_EMAIL,
    GCS_PRIVATE_KEY: process.env.GCS_PRIVATE_KEY,
    GCS_BUCKET_UPLOADS: process.env.GCS_BUCKET_UPLOADS,
    GCS_BUCKET_EXPORTS: process.env.GCS_BUCKET_EXPORTS,
  });

  return {
    projectId: parsed.GCS_PROJECT_ID,
    clientEmail: parsed.GCS_CLIENT_EMAIL,
    privateKey: parsed.GCS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    uploadsBucket: parsed.GCS_BUCKET_UPLOADS,
    exportsBucket: parsed.GCS_BUCKET_EXPORTS,
  };
}

export function getIntegrationStatus() {
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY;

  return {
    luluConfigured: Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET),
    luluPodPackageConfigured: Boolean(process.env.LULU_POD_PACKAGE_ID),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && stripePublishableKey && process.env.APP_URL),
    stripePublishableConfigured: Boolean(stripePublishableKey),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripeAccountConfigured: Boolean(process.env.STRIPE_ACCOUNT_ID),
    resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    clerkConfigured: Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    emailConfigured: isEmailConfigured(),
    gcsConfigured: Boolean(
      process.env.GCS_PROJECT_ID &&
        process.env.GCS_CLIENT_EMAIL &&
        process.env.GCS_PRIVATE_KEY &&
        process.env.GCS_BUCKET_UPLOADS &&
        process.env.GCS_BUCKET_EXPORTS,
    ),
    gaConfigured: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    posthogConfigured: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    internalJobsProtected: Boolean(process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET),
    luluApiBaseUrl: process.env.LULU_API_BASE_URL ?? "https://api.lulu.com",
    luluAuthTokenUrl:
      process.env.LULU_AUTH_TOKEN_URL ?? getDefaultLuluAuthTokenUrl(process.env.LULU_API_BASE_URL ?? "https://api.lulu.com"),
  };
}

export function getLuluBasicAuthHeader() {
  const env = getLuluEnv();
  return `Basic ${Buffer.from(`${env.luluClientKey}:${env.luluClientSecret}`).toString("base64")}`;
}
