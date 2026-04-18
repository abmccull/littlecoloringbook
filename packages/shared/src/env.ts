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

export type ElevenLabsEnv = {
  apiKey: string;
  apiBaseUrl: string;
  modelId: string;
};

export type ArcadsEnv = {
  apiKey: string;
  apiUrl: string;
};

export type GammaEnv = {
  apiKey: string;
  apiBaseUrl: string;
};

export type MarketingVideoEnv = {
  apiKey: string | null;
  apiUrl: string;
};

export type ColoringEngineEnv = {
  apiUrl: string;
  timeoutMs: number;
};

export type EnvValidationIssue = {
  path: string;
  message: string;
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
  GCS_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GCS_CLIENT_EMAIL: z.string().optional(),
  GCS_PRIVATE_KEY: z.string().optional(),
  GCS_BUCKET_UPLOADS: z.string().min(1, "GCS_BUCKET_UPLOADS is required"),
  GCS_BUCKET_EXPORTS: z.string().min(1, "GCS_BUCKET_EXPORTS is required"),
});

const rawEmailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().email("RESEND_FROM_EMAIL must be a valid sender email"),
  SUPPORT_EMAIL: z.string().email("SUPPORT_EMAIL must be a valid support email").default("support@littlecolorbook.com"),
});

const rawElevenLabsEnvSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  ELEVENLABS_API_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
  ELEVENLABS_MODEL_ID: z.string().min(1).default("eleven_multilingual_v2"),
});

const rawArcadsEnvSchema = z.object({
  ARCADS_API_KEY: z.string().min(1, "ARCADS_API_KEY is required"),
  ARCADS_API_URL: z.string().url("ARCADS_API_URL must be a valid URL"),
});

const rawGammaEnvSchema = z.object({
  GAMMA_API_KEY: z.string().min(1, "GAMMA_API_KEY is required"),
  GAMMA_API_BASE_URL: z.string().url().default("https://public-api.gamma.app/v1.0"),
});

const rawMarketingVideoEnvSchema = z.object({
  MARKETING_VIDEO_API_KEY: z.string().optional(),
  MARKETING_VIDEO_API_URL: z.string().url("MARKETING_VIDEO_API_URL must be a valid URL"),
});

const rawColoringEngineEnvSchema = z.object({
  COLORING_ENGINE_URL: z.string().url("COLORING_ENGINE_URL must be a valid URL"),
  COLORING_ENGINE_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
});

function getDefaultLuluAuthTokenUrl(apiBaseUrl: string) {
  return new URL("/auth/realms/glasstree/protocol/openid-connect/token", apiBaseUrl).toString();
}

function getNonEmptyEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getResolvedLuluApiBaseUrl() {
  return getNonEmptyEnvValue(process.env.LULU_API_BASE_URL) ?? "https://api.lulu.com";
}

function formatZodIssues(issues: z.ZodIssue[]): EnvValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
  }));
}

function getRawStorageEnv() {
  return {
    GCS_SERVICE_ACCOUNT_JSON_BASE64: process.env.GCS_SERVICE_ACCOUNT_JSON_BASE64,
    GCS_PROJECT_ID: process.env.GCS_PROJECT_ID,
    GCS_CLIENT_EMAIL: process.env.GCS_CLIENT_EMAIL,
    GCS_PRIVATE_KEY: process.env.GCS_PRIVATE_KEY,
    GCS_BUCKET_UPLOADS: process.env.GCS_BUCKET_UPLOADS,
    GCS_BUCKET_EXPORTS: process.env.GCS_BUCKET_EXPORTS,
  };
}

function decodeStorageServiceAccount(base64Value: string) {
  const normalized = base64Value.trim();

  if (!normalized) {
    throw new Error("GCS_SERVICE_ACCOUNT_JSON_BASE64 is empty.");
  }

  const decoded = Buffer.from(normalized, "base64").toString("utf8");
  const parsed = z
    .object({
      project_id: z.string().min(1, "service account project_id is required"),
      client_email: z.string().email("service account client_email must be a valid service-account email"),
      private_key: z.string().min(1, "service account private_key is required"),
    })
    .parse(JSON.parse(decoded));

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

export function getStorageEnvIssues() {
  const parsed = rawStorageEnvSchema.safeParse(getRawStorageEnv());

  if (!parsed.success) {
    return formatZodIssues(parsed.error.issues);
  }

  if (parsed.data.GCS_SERVICE_ACCOUNT_JSON_BASE64) {
    try {
      decodeStorageServiceAccount(parsed.data.GCS_SERVICE_ACCOUNT_JSON_BASE64);
    } catch (error) {
      return [
        {
          path: "GCS_SERVICE_ACCOUNT_JSON_BASE64",
          message: error instanceof Error ? error.message : "GCS_SERVICE_ACCOUNT_JSON_BASE64 is invalid",
        },
      ];
    }

    return [];
  }

  const issues: EnvValidationIssue[] = [];

  if (!parsed.data.GCS_PROJECT_ID?.trim()) {
    issues.push({ path: "GCS_PROJECT_ID", message: "GCS_PROJECT_ID is required" });
  }

  if (!parsed.data.GCS_CLIENT_EMAIL?.trim()) {
    issues.push({ path: "GCS_CLIENT_EMAIL", message: "GCS_CLIENT_EMAIL is required" });
  } else if (!z.string().email().safeParse(parsed.data.GCS_CLIENT_EMAIL).success) {
    issues.push({ path: "GCS_CLIENT_EMAIL", message: "GCS_CLIENT_EMAIL must be a valid service-account email" });
  }

  if (!parsed.data.GCS_PRIVATE_KEY?.trim()) {
    issues.push({ path: "GCS_PRIVATE_KEY", message: "GCS_PRIVATE_KEY is required" });
  }

  return issues;
}

export function isStorageConfigured() {
  return getStorageEnvIssues().length === 0;
}

export function getLuluEnv(): LuluEnv {
  const parsed = rawLuluEnvSchema.parse({
    LULU_CLIENT_KEY: process.env.LULU_CLIENT_KEY,
    LULU_CLIENT_SECRET: process.env.LULU_CLIENT_SECRET,
    LULU_API_BASE_URL: getResolvedLuluApiBaseUrl(),
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

export function getElevenLabsEnv(): ElevenLabsEnv {
  const parsed = rawElevenLabsEnvSchema.parse({
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_API_BASE_URL: process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io",
    ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
  });

  return {
    apiKey: parsed.ELEVENLABS_API_KEY,
    apiBaseUrl: parsed.ELEVENLABS_API_BASE_URL.replace(/\/$/, ""),
    modelId: parsed.ELEVENLABS_MODEL_ID,
  };
}

export function getArcadsEnv(): ArcadsEnv {
  const parsed = rawArcadsEnvSchema.parse({
    ARCADS_API_KEY: process.env.ARCADS_API_KEY,
    ARCADS_API_URL: process.env.ARCADS_API_URL,
  });

  return {
    apiKey: parsed.ARCADS_API_KEY,
    apiUrl: parsed.ARCADS_API_URL,
  };
}

export function getGammaEnv(): GammaEnv {
  const parsed = rawGammaEnvSchema.parse({
    GAMMA_API_KEY: process.env.GAMMA_API_KEY,
    GAMMA_API_BASE_URL: process.env.GAMMA_API_BASE_URL ?? "https://public-api.gamma.app/v1.0",
  });

  return {
    apiKey: parsed.GAMMA_API_KEY,
    apiBaseUrl: parsed.GAMMA_API_BASE_URL.replace(/\/$/, ""),
  };
}

export function getMarketingVideoEnv(): MarketingVideoEnv {
  const parsed = rawMarketingVideoEnvSchema.parse({
    MARKETING_VIDEO_API_KEY: process.env.MARKETING_VIDEO_API_KEY,
    MARKETING_VIDEO_API_URL: process.env.MARKETING_VIDEO_API_URL,
  });

  return {
    apiKey: parsed.MARKETING_VIDEO_API_KEY ?? null,
    apiUrl: parsed.MARKETING_VIDEO_API_URL,
  };
}

export function getColoringEngineEnv(): ColoringEngineEnv {
  const parsed = rawColoringEngineEnvSchema.parse({
    COLORING_ENGINE_URL: process.env.COLORING_ENGINE_URL,
    COLORING_ENGINE_TIMEOUT_MS: process.env.COLORING_ENGINE_TIMEOUT_MS ?? "90000",
  });

  return {
    apiUrl: parsed.COLORING_ENGINE_URL.replace(/\/$/, ""),
    timeoutMs: parsed.COLORING_ENGINE_TIMEOUT_MS,
  };
}

export function isColoringEngineConfigured() {
  return Boolean(process.env.COLORING_ENGINE_URL);
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

// ─── Meta / Facebook env ─────────────────────────────────────────────────────
// All keys are optional until Phase 0 provisioning is complete.
// becomes required once Phase 0 assets are provisioned

export type MetaEnv = {
  appId: string | null;
  appSecret: string | null;
  systemUserToken: string | null;
  businessId: string | null;
  adAccountId: string | null;
  pageId: string | null;
  igUserId: string | null;
  pixelId: string | null;
  datasetId: string | null;
  catalogId: string | null;
  graphApiVersion: string;
  webhookVerifyToken: string | null;
  webhookAppSecret: string | null;
  testEventCode: string | null;
};

const rawMetaEnvSchema = z.object({
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_SYSTEM_USER_TOKEN: z.string().optional(),
  META_BUSINESS_ID: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(), // format: act_<numeric>
  META_PAGE_ID: z.string().optional(),
  META_IG_USER_ID: z.string().optional(),
  META_PIXEL_ID: z.string().optional(),
  META_DATASET_ID: z.string().optional(), // typically == META_PIXEL_ID but exposed separately
  META_CATALOG_ID: z.string().optional(), // optional phase 6
  META_GRAPH_API_VERSION: z.string().default("v22.0"),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_WEBHOOK_APP_SECRET: z.string().optional(),
  META_TEST_EVENT_CODE: z.string().optional(), // optional, for CAPI test mode
});

export function getMetaEnv(): MetaEnv {
  const parsed = rawMetaEnvSchema.parse({
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_SYSTEM_USER_TOKEN: process.env.META_SYSTEM_USER_TOKEN,
    META_BUSINESS_ID: process.env.META_BUSINESS_ID,
    META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID,
    META_PAGE_ID: process.env.META_PAGE_ID,
    META_IG_USER_ID: process.env.META_IG_USER_ID,
    META_PIXEL_ID: process.env.META_PIXEL_ID,
    META_DATASET_ID: process.env.META_DATASET_ID,
    META_CATALOG_ID: process.env.META_CATALOG_ID,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION ?? "v22.0",
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
    META_WEBHOOK_APP_SECRET: process.env.META_WEBHOOK_APP_SECRET,
    META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
  });

  return {
    appId: parsed.META_APP_ID ?? null,
    appSecret: parsed.META_APP_SECRET ?? null,
    systemUserToken: parsed.META_SYSTEM_USER_TOKEN ?? null,
    businessId: parsed.META_BUSINESS_ID ?? null,
    adAccountId: parsed.META_AD_ACCOUNT_ID ?? null,
    pageId: parsed.META_PAGE_ID ?? null,
    igUserId: parsed.META_IG_USER_ID ?? null,
    pixelId: parsed.META_PIXEL_ID ?? null,
    datasetId: parsed.META_DATASET_ID ?? parsed.META_PIXEL_ID ?? null,
    catalogId: parsed.META_CATALOG_ID ?? null,
    graphApiVersion: parsed.META_GRAPH_API_VERSION,
    webhookVerifyToken: parsed.META_WEBHOOK_VERIFY_TOKEN ?? null,
    webhookAppSecret: parsed.META_WEBHOOK_APP_SECRET ?? null,
    testEventCode: parsed.META_TEST_EVENT_CODE ?? null,
  };
}

export function isMetaConfigured() {
  return Boolean(
    process.env.META_SYSTEM_USER_TOKEN &&
      process.env.META_AD_ACCOUNT_ID &&
      process.env.META_PIXEL_ID,
  );
}

// ─── Canva env ────────────────────────────────────────────────────────────────
// becomes required once Phase 0 assets are provisioned

export type CanvaEnv = {
  clientId: string | null;
  clientSecret: string | null;
  accessToken: string | null;
  /** OAuth refresh_token obtained during the one-time human authorization flow */
  refreshToken: string | null;
  /** Base URL for the Canva Connect REST API (default: https://api.canva.com/rest/v1) */
  apiBaseUrl: string;
  /** Set to 'true' to enable the Canva autofill overlay step in creative production */
  templateAutofillEnabled: boolean;
};

const rawCanvaEnvSchema = z.object({
  CANVA_CLIENT_ID: z.string().optional(),
  CANVA_CLIENT_SECRET: z.string().optional(),
  CANVA_ACCESS_TOKEN: z.string().optional(),
  CANVA_REFRESH_TOKEN: z.string().optional(),
  CANVA_API_BASE_URL: z.string().url().default("https://api.canva.com/rest/v1"),
  CANVA_TEMPLATE_AUTOFILL_ENABLED: z.string().default("false"),
});

export function getCanvaEnv(): CanvaEnv {
  const parsed = rawCanvaEnvSchema.parse({
    CANVA_CLIENT_ID: process.env.CANVA_CLIENT_ID,
    CANVA_CLIENT_SECRET: process.env.CANVA_CLIENT_SECRET,
    CANVA_ACCESS_TOKEN: process.env.CANVA_ACCESS_TOKEN,
    CANVA_REFRESH_TOKEN: process.env.CANVA_REFRESH_TOKEN,
    CANVA_API_BASE_URL: process.env.CANVA_API_BASE_URL ?? "https://api.canva.com/rest/v1",
    CANVA_TEMPLATE_AUTOFILL_ENABLED: process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED ?? "false",
  });

  return {
    clientId: parsed.CANVA_CLIENT_ID ?? null,
    clientSecret: parsed.CANVA_CLIENT_SECRET ?? null,
    accessToken: parsed.CANVA_ACCESS_TOKEN ?? null,
    refreshToken: parsed.CANVA_REFRESH_TOKEN ?? null,
    apiBaseUrl: parsed.CANVA_API_BASE_URL.replace(/\/$/, ""),
    templateAutofillEnabled: parsed.CANVA_TEMPLATE_AUTOFILL_ENABLED === "true",
  };
}

// ─── Kling env ────────────────────────────────────────────────────────────────
// becomes required once Phase 0 assets are provisioned

export type KlingEnv = {
  apiKey: string | null;
  apiBaseUrl: string;
};

const rawKlingEnvSchema = z.object({
  KLING_API_KEY: z.string().optional(),
  KLING_API_BASE_URL: z.string().url().default("https://api.klingai.com"),
});

export function getKlingEnv(): KlingEnv {
  const parsed = rawKlingEnvSchema.parse({
    KLING_API_KEY: process.env.KLING_API_KEY,
    KLING_API_BASE_URL: process.env.KLING_API_BASE_URL ?? "https://api.klingai.com",
  });

  return {
    apiKey: parsed.KLING_API_KEY ?? null,
    apiBaseUrl: parsed.KLING_API_BASE_URL.replace(/\/$/, ""),
  };
}

// ─── Luma env ─────────────────────────────────────────────────────────────────
// becomes required once Phase 0 assets are provisioned

export type LumaEnvType = {
  apiKey: string | null;
};

export function getLumaEnv(): LumaEnvType {
  return {
    apiKey: process.env.LUMA_API_KEY ?? null,
  };
}

// ─── Agent control plane env ──────────────────────────────────────────────────
// becomes required once Phase 0 assets are provisioned

export type AgentEnv = {
  apiKey: string | null;
  approvalWebhook: string | null;
};

export function getAgentEnv(): AgentEnv {
  return {
    apiKey: process.env.AGENT_API_KEY ?? null,
    approvalWebhook: process.env.AGENT_APPROVAL_WEBHOOK ?? null,
  };
}

export function getStorageEnv(): StorageEnv {
  const parsed = rawStorageEnvSchema.parse(getRawStorageEnv());

  if (parsed.GCS_SERVICE_ACCOUNT_JSON_BASE64) {
    const serviceAccount = decodeStorageServiceAccount(parsed.GCS_SERVICE_ACCOUNT_JSON_BASE64);

    return {
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
      uploadsBucket: parsed.GCS_BUCKET_UPLOADS,
      exportsBucket: parsed.GCS_BUCKET_EXPORTS,
    };
  }

  return {
    projectId: z.string().min(1).parse(parsed.GCS_PROJECT_ID),
    clientEmail: z.string().email().parse(parsed.GCS_CLIENT_EMAIL),
    privateKey: z.string().min(1).parse(parsed.GCS_PRIVATE_KEY).replace(/\\n/g, "\n"),
    uploadsBucket: parsed.GCS_BUCKET_UPLOADS,
    exportsBucket: parsed.GCS_BUCKET_EXPORTS,
  };
}

export function getIntegrationStatus() {
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY;
  const luluApiBaseUrl = getResolvedLuluApiBaseUrl();
  const luluAuthTokenUrl = getNonEmptyEnvValue(process.env.LULU_AUTH_TOKEN_URL) ?? getDefaultLuluAuthTokenUrl(luluApiBaseUrl);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  const coloringEngineConfigured = isColoringEngineConfigured();
  const gcsConfigured = isStorageConfigured();
  const rendererConfigured = geminiConfigured || coloringEngineConfigured;

  return {
    luluConfigured: Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET),
    luluPodPackageConfigured: Boolean(process.env.LULU_POD_PACKAGE_ID),
    geminiConfigured,
    coloringEngineConfigured,
    rendererConfigured,
    marketingRendererConfigured: rendererConfigured && gcsConfigured,
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    arcadsConfigured: Boolean(process.env.ARCADS_API_KEY && process.env.ARCADS_API_URL),
    gammaConfigured: Boolean(process.env.GAMMA_API_KEY),
    marketingVideoConfigured: Boolean(process.env.MARKETING_VIDEO_API_URL),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && stripePublishableKey && process.env.APP_URL),
    stripePublishableConfigured: Boolean(stripePublishableKey),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripeAccountConfigured: Boolean(process.env.STRIPE_ACCOUNT_ID),
    resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    adminAuthConfigured: Boolean((process.env.ADMIN_EMAILS ?? "").trim()),
    emailConfigured: isEmailConfigured(),
    gcsConfigured,
    gaConfigured: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    posthogConfigured: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    internalJobsProtected: Boolean(process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET),
    luluApiBaseUrl,
    luluAuthTokenUrl,
  };
}

export function getLuluBasicAuthHeader() {
  const env = getLuluEnv();
  return `Basic ${Buffer.from(`${env.luluClientKey}:${env.luluClientSecret}`).toString("base64")}`;
}

// ─── Anthropic / Claude env ───────────────────────────────────────────────────
// All keys are optional — if ANTHROPIC_API_KEY is absent, scanWithLlm falls
// through to the regex-only result silently (no error thrown).

export type AnthropicEnv = {
  apiKey: string | null;
  model: string;
  llmComplianceTimeoutMs: number;
};

const rawAnthropicEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  CREATIVE_LLM_COMPLIANCE_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

export function getAnthropicEnv(): AnthropicEnv {
  const parsed = rawAnthropicEnvSchema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
    CREATIVE_LLM_COMPLIANCE_TIMEOUT_MS: process.env.CREATIVE_LLM_COMPLIANCE_TIMEOUT_MS ?? "15000",
  });

  return {
    apiKey: parsed.ANTHROPIC_API_KEY ?? null,
    model: parsed.ANTHROPIC_MODEL,
    llmComplianceTimeoutMs: parsed.CREATIVE_LLM_COMPLIANCE_TIMEOUT_MS,
  };
}

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
