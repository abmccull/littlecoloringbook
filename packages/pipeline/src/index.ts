import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { assertColoringPageQC, type ColoringPageQcResult } from "./coloring-page-qc";
import {
  asRecord,
  estimateInteriorPageCount,
  extractGeneratedImage,
  normalizeCoverStyle,
  type DeliveryMode,
  type RenderFallback,
} from "@littlecolorbook/shared";
import { downloadObject } from "@littlecolorbook/shared/storage";
import { getTrim, getSpineWidth, ensurePageCountParity } from "@littlecolorbook/pdf-templates";
import type { BookPayload, OccasionId, OccasionContext, StyleId, TrimSpec } from "@littlecolorbook/pdf-templates";

export const cleanupSteps = [
  "normalize-grayscale",
  "threshold-line-art",
  "remove-specks",
  "strengthen-outlines",
  "safe-margin-check",
] as const;

export const qaChecklist = [
  "subject-readable",
  "background-clean",
  "trim-safe",
  "line-weight-consistent",
  "kid-friendly-detail-level",
] as const;

// 2026-04-21: promoted the minimal prompt to production after a 50-photo
// A/B run (see `tmp/eval-run-eval-2026-04-21-local/scores.json`): Gemini
// 3 Pro with the minimal 5-sentence prompt averaged 4.92/5 vs the old
// prompt's 3.30/5 on the same sources, with zero losses. Same run showed
// 2.5 Flash + minimal underperformed the old prompt (2.68/5), so the
// escalation ladder now starts at 3 Pro instead of climbing up to it.
export const pipelinePromptVersion = "2026-04-21.minimal";
export const pipelineCleanupVersion = "2026-04-12.a";

export type PipelineJobKind = "sample" | "full_book";
// Kept as a type alias (vs an inline literal) so adding a future provider
// doesn't require a wide refactor. The custom-python coloring engine was
// decommissioned 2026-04-16 per HANDOFF.md.
export type PipelineProvider = "gemini";

type GeminiImageSize = "1K" | "2K" | "4K";

export type PipelineImageSize = GeminiImageSize;

type RasterSize = {
  height: number;
  width: number;
};

type PdfPageConfig = {
  height: number;
  margin: number;
  width: number;
};

const FINAL_PAGE_SIZE: RasterSize = {
  width: 2400,
  height: 3105,
};

const PREVIEW_PAGE_SIZE: RasterSize = {
  width: 960,
  height: 1242,
};

const DIGITAL_PDF_PAGE: PdfPageConfig = {
  width: 612,
  height: 792,
  margin: 18,
};

const PRINT_PDF_PAGE: PdfPageConfig = {
  width: 630,
  height: 810,
  margin: 18,
};

const PRINT_COVER_PAGE = {
  width: 1242,
  height: 810,
};

const TIER_1_MODEL = "gemini-2.5-flash-image";
const TIER_2_MODEL = "gemini-3.1-flash-image-preview";
const TIER_3_MODEL = "gemini-3-pro-image-preview";
// Post-2026-04-21: ladder contains only Pro. Flash tiers kept as named
// constants so env overrides (GEMINI_IMAGE_ATTEMPT_N_MODEL) still resolve,
// but the default path never escalates to or from them.
const ESCALATION_LADDER = [TIER_3_MODEL] as const;

const PRIMARY_IMAGE_MODEL = TIER_3_MODEL;
const FALLBACK_IMAGE_MODEL = TIER_3_MODEL;
const MAX_RENDER_ATTEMPTS = 2;
const DEFAULT_ASPECT_RATIO = "3:4";
const DEFAULT_FULL_BOOK_CONCURRENCY = 4;
const DEFAULT_SAMPLE_CONCURRENCY = 1;

export type PlannedGenerationPage = {
  cleanupSteps: readonly string[];
  generatedImagePath: string;
  pageNumber: number;
  previewImagePath: string;
  qaChecklist: readonly string[];
  sourceUploadId: string | null;
};

export type PlannedPdfAssets = {
  coverPdfPath: string | null;
  coverPdfPaths: string[];
  downloadPdfPath: string;
  interiorPdfPath: string;
};

export type GenerationPlan = {
  deliveryMode: DeliveryMode;
  designCount: number;
  interiorPageCount: number;
  jobKind: PipelineJobKind;
  orderId: string;
  pages: PlannedGenerationPage[];
  pdf: PlannedPdfAssets;
  targetPages: number;
};

export type SourceUpload = {
  contentType?: string | null;
  fileName: string;
  id?: string | null;
  objectPath: string;
};

export type MaterializedAsset = {
  body: Buffer | string;
  contentType: string;
  kind: "generated_page" | "preview" | "interior_pdf" | "cover_pdf" | "download_pdf";
  objectPath: string;
  pageNumber?: number | null;
};

export type ProviderQualityMetrics = {
  blackRatio: number | null;
  edgeDensity: number | null;
  lineClosureScore: number | null;
  noiseRatio: number | null;
};

export type PageQualityMetrics = {
  finalBlackRatio: number;
  finalLargestDarkComponentRatio: number;
  finalSpeckleRatio: number;
  finalNoisyComponentCount: number;
  providerBlackRatio: number | null;
  providerEdgeDensity: number | null;
  providerLineClosureScore: number | null;
  providerNoiseRatio: number | null;
};

export type MaterializedPageResult = {
  pageNumber: number;
  sourceUploadId: string | null;
  provider: PipelineProvider;
  model: string;
  imageSize: GeminiImageSize;
  promptVersion: string;
  cleanupVersion: string;
  renderAttempts: number;
  costCents: number;
  costBreakdown: GenerationCostBreakdown;
  qaScore: number;
  qaFlags: string[];
  qaMetrics: PageQualityMetrics;
};

export type MaterializedPageFailure = {
  pageNumber: number;
  sourceUploadId: string | null;
  provider: PipelineProvider | null;
  model: string | null;
  imageSize: GeminiImageSize | null;
  promptVersion: string;
  cleanupVersion: string;
  renderAttempts: number;
  costCents: number;
  costBreakdown: GenerationCostBreakdown | null;
  qaScore: number | null;
  qaFlags: string[];
  qaMetrics: PageQualityMetrics | null;
  message: string;
  previewAvailable: boolean;
};

export type MaterializedPlan = {
  assets: MaterializedAsset[];
  model: string;
  pageResults: MaterializedPageResult[];
  pageFailures: MaterializedPageFailure[];
  provider: PipelineProvider;
};

type ProcessedPageAsset = {
  blackRatio: number;
  finalPng: Buffer;
  largestDarkComponentRatio: number;
  noisyComponentCount: number;
  previewJpeg: Buffer;
  speckleRatio: number;
};

type RenderedPage = {
  buffer: Buffer;
  mimeType: string;
  model: string;
  provider: PipelineProvider;
  imageSize: GeminiImageSize;
  providerQa: ProviderQualityMetrics | null;
  providerQaFlags: string[];
  renderAttempts: number;
  costCents: number;
  costBreakdown: GenerationCostBreakdown;
  usageMetadata: GeminiUsageMetadata | null;
};

export type RenderedPageResult = ProcessedPageAsset & {
  cleanupVersion: string;
  model: string;
  imageSize: GeminiImageSize;
  promptVersion: string;
  provider: PipelineProvider;
  qaFlags: string[];
  qaMetrics: PageQualityMetrics;
  qaScore: number;
  renderAttempts: number;
  costCents: number;
  costBreakdown: GenerationCostBreakdown;
  passedQa: boolean;
  failureMessage: string | null;
};

type GeminiModalityTokenCount = {
  modality: string;
  tokenCount: number;
};

type GeminiUsageMetadata = {
  promptTokenCount: number | null;
  cachedContentTokenCount: number | null;
  candidatesTokenCount: number | null;
  toolUsePromptTokenCount: number | null;
  thoughtsTokenCount: number | null;
  totalTokenCount: number | null;
  promptTokensDetails: GeminiModalityTokenCount[];
  cacheTokensDetails: GeminiModalityTokenCount[];
  candidatesTokensDetails: GeminiModalityTokenCount[];
  toolUsePromptTokensDetails: GeminiModalityTokenCount[];
};

export type GeminiCostAttempt = {
  model: string;
  imageSize: GeminiImageSize;
  promptTokenCount: number | null;
  outputImageTokenCount: number | null;
  outputTextTokenCount: number | null;
  thoughtsTokenCount: number | null;
  inputCostCents: number;
  outputImageCostCents: number;
  outputTextCostCents: number;
  thoughtsCostCents: number;
  totalCostCents: number;
  source: "usage_metadata" | "fallback_pricing";
};

export type GenerationCostBreakdown = {
  provider: PipelineProvider;
  totalCostCents: number;
  attempts: GeminiCostAttempt[];
};

type PipelineRenderSettings = RenderFallback<PipelineProvider> & {
  imageSize: GeminiImageSize;
  model: string;
  provider: PipelineProvider;
};

type RenderingSource = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.");
  }

  return apiKey;
}

function getGeminiApiBaseUrl() {
  return (process.env.GEMINI_API_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
}

function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

function inferUploadMimeType(upload: SourceUpload) {
  if (upload.contentType?.startsWith("image/")) {
    return upload.contentType;
  }

  const fileName = upload.fileName.toLowerCase();

  if (fileName.endsWith(".png")) {
    return "image/png";
  }

  if (fileName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

function supportsImageSize(model: string) {
  return !model.startsWith("gemini-2.5-flash-image");
}

export function getPipelineRenderSettings(deliveryMode: DeliveryMode, jobKind: PipelineJobKind): PipelineRenderSettings {
  const defaultImageSize = deliveryMode === "print" ? "4K" : "2K";
  const imageSize =
    deliveryMode === "print"
      ? (process.env.GEMINI_IMAGE_SIZE_PRINT as GeminiImageSize | undefined) ?? defaultImageSize
      : jobKind === "sample"
        ? (process.env.GEMINI_IMAGE_SIZE_SAMPLE as GeminiImageSize | undefined) ?? "4K"
        : (process.env.GEMINI_IMAGE_SIZE as GeminiImageSize | undefined) ?? defaultImageSize;

  const model =
    deliveryMode === "print"
      ? process.env.GEMINI_IMAGE_MODEL_PRINT ?? process.env.GEMINI_IMAGE_MODEL ?? PRIMARY_IMAGE_MODEL
      : jobKind === "sample"
        ? process.env.GEMINI_IMAGE_MODEL_SAMPLE ?? process.env.GEMINI_IMAGE_MODEL ?? PRIMARY_IMAGE_MODEL
        : process.env.GEMINI_IMAGE_MODEL ?? PRIMARY_IMAGE_MODEL;

  // Gemini is the only supported provider since 2026-04-16.
  const provider: PipelineProvider = "gemini";
  const fallbackProvider: PipelineProvider | null = null;
  const selectedModel = model;
  const fallbackModel = null;

  return {
    fallbackModel,
    fallbackProvider,
    imageSize,
    model: selectedModel,
    provider,
  };
}

function getFallbackModel(primaryModel: string) {
  return process.env.GEMINI_IMAGE_FALLBACK_MODEL ?? (primaryModel === FALLBACK_IMAGE_MODEL ? PRIMARY_IMAGE_MODEL : FALLBACK_IMAGE_MODEL);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiErrorDetail(status: number, payload: Record<string, unknown> | null) {
  return (
    (payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
      ? payload.error.message
      : null) ?? `Gemini image generation failed with status ${status}.`
  );
}

function isRetryableGeminiFailure(status: number, detail: string) {
  const normalized = detail.toLowerCase();

  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  return (
    normalized.includes("high demand") ||
    normalized.includes("try again later") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("generate_requests_per_model")
  );
}

function getGeminiRetryBackoffMs(attempt: number, detail: string) {
  const normalized = detail.toLowerCase();
  const baseMs =
    normalized.includes("quota exceeded") || normalized.includes("generate_requests_per_model")
      ? 15000
      : 3000;

  return Math.min(baseMs * 2 ** attempt + Math.random() * 1000, 60000);
}

function getPlanConcurrency(jobKind: PipelineJobKind) {
  const configured =
    jobKind === "full_book"
      ? process.env.PIPELINE_CONCURRENCY_FULL_BOOK ?? process.env.PIPELINE_CONCURRENCY
      : process.env.PIPELINE_CONCURRENCY_SAMPLE ?? process.env.PIPELINE_CONCURRENCY;
  const fallback = jobKind === "full_book" ? DEFAULT_FULL_BOOK_CONCURRENCY : DEFAULT_SAMPLE_CONCURRENCY;
  const parsed = Number(configured ?? fallback);

  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function getEscalationModel(primaryModel: string, attempt: number): string {
  if (attempt === 0) return primaryModel;
  const envOverride = process.env[`GEMINI_IMAGE_ATTEMPT_${attempt}_MODEL`];
  if (envOverride) return envOverride;
  const primaryIdx = (ESCALATION_LADDER as readonly string[]).indexOf(primaryModel);
  if (primaryIdx === -1) {
    return TIER_3_MODEL;
  }
  const targetIdx = Math.min(primaryIdx + attempt, ESCALATION_LADDER.length - 1);
  return ESCALATION_LADDER[targetIdx];
}

type GeminiPricingConfig = {
  modelMatch: (model: string) => boolean;
  inputCentsPerMillion: number;
  outputTextCentsPerMillion: number;
  outputImageCentsPerMillion: number;
  fallbackImageTokensBySize: Partial<Record<GeminiImageSize, number>>;
};

const GEMINI_IMAGE_PRICING: GeminiPricingConfig[] = [
  {
    modelMatch: (model) => model.startsWith("gemini-3-pro-image-preview"),
    inputCentsPerMillion: 200,
    outputTextCentsPerMillion: 1200,
    outputImageCentsPerMillion: 12000,
    fallbackImageTokensBySize: {
      "1K": 1120,
      "2K": 1120,
      "4K": 2000,
    },
  },
  {
    modelMatch: (model) => model.startsWith("gemini-3.1-flash-image-preview"),
    inputCentsPerMillion: 50,
    outputTextCentsPerMillion: 300,
    outputImageCentsPerMillion: 6000,
    fallbackImageTokensBySize: {
      "1K": 1120,
      "2K": 1680,
      "4K": 2520,
    },
  },
  {
    modelMatch: (model) => model.startsWith("gemini-2.5-flash-image"),
    inputCentsPerMillion: 30,
    outputTextCentsPerMillion: 250,
    outputImageCentsPerMillion: 3000,
    fallbackImageTokensBySize: {
      "1K": 1290,
      "2K": 1290,
      "4K": 1290,
    },
  },
];

function resolveGeminiPricing(model: string) {
  return GEMINI_IMAGE_PRICING.find((config) => config.modelMatch(model)) ?? null;
}

function parseOptionalInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseGeminiModalityTokenCounts(value: unknown): GeminiModalityTokenCount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const modality = typeof record.modality === "string" ? record.modality : null;
      const tokenCount = parseOptionalInteger(record.tokenCount);

      if (!modality || tokenCount == null) {
        return null;
      }

      return { modality, tokenCount };
    })
    .filter((entry): entry is GeminiModalityTokenCount => entry !== null);
}

function parseGeminiUsageMetadata(payload: Record<string, unknown>): GeminiUsageMetadata | null {
  const usage = payload.usageMetadata;

  if (!usage || typeof usage !== "object") {
    return null;
  }

  const record = usage as Record<string, unknown>;

  return {
    promptTokenCount: parseOptionalInteger(record.promptTokenCount),
    cachedContentTokenCount: parseOptionalInteger(record.cachedContentTokenCount),
    candidatesTokenCount: parseOptionalInteger(record.candidatesTokenCount),
    toolUsePromptTokenCount: parseOptionalInteger(record.toolUsePromptTokenCount),
    thoughtsTokenCount: parseOptionalInteger(record.thoughtsTokenCount),
    totalTokenCount: parseOptionalInteger(record.totalTokenCount),
    promptTokensDetails: parseGeminiModalityTokenCounts(record.promptTokensDetails),
    cacheTokensDetails: parseGeminiModalityTokenCounts(record.cacheTokensDetails),
    candidatesTokensDetails: parseGeminiModalityTokenCounts(record.candidatesTokensDetails),
    toolUsePromptTokensDetails: parseGeminiModalityTokenCounts(record.toolUsePromptTokensDetails),
  };
}

function sumTokensForModality(details: GeminiModalityTokenCount[], modality: string) {
  return details.reduce((sum, detail) => sum + (detail.modality === modality ? detail.tokenCount : 0), 0);
}

function centsFromPerMillionTokens(tokenCount: number, centsPerMillion: number) {
  return Math.round((tokenCount * centsPerMillion) / 1_000_000);
}

function getFallbackImageTokenCount(model: string, imageSize: GeminiImageSize) {
  const pricing = resolveGeminiPricing(model);
  if (!pricing) {
    return null;
  }
  return (
    pricing.fallbackImageTokensBySize[imageSize] ??
    pricing.fallbackImageTokensBySize["2K"] ??
    pricing.fallbackImageTokensBySize["1K"] ??
    null
  );
}

function getLegacyGeminiFallbackCostCents(imageSize: GeminiImageSize) {
  const perImageCents = Number(process.env.GEMINI_COST_CENTS_PER_IMAGE ?? "4");
  const sizeMultiplier = imageSize === "4K" ? 2 : 1;
  return Math.max(1, Math.round(perImageCents * sizeMultiplier));
}

function buildGeminiCostAttempt(input: {
  imageSize: GeminiImageSize;
  model: string;
  usageMetadata: GeminiUsageMetadata | null;
}): GeminiCostAttempt {
  const pricing = resolveGeminiPricing(input.model);

  if (!pricing) {
    const fallbackCostCents = getLegacyGeminiFallbackCostCents(input.imageSize);
    return {
      model: input.model,
      imageSize: input.imageSize,
      promptTokenCount: null,
      outputImageTokenCount: null,
      outputTextTokenCount: null,
      thoughtsTokenCount: null,
      inputCostCents: 0,
      outputImageCostCents: fallbackCostCents,
      outputTextCostCents: 0,
      thoughtsCostCents: 0,
      totalCostCents: fallbackCostCents,
      source: "fallback_pricing",
    };
  }

  if (!input.usageMetadata) {
    const fallbackImageTokenCount = getFallbackImageTokenCount(input.model, input.imageSize) ?? 0;
    const outputImageCostCents = centsFromPerMillionTokens(fallbackImageTokenCount, pricing.outputImageCentsPerMillion);
    const totalCostCents = Math.max(outputImageCostCents, 1);
    return {
      model: input.model,
      imageSize: input.imageSize,
      promptTokenCount: null,
      outputImageTokenCount: fallbackImageTokenCount || null,
      outputTextTokenCount: null,
      thoughtsTokenCount: null,
      inputCostCents: 0,
      outputImageCostCents: totalCostCents,
      outputTextCostCents: 0,
      thoughtsCostCents: 0,
      totalCostCents,
      source: "fallback_pricing",
    };
  }

  const promptTokenCount = Math.max(0, input.usageMetadata.promptTokenCount ?? 0);
  const candidateTokenCount = Math.max(0, input.usageMetadata.candidatesTokenCount ?? 0);
  const detailedImageTokenCount = sumTokensForModality(input.usageMetadata.candidatesTokensDetails, "IMAGE");
  const fallbackImageTokenCount = getFallbackImageTokenCount(input.model, input.imageSize) ?? 0;
  const outputImageTokenCount =
    detailedImageTokenCount > 0
      ? detailedImageTokenCount
      : candidateTokenCount > 0
        ? candidateTokenCount
        : fallbackImageTokenCount;
  const outputTextTokenCount =
    candidateTokenCount > 0 && outputImageTokenCount >= 0
      ? Math.max(0, candidateTokenCount - outputImageTokenCount)
      : 0;
  const thoughtsTokenCount = Math.max(0, input.usageMetadata.thoughtsTokenCount ?? 0);

  const inputCostCents = centsFromPerMillionTokens(promptTokenCount, pricing.inputCentsPerMillion);
  const outputImageCostCents = centsFromPerMillionTokens(outputImageTokenCount, pricing.outputImageCentsPerMillion);
  const outputTextCostCents = centsFromPerMillionTokens(outputTextTokenCount, pricing.outputTextCentsPerMillion);
  const thoughtsCostCents = centsFromPerMillionTokens(thoughtsTokenCount, pricing.outputTextCentsPerMillion);
  const totalCostCents = Math.max(inputCostCents + outputImageCostCents + outputTextCostCents + thoughtsCostCents, 1);

  return {
    model: input.model,
    imageSize: input.imageSize,
    promptTokenCount,
    outputImageTokenCount,
    outputTextTokenCount,
    thoughtsTokenCount,
    inputCostCents,
    outputImageCostCents,
    outputTextCostCents,
    thoughtsCostCents,
    totalCostCents,
    source: "usage_metadata",
  };
}

// Kept for callers that already accept the shaped input (render loop,
// tests). The body returns the minimal 5-sentence prompt regardless of
// inputs — `childFirstName`, `deliveryMode`, `jobKind`, `pageNumber`,
// `qcCorrection`, and `sourceLabel` are accepted for signature compat
// but ignored: the 50-source A/B showed minimal-only beat every
// prompt-engineered variant. If a future change needs per-call
// variation, reintroduce it here deliberately, not as drift.
export function buildColoringPrompt(_input: {
  attempt: number;
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  qcCorrection?: string | null;
  sourceLabel: string;
}) {
  return buildColoringPromptMinimal();
}

export async function renderImageWithGemini(input: {
  attempt: number;
  deliveryMode: DeliveryMode;
  imageSize: GeminiImageSize;
  mimeType: string;
  model: string;
  prompt: string;
  sourceBuffer: Buffer;
}): Promise<RenderedPage> {
  const maxProviderRetries = Number(process.env.GEMINI_PROVIDER_RETRIES ?? "6");

  let response: Response | null = null;
  let payload: Record<string, unknown> | null = null;

  for (let providerRetry = 0; providerRetry <= maxProviderRetries; providerRetry++) {
    response = await fetch(`${getGeminiApiBaseUrl()}/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getGeminiApiKey(),
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: input.prompt,
              },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: input.sourceBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["Image"],
          imageConfig: {
            aspectRatio: DEFAULT_ASPECT_RATIO,
            ...(supportsImageSize(input.model) ? { imageSize: input.imageSize } : {}),
          },
        },
      }),
      cache: "no-store",
    });

    payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.ok && payload) {
      break;
    }

    const detail = getGeminiErrorDetail(response.status, payload);

    if (providerRetry < maxProviderRetries && isRetryableGeminiFailure(response.status, detail)) {
      await sleep(getGeminiRetryBackoffMs(providerRetry, detail));
      continue;
    }

    break;
  }

  if (!response!.ok || !payload) {
    throw new Error(getGeminiErrorDetail(response!.status, payload));
  }

  const imagePart = extractGeneratedImage(payload);
  const usageMetadata = parseGeminiUsageMetadata(payload);
  const costAttempt = buildGeminiCostAttempt({
    imageSize: input.imageSize,
    model: input.model,
    usageMetadata,
  });

  return {
    buffer: Buffer.from(imagePart.data, "base64"),
    mimeType: imagePart.mimeType,
    model: input.model,
    provider: "gemini",
    imageSize: input.imageSize,
    providerQa: null,
    providerQaFlags: [],
    renderAttempts: 1,
    costCents: costAttempt.totalCostCents,
    costBreakdown: {
      provider: "gemini",
      totalCostCents: costAttempt.totalCostCents,
      attempts: [costAttempt],
    },
    usageMetadata,
  } satisfies RenderedPage;
}

export function buildColoringPromptMinimal(): string {
  return [
    "You are converting this photo into a premium coloring book page for a child.",
    "Produce a clean black-and-white line drawing suitable for coloring with crayons or markers.",
    "Faithfully preserve the people, expressions, clothing, pets, and scene from the photograph.",
    "Use consistent line weight and closed contours.",
  ].join(" ");
}

export async function renderColoringPageOnce(input: {
  deliveryMode?: DeliveryMode;
  imageSize?: GeminiImageSize;
  mimeType: string;
  model: string;
  prompt: string;
  sourceBuffer: Buffer;
}): Promise<RenderedPage> {
  return renderImageWithGemini({
    attempt: 0,
    deliveryMode: input.deliveryMode ?? "pdf",
    imageSize: input.imageSize ?? "2K",
    mimeType: input.mimeType,
    model: input.model,
    prompt: input.prompt,
    sourceBuffer: input.sourceBuffer,
  });
}

async function measureBlackRatio(input: Buffer) {
  const { data } = await sharp(input).grayscale().raw().toBuffer({ resolveWithObject: true });
  let darkPixels = 0;

  for (const value of data) {
    if (value < 64) {
      darkPixels += 1;
    }
  }

  return darkPixels / data.length;
}

const QA_FLAG_THRESHOLDS = {
  maxLargestDarkComponentRatio: 0.08,
  maxNoisyComponentCount: 110,
  maxSpeckleRatio: 0.005,
} as const;

// Production hard-stop thresholds. The stricter flag thresholds above are still
// recorded on the page so operators can inspect borderline output, but we only
// block a paid-book page when the artifact is materially broken.
const QA_HARD_FAIL_THRESHOLDS = {
  minBlackRatio: 0.008,
  maxBlackRatio: 0.36,
  maxLargestDarkComponentRatio: 0.12,
  maxNoisyComponentCount: 240,
  maxSpeckleRatio: 0.025,
} as const;

function pagePassesQa(blackRatio: number) {
  return blackRatio >= QA_HARD_FAIL_THRESHOLDS.minBlackRatio && blackRatio <= QA_HARD_FAIL_THRESHOLDS.maxBlackRatio;
}

async function measureNoiseMetrics(input: Buffer) {
  const { data, info } = await sharp(input)
    .grayscale()
    .resize({
      width: 320,
      height: 414,
      fit: "inside",
      background: "#ffffff",
      withoutEnlargement: true,
    })
    .threshold(200)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  let noisyComponentCount = 0;
  let noisyPixelCount = 0;

  for (let index = 0; index < data.length; index += 1) {
    if (data[index] !== 0 || visited[index]) {
      continue;
    }

    let componentSize = 0;
    const stack = [index];
    visited[index] = 1;

    while (stack.length > 0) {
      const current = stack.pop()!;
      componentSize += 1;
      const x = current % width;
      const y = Math.floor(current / width);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }

          const nextX = x + offsetX;
          const nextY = y + offsetY;

          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          const nextIndex = nextY * width + nextX;

          if (data[nextIndex] === 0 && !visited[nextIndex]) {
            visited[nextIndex] = 1;
            stack.push(nextIndex);
          }
        }
      }
    }

    if (componentSize < 40) {
      noisyComponentCount += 1;
      noisyPixelCount += componentSize;
    }
  }

  return {
    noisyComponentCount,
    speckleRatio: noisyPixelCount / data.length,
  };
}

async function measureDarkMassMetrics(input: Buffer) {
  const { data, info } = await sharp(input)
    .grayscale()
    .resize({
      width: 320,
      height: 414,
      fit: "inside",
      background: "#ffffff",
      withoutEnlargement: true,
    })
    .threshold(96)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  let largestDarkComponent = 0;

  for (let index = 0; index < data.length; index += 1) {
    if (data[index] !== 0 || visited[index]) {
      continue;
    }

    let componentSize = 0;
    const stack = [index];
    visited[index] = 1;

    while (stack.length > 0) {
      const current = stack.pop()!;
      componentSize += 1;
      const x = current % width;
      const y = Math.floor(current / width);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }

          const nextX = x + offsetX;
          const nextY = y + offsetY;

          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          const nextIndex = nextY * width + nextX;

          if (data[nextIndex] === 0 && !visited[nextIndex]) {
            visited[nextIndex] = 1;
            stack.push(nextIndex);
          }
        }
      }
    }

    if (componentSize > largestDarkComponent) {
      largestDarkComponent = componentSize;
    }
  }

  return {
    largestDarkComponentRatio: largestDarkComponent / data.length,
  };
}

function processedPagePassesQa(
  input: { blackRatio: number; largestDarkComponentRatio: number; noisyComponentCount: number; speckleRatio: number },
) {
  return (
    pagePassesQa(input.blackRatio) &&
    input.largestDarkComponentRatio <= QA_HARD_FAIL_THRESHOLDS.maxLargestDarkComponentRatio &&
    input.noisyComponentCount <= QA_HARD_FAIL_THRESHOLDS.maxNoisyComponentCount &&
    input.speckleRatio <= QA_HARD_FAIL_THRESHOLDS.maxSpeckleRatio
  );
}

function getPostProcessQaFlags(
  input: { blackRatio: number; largestDarkComponentRatio: number; noisyComponentCount: number; speckleRatio: number },
) {
  const flags: string[] = [];

  if (input.blackRatio < 0.012) {
    flags.push("final_too_sparse");
  }
  if (input.blackRatio > 0.33) {
    flags.push("final_too_dense");
  }
  if (input.largestDarkComponentRatio > QA_FLAG_THRESHOLDS.maxLargestDarkComponentRatio) {
    flags.push("final_large_dark_mass");
  }
  if (input.noisyComponentCount > QA_FLAG_THRESHOLDS.maxNoisyComponentCount) {
    flags.push("final_fragmented");
  }
  if (input.speckleRatio > QA_FLAG_THRESHOLDS.maxSpeckleRatio) {
    flags.push("final_noisy");
  }

  return flags;
}

function calculateQaScore(input: { qaFlags: string[]; qaMetrics: PageQualityMetrics }) {
  const densityPenalty = Math.min(Math.abs(input.qaMetrics.finalBlackRatio - 0.12) / 0.18, 1) * 38;
  const darkMassPenalty =
    Math.min(input.qaMetrics.finalLargestDarkComponentRatio / QA_FLAG_THRESHOLDS.maxLargestDarkComponentRatio, 1) * 26;
  const specklePenalty = Math.min(input.qaMetrics.finalSpeckleRatio / QA_FLAG_THRESHOLDS.maxSpeckleRatio, 1) * 24;
  const fragmentationPenalty = Math.min(input.qaMetrics.finalNoisyComponentCount / QA_FLAG_THRESHOLDS.maxNoisyComponentCount, 1) * 18;
  const providerNoisePenalty =
    input.qaMetrics.providerNoiseRatio !== null ? Math.min(input.qaMetrics.providerNoiseRatio / 0.01, 1) * 8 : 0;
  const providerClosurePenalty =
    input.qaMetrics.providerLineClosureScore !== null ? (1 - input.qaMetrics.providerLineClosureScore) * 8 : 0;
  const flagPenalty = Math.min(input.qaFlags.length * 6, 18);

  return Number(
    Math.max(
      0,
      100 - densityPenalty - darkMassPenalty - specklePenalty - fragmentationPenalty - providerNoisePenalty - providerClosurePenalty - flagPenalty,
    ).toFixed(1),
  );
}

async function removeSmallBlackComponents(pngBuffer: Buffer, minComponentSize: number, foregroundThreshold: number = 128) {
  const raw = await sharp(pngBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });
  const { data: source, info } = raw;
  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;
  const data = Buffer.from(source);
  const visited = new Uint8Array(pixelCount);
  const stack: number[] = [];

  for (let index = 0; index < pixelCount; index += 1) {
    if (data[index] >= foregroundThreshold || visited[index]) continue;

    stack.length = 0;
    stack.push(index);
    visited[index] = 1;
    const component: number[] = [index];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const x = current % width;
      const y = (current - x) / width;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (data[ni] < foregroundThreshold && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
            component.push(ni);
          }
        }
      }
    }

    if (component.length < minComponentSize) {
      for (const idx of component) {
        data[idx] = 255;
      }
    }
  }

  return sharp(data, { raw: { width, height, channels: info.channels } }).png().toBuffer();
}

async function cleanupGeneratedPage(input: {
  deliveryMode: DeliveryMode;
  imageBuffer: Buffer;
  provider: PipelineProvider;
  providerBlackRatio?: number | null;
  providerNoiseRatio?: number | null;
  providerLineClosureScore?: number | null;
}) {
  const margin = input.deliveryMode === "print" ? 170 : 150;

  const basePipeline = sharp(input.imageBuffer).rotate().flatten({ background: "#ffffff" }).grayscale();
  const cleaned = await basePipeline
    .normalise()
    .linear(1.18, -12)
    .median(1)
    .threshold(208)
    .dilate(1)
    .resize({
      width: FINAL_PAGE_SIZE.width - margin * 2,
      height: FINAL_PAGE_SIZE.height - margin * 2,
      fit: "inside",
      background: "#ffffff",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const metadata = await sharp(cleaned).metadata();
  const placedWidth = metadata.width ?? FINAL_PAGE_SIZE.width - margin * 2;
  const placedHeight = metadata.height ?? FINAL_PAGE_SIZE.height - margin * 2;
  const left = Math.max(0, Math.floor((FINAL_PAGE_SIZE.width - placedWidth) / 2));
  const top = Math.max(0, Math.floor((FINAL_PAGE_SIZE.height - placedHeight) / 2));

  const finalPng = await sharp({
    create: {
      width: FINAL_PAGE_SIZE.width,
      height: FINAL_PAGE_SIZE.height,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: cleaned, left, top }])
    .png()
    .toBuffer();

  const previewJpeg = await sharp(finalPng)
    .resize({
      width: PREVIEW_PAGE_SIZE.width,
      height: PREVIEW_PAGE_SIZE.height,
      fit: "inside",
      withoutEnlargement: true,
      background: "#ffffff",
    })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  const darkMassMetrics = await measureDarkMassMetrics(finalPng);
  const noiseMetrics = await measureNoiseMetrics(finalPng);

  return {
    blackRatio: await measureBlackRatio(finalPng),
    finalPng,
    largestDarkComponentRatio: darkMassMetrics.largestDarkComponentRatio,
    noisyComponentCount: noiseMetrics.noisyComponentCount,
    previewJpeg,
    speckleRatio: noiseMetrics.speckleRatio,
  } satisfies ProcessedPageAsset;
}

async function renderImageWithGeminiWithRetries(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  primaryModel: string;
  imageSize: GeminiImageSize;
  source: RenderingSource;
}) {
  let lastError: Error | null = null;
  let lastQc: ColoringPageQcResult | null = null;
  let lastRendered: Awaited<ReturnType<typeof renderImageWithGemini>> | null = null;
  let qcCorrection: string | null = null;
  const accumulatedCostAttempts: GeminiCostAttempt[] = [];
  let accumulatedCostCents = 0;

  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    const model = getEscalationModel(input.primaryModel, attempt);
    const prompt = buildColoringPrompt({
      attempt,
      childFirstName: input.childFirstName,
      deliveryMode: input.deliveryMode,
      jobKind: input.jobKind,
      pageNumber: input.pageNumber,
      qcCorrection,
      sourceLabel: input.source.fileName,
    });

    try {
      const rendered = await renderImageWithGemini({
        attempt,
        deliveryMode: input.deliveryMode,
        imageSize: input.imageSize,
        mimeType: input.source.mimeType,
        model,
        prompt,
        sourceBuffer: input.source.buffer,
      });
      lastRendered = rendered;
      accumulatedCostCents += rendered.costCents;
      accumulatedCostAttempts.push(...rendered.costBreakdown.attempts);

      let qc: ColoringPageQcResult | null = null;
      try {
        qc = await assertColoringPageQC(rendered.buffer);
      } catch {
        qc = null;
      }
      lastQc = qc;

      if (!qc || qc.ok) {
        return {
          ...rendered,
          costCents: accumulatedCostCents,
          costBreakdown: {
            provider: rendered.provider,
            totalCostCents: accumulatedCostCents,
            attempts: accumulatedCostAttempts,
          },
          renderAttempts: attempt + 1,
          qcResult: qc,
        };
      }

      qcCorrection = qc.correctionLine;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Gemini generation error.");
      qcCorrection = null;
    }
  }

  if (lastRendered) {
    return {
      ...lastRendered,
      costCents: accumulatedCostCents,
      costBreakdown: {
        provider: lastRendered.provider,
        totalCostCents: accumulatedCostCents,
        attempts: accumulatedCostAttempts,
      },
      renderAttempts: MAX_RENDER_ATTEMPTS,
      qcResult: lastQc,
    };
  }

  throw lastError ?? new Error(`Failed to generate page ${input.pageNumber}.`);
}

async function renderSourceWithConfiguredProvider(
  input: {
    childFirstName?: string | null;
    deliveryMode: DeliveryMode;
    enforceQa?: boolean;
    jobKind: PipelineJobKind;
    pageNumber: number;
    primaryModel: string;
    primaryProvider: PipelineProvider;
    imageSize: GeminiImageSize;
    source: RenderingSource;
  } & RenderFallback<PipelineProvider>,
) {
  const strategies = [
    {
      provider: input.primaryProvider,
      model: input.primaryModel,
    },
    ...(input.fallbackProvider && input.fallbackModel
      ? [
          {
            provider: input.fallbackProvider,
            model: input.fallbackModel,
          },
        ]
      : []),
  ];

  let lastError: Error | null = null;
  const strategyErrors: string[] = [];
  const accumulatedCostAttempts: GeminiCostAttempt[] = [];
  let accumulatedCostCents = 0;
  let totalRenderAttempts = 0;
  let lastQaFailure: RenderedPageResult | null = null;

  for (const strategy of strategies) {
    try {
      const rendered = await renderImageWithGeminiWithRetries({
        childFirstName: input.childFirstName,
        deliveryMode: input.deliveryMode,
        jobKind: input.jobKind,
        pageNumber: input.pageNumber,
        primaryModel: strategy.model,
        imageSize: input.imageSize,
        source: input.source,
      });
      accumulatedCostCents += rendered.costCents;
      accumulatedCostAttempts.push(...rendered.costBreakdown.attempts);
      totalRenderAttempts += rendered.renderAttempts;

      const processed = await cleanupGeneratedPage({
        deliveryMode: input.deliveryMode,
        imageBuffer: rendered.buffer,
        provider: rendered.provider,
        providerBlackRatio: rendered.providerQa?.blackRatio ?? null,
        providerNoiseRatio: rendered.providerQa?.noiseRatio ?? null,
        providerLineClosureScore: rendered.providerQa?.lineClosureScore ?? null,
      });
      const qaMetrics: PageQualityMetrics = {
        finalBlackRatio: processed.blackRatio,
        finalLargestDarkComponentRatio: processed.largestDarkComponentRatio,
        finalSpeckleRatio: processed.speckleRatio,
        finalNoisyComponentCount: processed.noisyComponentCount,
        providerBlackRatio: rendered.providerQa?.blackRatio ?? null,
        providerEdgeDensity: rendered.providerQa?.edgeDensity ?? null,
        providerLineClosureScore: rendered.providerQa?.lineClosureScore ?? null,
        providerNoiseRatio: rendered.providerQa?.noiseRatio ?? null,
      };
      const qaFlags = Array.from(new Set([...rendered.providerQaFlags, ...getPostProcessQaFlags(processed)]));
      const qaScore = calculateQaScore({
        qaFlags,
        qaMetrics,
      });

      if ((input.enforceQa ?? true) && !processedPagePassesQa(processed)) {
        const failureMessage = `[${strategy.provider}:${strategy.model}] Rendered page ${input.pageNumber} failed QA with black ratio ${processed.blackRatio.toFixed(4)}, largest dark component ratio ${processed.largestDarkComponentRatio.toFixed(4)}, noisy components ${processed.noisyComponentCount}, and speckle ratio ${processed.speckleRatio.toFixed(4)}.`;
        lastError = new Error(failureMessage);
        strategyErrors.push(lastError.message);
        lastQaFailure = {
          ...processed,
          cleanupVersion: pipelineCleanupVersion,
          model: rendered.model,
          imageSize: rendered.imageSize,
          promptVersion: pipelinePromptVersion,
          provider: rendered.provider,
          qaFlags,
          qaMetrics,
          qaScore,
          renderAttempts: totalRenderAttempts,
          costCents: accumulatedCostCents,
          costBreakdown: {
            provider: rendered.provider,
            totalCostCents: accumulatedCostCents,
            attempts: accumulatedCostAttempts,
          },
          passedQa: false,
          failureMessage,
        };
        continue;
      }

      return {
        ...processed,
        cleanupVersion: pipelineCleanupVersion,
        model: rendered.model,
        imageSize: rendered.imageSize,
        promptVersion: pipelinePromptVersion,
        provider: rendered.provider,
        qaFlags,
        qaMetrics,
        qaScore,
        renderAttempts: totalRenderAttempts,
        costCents: accumulatedCostCents,
        costBreakdown: {
          provider: rendered.provider,
          totalCostCents: accumulatedCostCents,
          attempts: accumulatedCostAttempts,
        },
        passedQa: true,
        failureMessage: null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown rendering error.");
      strategyErrors.push(`[${strategy.provider}:${strategy.model}] ${lastError.message}`);
    }
  }

  if (lastQaFailure) {
    return lastQaFailure;
  }

  throw new Error(strategyErrors.length > 0 ? strategyErrors.join(" | ") : lastError?.message ?? `Failed to generate page ${input.pageNumber}.`);
}

async function materializePage(
  input: {
    childFirstName?: string | null;
    deliveryMode: DeliveryMode;
    jobKind: PipelineJobKind;
    pageNumber: number;
    primaryModel: string;
    primaryProvider: PipelineProvider;
    imageSize: GeminiImageSize;
    upload: SourceUpload;
  } & RenderFallback<PipelineProvider>,
) {
  const sourceBuffer = await downloadObject({
    bucket: "uploads",
    objectPath: input.upload.objectPath,
  });
  const mimeType = inferUploadMimeType(input.upload);

  return renderSourceWithConfiguredProvider({
    childFirstName: input.childFirstName,
    deliveryMode: input.deliveryMode,
    fallbackModel: input.fallbackModel,
    fallbackProvider: input.fallbackProvider,
    jobKind: input.jobKind,
    pageNumber: input.pageNumber,
    primaryModel: input.primaryModel,
    primaryProvider: input.primaryProvider,
    imageSize: input.imageSize,
    source: {
      buffer: sourceBuffer,
      fileName: input.upload.fileName,
      mimeType,
    },
  });
}

export async function renderMarketingPage(
  input: {
    childFirstName?: string | null;
    deliveryMode: DeliveryMode;
    enforceQa?: boolean;
    jobKind: PipelineJobKind;
    pageNumber: number;
    primaryModel: string;
    primaryProvider: PipelineProvider;
    imageSize: GeminiImageSize;
    source: RenderingSource;
  } & RenderFallback<PipelineProvider>,
) {
  return renderSourceWithConfiguredProvider(input);
}

async function addImagePage(input: {
  doc: PDFDocument;
  imageBuffer: Buffer;
  pageConfig: PdfPageConfig;
}) {
  const page = input.doc.addPage([input.pageConfig.width, input.pageConfig.height]);
  const image = await input.doc.embedPng(input.imageBuffer);
  const availableWidth = input.pageConfig.width - input.pageConfig.margin * 2;
  const availableHeight = input.pageConfig.height - input.pageConfig.margin * 2;
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  page.drawImage(image, {
    x: (input.pageConfig.width - drawWidth) / 2,
    y: (input.pageConfig.height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

async function drawTextPage(input: {
  bodyLines: string[];
  doc: PDFDocument;
  pageConfig: PdfPageConfig;
  subtitle?: string | null;
  title: string;
}) {
  const page = input.doc.addPage([input.pageConfig.width, input.pageConfig.height]);
  const titleFont = await input.doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await input.doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: input.pageConfig.width,
    height: input.pageConfig.height,
    color: rgb(1, 1, 1),
  });

  page.drawText(input.title, {
    x: input.pageConfig.margin,
    y: input.pageConfig.height - 96,
    size: 24,
    font: titleFont,
    color: rgb(0.05, 0.05, 0.05),
  });

  let currentY = input.pageConfig.height - 128;

  if (input.subtitle) {
    page.drawText(input.subtitle, {
      x: input.pageConfig.margin,
      y: currentY,
      size: 13,
      font: bodyFont,
      color: rgb(0.25, 0.22, 0.18),
      maxWidth: input.pageConfig.width - input.pageConfig.margin * 2,
    });
    currentY -= 34;
  }

  for (const line of input.bodyLines) {
    page.drawText(line, {
      x: input.pageConfig.margin,
      y: currentY,
      size: 12,
      font: bodyFont,
      color: rgb(0.18, 0.16, 0.14),
      maxWidth: input.pageConfig.width - input.pageConfig.margin * 2,
      lineHeight: 16,
    });
    currentY -= 22;
  }
}

async function createDownloadPdf(input: {
  childFirstName?: string | null;
  dedicationText?: string | null;
  designCount: number;
  orderId: string;
  pageBuffers: Buffer[];
}) {
  const doc = await PDFDocument.create();

  await drawTextPage({
    bodyLines: [
      `Design count: ${input.designCount}`,
      `Order: ${input.orderId}`,
      "Generated by littlecolorbook.com",
    ],
    doc,
    pageConfig: DIGITAL_PDF_PAGE,
    subtitle: input.dedicationText ?? "A personalized coloring book made from your uploaded photos.",
    title: input.childFirstName ? `${input.childFirstName}'s coloring book` : "Your custom coloring book",
  });

  for (const pageBuffer of input.pageBuffers) {
    await addImagePage({
      doc,
      imageBuffer: pageBuffer,
      pageConfig: DIGITAL_PDF_PAGE,
    });
  }

  return Buffer.from(await doc.save());
}

async function createPrintInteriorPdf(input: {
  childFirstName?: string | null;
  dedicationText?: string | null;
  designCount: number;
  orderId: string;
  pageBuffers: Buffer[];
}) {
  const doc = await PDFDocument.create();

  await drawTextPage({
    bodyLines: [
      `Design count: ${input.designCount}`,
      "This interior is formatted for Lulu US Letter coil binding.",
      "Each coloring design is followed by a blank back side.",
    ],
    doc,
    pageConfig: PRINT_PDF_PAGE,
    subtitle: input.dedicationText ?? "A keepsake coloring book made from your favorite photos.",
    title: input.childFirstName ? `${input.childFirstName}'s memory coloring book` : "Memory coloring book",
  });

  await drawTextPage({
    bodyLines: [
      "Color with crayons, colored pencils, or gel crayons for best results.",
      "Pages are formatted with extra margin for trim safety and coil binding.",
      `Order ID: ${input.orderId}`,
    ],
    doc,
    pageConfig: PRINT_PDF_PAGE,
    subtitle: "Created for print.",
    title: "How to enjoy this book",
  });

  for (let index = 0; index < input.pageBuffers.length; index += 1) {
    await addImagePage({
      doc,
      imageBuffer: input.pageBuffers[index],
      pageConfig: PRINT_PDF_PAGE,
    });

    const blankPage = doc.addPage([PRINT_PDF_PAGE.width, PRINT_PDF_PAGE.height]);
    blankPage.drawRectangle({
      x: 0,
      y: 0,
      width: PRINT_PDF_PAGE.width,
      height: PRINT_PDF_PAGE.height,
      color: rgb(1, 1, 1),
    });
  }

  await drawTextPage({
    bodyLines: [
      "Made by littlecolorbook.com",
      "Thanks for turning family memories into something kids can color.",
    ],
    doc,
    pageConfig: PRINT_PDF_PAGE,
    subtitle: null,
    title: "The end",
  });

  await drawTextPage({
    bodyLines: [""],
    doc,
    pageConfig: PRINT_PDF_PAGE,
    subtitle: null,
    title: "",
  });

  return Buffer.from(await doc.save());
}

async function createPrintCoverPdf(input: {
  coverStyle?: string | null;
  designCount: number;
  titleName?: string | null;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PRINT_COVER_PAGE.width, PRINT_COVER_PAGE.height]);
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const frontX = PRINT_COVER_PAGE.width / 2 + 42;
  const backX = 42;
  const coverStyle = normalizeCoverStyle(input.coverStyle);
  const palette: Record<string, { back: [number, number, number]; front: [number, number, number]; title: [number, number, number]; body: [number, number, number] }> =
    {
      "signature-linen": {
        back: [0.99, 0.96, 0.9],
        front: [0.97, 0.88, 0.62],
        title: [0.18, 0.14, 0.08],
        body: [0.28, 0.22, 0.14],
      },
      "modern-storybook": {
        back: [1, 0.98, 0.9],
        front: [1, 0.9, 0.52],
        title: [0.27, 0.15, 0.1],
        body: [0.36, 0.21, 0.12],
      },
      "creative-studio": {
        back: [0.99, 0.96, 0.95],
        front: [0.94, 0.62, 0.57],
        title: [0.22, 0.1, 0.08],
        body: [0.32, 0.16, 0.12],
      },
      "heritage-crest": {
        back: [0.98, 0.98, 0.98],
        front: [0.9, 0.9, 0.9],
        title: [0.07, 0.07, 0.07],
        body: [0.2, 0.2, 0.2],
      },
    };
  const colors = palette[coverStyle] ?? palette["signature-linen"]!;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PRINT_COVER_PAGE.width,
    height: PRINT_COVER_PAGE.height,
    color: rgb(...colors.back),
  });

  page.drawRectangle({
    x: PRINT_COVER_PAGE.width / 2,
    y: 0,
    width: PRINT_COVER_PAGE.width / 2,
    height: PRINT_COVER_PAGE.height,
    color: rgb(...colors.front),
  });

  page.drawText("littlecolorbook.com", {
    x: backX,
    y: PRINT_COVER_PAGE.height - 92,
    size: 18,
    font: titleFont,
    color: rgb(...colors.title),
  });
  page.drawText("A personalized coloring book made from real family photos.", {
    x: backX,
    y: PRINT_COVER_PAGE.height - 130,
    size: 12,
    font: bodyFont,
    color: rgb(...colors.body),
    maxWidth: PRINT_COVER_PAGE.width / 2 - 84,
  });

  page.drawText(input.titleName ? `${input.titleName}'s` : "My", {
    x: frontX,
    y: PRINT_COVER_PAGE.height - 180,
    size: 34,
    font: titleFont,
    color: rgb(...colors.title),
  });
  page.drawText("memory coloring book", {
    x: frontX,
    y: PRINT_COVER_PAGE.height - 226,
    size: 28,
    font: titleFont,
    color: rgb(...colors.title),
  });
  page.drawText(`${input.designCount} personalized designs`, {
    x: frontX,
    y: PRINT_COVER_PAGE.height - 268,
    size: 16,
    font: bodyFont,
    color: rgb(...colors.body),
  });

  return Buffer.from(await doc.save());
}

// ---------------------------------------------------------------------------
// New pdf-templates pipeline helpers
// ---------------------------------------------------------------------------

const DIGITAL_TRIM: TrimSpec = { widthIn: 8.5, heightIn: 11, bleedIn: 0, safeIn: 0 };

function bufferToDataUri(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function mapCoverStyleToStyleId(coverStyle?: string | null): StyleId {
  return normalizeCoverStyle(coverStyle);
}

function buildBookPayload(input: {
  childFirstName?: string | null;
  coverStyle?: string | null;
  dedicationText?: string | null;
  occasion?: OccasionId | null;
  occasionContext?: OccasionContext | null;
  pageBuffers: Buffer[];
  titleName?: string | null;
  trim: TrimSpec;
}): BookPayload {
  const contentPages = input.pageBuffers.length + 2;
  const pageCount = ensurePageCountParity(contentPages);
  const style = mapCoverStyleToStyleId(input.coverStyle);
  const name = input.titleName?.trim() || input.childFirstName?.trim() || null;
  const occasion: OccasionId = input.occasion ?? "everyday";
  const occasionContext: OccasionContext = input.occasionContext ?? { childName: name || "My" };

  return {
    trim: input.trim,
    spineWidthIn: getSpineWidth(pageCount),
    pageCount,
    style,
    occasion,
    occasionContext,
    meta: {
      title: name ? `${name}'s Coloring Book` : "My Coloring Book",
      subtitle: "A little coloring book",
      dedication: input.dedicationText || undefined,
      createdOn: new Date().toISOString().slice(0, 10),
    },
    cover: { type: "stock-art", stockArtId: "rainbow-clouds" },
    pages: input.pageBuffers.map((buf) => ({
      lineArt: { url: bufferToDataUri(buf), widthPx: 0, heightPx: 0 },
    })),
    renderOptions: {
      forceEvenPages: input.trim.bleedIn > 0,
      includeCoverPage: input.trim.bleedIn === 0,
    },
  };
}

export function buildGenerationPlan(input: {
  coverCount?: number;
  deliveryMode: DeliveryMode;
  designCount: number;
  jobKind: PipelineJobKind;
  orderId: string;
  sourceUploadIds: string[];
}) {
  const targetPages = input.jobKind === "sample" ? 1 : input.designCount;
  const sourceUploadIds = input.sourceUploadIds.length > 0 ? input.sourceUploadIds : [""];
  const coverCount = input.deliveryMode === "print" ? Math.max(1, Math.trunc(input.coverCount ?? 1)) : 0;
  const coverPdfPaths =
    input.deliveryMode === "print"
      ? Array.from({ length: coverCount }, (_, index) => `orders/${input.orderId}/pdf/covers/${index + 1}.pdf`)
      : [];

  const pages = Array.from({ length: targetPages }, (_, index) => {
    const pageNumber = index + 1;
    const sourceUploadId = sourceUploadIds[index % sourceUploadIds.length] || null;

    return {
      cleanupSteps,
      generatedImagePath: `orders/${input.orderId}/pages/${pageNumber}/generated.png`,
      pageNumber,
      previewImagePath: `orders/${input.orderId}/pages/${pageNumber}/preview.jpg`,
      qaChecklist,
      sourceUploadId,
    } satisfies PlannedGenerationPage;
  });

  return {
    deliveryMode: input.deliveryMode,
    designCount: input.designCount,
    interiorPageCount: input.deliveryMode === "print" ? estimateInteriorPageCount(input.designCount) : input.designCount,
    jobKind: input.jobKind,
    orderId: input.orderId,
    pages,
    pdf: {
      coverPdfPath: coverPdfPaths[0] ?? null,
      coverPdfPaths,
      downloadPdfPath: `orders/${input.orderId}/pdf/download.pdf`,
      interiorPdfPath: `orders/${input.orderId}/pdf/interior.pdf`,
    },
    targetPages,
  } satisfies GenerationPlan;
}

async function buildFullBookPdfAssets(input: {
  childFirstName?: string | null;
  copyNames?: Array<string | null> | null;
  coverStyle?: string | null;
  dedicationText?: string | null;
  occasion?: OccasionId | null;
  occasionContext?: OccasionContext | null;
  plan: GenerationPlan;
  quantity?: number;
  pageBuffers: Buffer[];
}) {
  const { renderCoverPdf, renderInteriorPdf } = await import("@littlecolorbook/pdf-templates/render");
  const assets: MaterializedAsset[] = [];
  const printTrim = getTrim();
  const basePayload = buildBookPayload({
    childFirstName: input.childFirstName,
    coverStyle: input.coverStyle,
    dedicationText: input.dedicationText,
    occasion: input.occasion,
    occasionContext: input.occasionContext,
    pageBuffers: input.pageBuffers,
    titleName: input.childFirstName,
    trim: printTrim,
  });

  const downloadPayload: BookPayload = {
    ...basePayload,
    pageCount: basePayload.pages.length + 3,
    renderOptions: {
      forceEvenPages: false,
      includeCoverPage: true,
    },
    trim: DIGITAL_TRIM,
  };
  const downloadPdf = await renderInteriorPdf(downloadPayload);

  const interiorPdf = input.plan.deliveryMode === "print" ? await renderInteriorPdf(basePayload) : downloadPdf;

  assets.push({
    body: interiorPdf,
    contentType: "application/pdf",
    kind: "interior_pdf",
    objectPath: input.plan.pdf.interiorPdfPath,
  });
  assets.push({
    body: downloadPdf,
    contentType: "application/pdf",
    kind: "download_pdf",
    objectPath: input.plan.pdf.downloadPdfPath,
  });

  if (input.plan.pdf.coverPdfPaths.length > 0) {
    const requestedCoverCount = Math.max(1, input.quantity ?? input.plan.pdf.coverPdfPaths.length);
    const coverNames = Array.from({ length: requestedCoverCount }, (_, index) => {
      const specificName = input.copyNames?.[index];
      if (specificName) return specificName;
      const fallbackName = input.childFirstName?.trim();
      return fallbackName ? fallbackName : null;
    });

    for (const [index, objectPath] of input.plan.pdf.coverPdfPaths.entries()) {
      const coverPayload = buildBookPayload({
        childFirstName: input.childFirstName,
        coverStyle: input.coverStyle,
        dedicationText: input.dedicationText,
        occasion: input.occasion,
        occasionContext: input.occasionContext,
        pageBuffers: input.pageBuffers,
        titleName: coverNames[index],
        trim: printTrim,
      });
      const coverPdf = await renderCoverPdf(coverPayload);

      assets.push({
        body: coverPdf,
        contentType: "application/pdf",
        kind: "cover_pdf",
        objectPath,
      });
    }
  }

  return assets;
}

export async function materializeBookPdfAssets(input: {
  childFirstName?: string | null;
  copyNames?: Array<string | null> | null;
  coverStyle?: string | null;
  dedicationText?: string | null;
  occasion?: OccasionId | null;
  occasionContext?: OccasionContext | null;
  plan: GenerationPlan;
  quantity?: number;
  pageBuffers: Buffer[];
}) {
  return buildFullBookPdfAssets(input);
}

type MaterializedSinglePage = {
  assets: MaterializedAsset[];
  pageImageBuffer: Buffer | null;
  pageResult: MaterializedPageResult | null;
  pageFailure: MaterializedPageFailure | null;
  model: string | null;
  provider: PipelineProvider | null;
};

export async function materializeSingleGenerationPage(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  page: PlannedGenerationPage;
  upload: SourceUpload;
}) : Promise<MaterializedSinglePage> {
  const renderSettings = getPipelineRenderSettings(input.deliveryMode, input.jobKind);

  try {
    const rendered = await materializePage({
      childFirstName: input.childFirstName,
      deliveryMode: input.deliveryMode,
      fallbackModel: renderSettings.fallbackModel,
      fallbackProvider: renderSettings.fallbackProvider,
      jobKind: input.jobKind,
      pageNumber: input.page.pageNumber,
      primaryModel: renderSettings.model,
      primaryProvider: renderSettings.provider,
      imageSize: renderSettings.imageSize,
      upload: input.upload,
    });

    const assets: MaterializedAsset[] = [
      {
        body: rendered.finalPng,
        contentType: "image/png",
        kind: "generated_page",
        objectPath: input.page.generatedImagePath,
        pageNumber: input.page.pageNumber,
      },
      {
        body: rendered.previewJpeg,
        contentType: "image/jpeg",
        kind: "preview",
        objectPath: input.page.previewImagePath,
        pageNumber: input.page.pageNumber,
      },
    ];

    if (rendered.passedQa) {
      return {
        assets,
        pageImageBuffer: rendered.finalPng,
        pageResult: {
          cleanupVersion: rendered.cleanupVersion,
          costBreakdown: rendered.costBreakdown,
          costCents: rendered.costCents,
          imageSize: rendered.imageSize,
          model: rendered.model,
          pageNumber: input.page.pageNumber,
          promptVersion: rendered.promptVersion,
          provider: rendered.provider,
          qaFlags: rendered.qaFlags,
          qaMetrics: rendered.qaMetrics,
          qaScore: rendered.qaScore,
          renderAttempts: rendered.renderAttempts,
          sourceUploadId: input.page.sourceUploadId,
        },
        pageFailure: null,
        model: rendered.model,
        provider: rendered.provider,
      };
    }

    return {
      assets,
      pageImageBuffer: null,
      pageResult: null,
      pageFailure: {
        pageNumber: input.page.pageNumber,
        sourceUploadId: input.page.sourceUploadId,
        provider: rendered.provider,
        model: rendered.model,
        imageSize: rendered.imageSize,
        promptVersion: rendered.promptVersion,
        cleanupVersion: rendered.cleanupVersion,
        renderAttempts: rendered.renderAttempts,
        costCents: rendered.costCents,
        costBreakdown: rendered.costBreakdown,
        qaScore: rendered.qaScore,
        qaFlags: rendered.qaFlags,
        qaMetrics: rendered.qaMetrics,
        message: rendered.failureMessage ?? `Page ${input.page.pageNumber} failed QA.`,
        previewAvailable: true,
      },
      model: rendered.model,
      provider: rendered.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to generate page ${input.page.pageNumber}.`;

    return {
      assets: [],
      pageImageBuffer: null,
      pageResult: null,
      pageFailure: {
        pageNumber: input.page.pageNumber,
        sourceUploadId: input.page.sourceUploadId,
        provider: null,
        model: null,
        imageSize: null,
        promptVersion: pipelinePromptVersion,
        cleanupVersion: pipelineCleanupVersion,
        renderAttempts: 0,
        costCents: 0,
        costBreakdown: null,
        qaScore: null,
        qaFlags: [],
        qaMetrics: null,
        message,
        previewAvailable: false,
      },
      model: null,
      provider: null,
    };
  }
}

export async function materializeGenerationPlan(input: {
  childFirstName?: string | null;
  copyNames?: Array<string | null> | null;
  coverStyle?: string | null;
  dedicationText?: string | null;
  occasion?: OccasionId | null;
  occasionContext?: OccasionContext | null;
  plan: GenerationPlan;
  quantity?: number;
  selectedOfferCode?: string | null;
  uploads: SourceUpload[];
  allowPageFailures?: boolean;
}): Promise<MaterializedPlan> {
  const uploads = input.uploads.length > 0 ? input.uploads : [{ fileName: "uploaded-photo.jpg", objectPath: "missing-upload.jpg" }];
  const assets: MaterializedAsset[] = [];
  const pageBuffers: Buffer[] = [];
  const pageResults: MaterializedPageResult[] = [];
  const pageFailures: MaterializedPageFailure[] = [];
  const renderSettings = getPipelineRenderSettings(input.plan.deliveryMode, input.plan.jobKind);
  let modelUsed = renderSettings.model;
  let providerUsed: PipelineProvider = renderSettings.provider;

  const concurrency = getPlanConcurrency(input.plan.jobKind);
  const { default: pLimit } = await import("p-limit");
  const limit = pLimit(concurrency);

  const renderTasks = input.plan.pages.map((page) =>
    limit(async () => {
      const matchedUpload = uploads.find((upload) => upload.id && upload.id === page.sourceUploadId) ?? uploads[(page.pageNumber - 1) % uploads.length];
      const outcome = await materializeSingleGenerationPage({
        childFirstName: input.childFirstName,
        deliveryMode: input.plan.deliveryMode,
        jobKind: input.plan.jobKind,
        page,
        upload: matchedUpload,
      });
      return { page, outcome };
    }),
  );

  const completedPages = await Promise.all(renderTasks);

  for (const { outcome } of completedPages.sort((a, b) => a.page.pageNumber - b.page.pageNumber)) {
    if (outcome.model) {
      modelUsed = outcome.model;
    }

    if (outcome.provider) {
      providerUsed = outcome.provider;
    }

    assets.push(...outcome.assets);

    if (outcome.pageImageBuffer) {
      pageBuffers.push(outcome.pageImageBuffer);
    }

    if (outcome.pageResult) {
      pageResults.push(outcome.pageResult);
    }

    if (outcome.pageFailure) {
      pageFailures.push(outcome.pageFailure);
    }
  }

  if (pageFailures.length > 0 && !input.allowPageFailures) {
    throw new Error(pageFailures[0]?.message ?? "One or more pages failed generation.");
  }

  if (input.plan.jobKind === "full_book" && pageFailures.length === 0) {
    assets.push(
      ...(await buildFullBookPdfAssets({
        childFirstName: input.childFirstName,
        copyNames: input.copyNames,
        coverStyle: input.coverStyle,
        dedicationText: input.dedicationText,
        occasion: input.occasion,
        occasionContext: input.occasionContext,
        plan: input.plan,
        quantity: input.quantity,
        pageBuffers,
      })),
    );
  }

  return {
    assets,
    model: modelUsed,
    pageResults,
    pageFailures,
    provider: providerUsed,
  };
}
