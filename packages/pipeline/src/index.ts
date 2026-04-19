import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { estimateInteriorPageCount, normalizeCoverStyle, type CoverStyleCode, type DeliveryMode } from "@littlecolorbook/shared";
import { getColoringEngineEnv } from "@littlecolorbook/shared/env";
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

export const pipelinePromptVersion = "2026-04-19.b";
export const pipelineCleanupVersion = "2026-04-12.a";

export type PipelineJobKind = "sample" | "full_book";
export type PipelineProvider = "gemini" | "custom-python";

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

const PRIMARY_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const FALLBACK_IMAGE_MODEL = "gemini-3-pro-image-preview";
const MAX_RENDER_ATTEMPTS = 2;
const DEFAULT_ASPECT_RATIO = "3:4";

const compositionGoals = [
  "include the surrounding scene — plants, animals, buildings, furniture, props — as clean colorable line-art shapes around the subjects",
  "keep faces large and readable while rendering the full environment behind them with trees, sky, or architecture simplified into colorable outlines",
  "translate the whole photographed moment into line art — subjects plus their pets, nearby objects, landscape, and interior details",
  "layer the original setting (landscape, room, street, park) behind the subjects as a richly detailed but clean colorable backdrop",
  "capture environmental storytelling by outlining contextual props, weather, flora, and small details from the original photo",
  "preserve the scene's sense of place with recognizable architectural or natural features drawn as simplified but detailed line art",
];

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
  promptVersion: string;
  cleanupVersion: string;
  renderAttempts: number;
  qaScore: number;
  qaFlags: string[];
  qaMetrics: PageQualityMetrics;
};

export type MaterializedPlan = {
  assets: MaterializedAsset[];
  model: string;
  pageResults: MaterializedPageResult[];
  provider: PipelineProvider;
};

type GeneratedImagePart = {
  data: string;
  mimeType: string;
};

type ProcessedPageAsset = {
  blackRatio: number;
  finalPng: Buffer;
  noisyComponentCount: number;
  previewJpeg: Buffer;
  speckleRatio: number;
};

type RenderedPage = {
  buffer: Buffer;
  mimeType: string;
  model: string;
  provider: PipelineProvider;
  providerQa: ProviderQualityMetrics | null;
  providerQaFlags: string[];
  renderAttempts: number;
};

export type RenderedPageResult = ProcessedPageAsset & {
  cleanupVersion: string;
  model: string;
  promptVersion: string;
  provider: PipelineProvider;
  qaFlags: string[];
  qaMetrics: PageQualityMetrics;
  qaScore: number;
  renderAttempts: number;
};

type PipelineRenderSettings = {
  fallbackModel: string | null;
  fallbackProvider: PipelineProvider | null;
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

function isCustomPythonConfigured() {
  return Boolean(process.env.COLORING_ENGINE_URL);
}

function isPipelineFallbackDisabled() {
  return process.env.PIPELINE_DISABLE_FALLBACK === "true";
}

function getRequestedPipelineProvider(): PipelineProvider {
  return process.env.PIPELINE_RENDER_PROVIDER === "custom-python" ? "custom-python" : "gemini";
}

function getCustomPythonModelName() {
  return process.env.COLORING_ENGINE_MODEL ?? "littlecolorbook-coloring-engine";
}

function getColoringEngineRenderProfile() {
  const profile = process.env.COLORING_ENGINE_PROFILE;

  if (profile === "balanced" || profile === "subject-focus" || profile === "scene-preserving") {
    return profile;
  }

  return "scene-preserving";
}

function getColoringEngineContourCore() {
  const contourCore = process.env.COLORING_ENGINE_CONTOUR_CORE;

  if (
    contourCore === "opencv-hybrid" ||
    contourCore === "controlnet-lineart-realistic" ||
    contourCore === "controlnet-lineart-coarse" ||
    contourCore === "controlnet-softedge-pidinet" ||
    contourCore === "paired-pix2pix-turbo"
  ) {
    return contourCore;
  }

  return "controlnet-lineart-realistic";
}

function isDenseSceneContourRerouteEnabled() {
  const value = process.env.COLORING_ENGINE_ENABLE_DENSE_SCENE_REROUTE;
  return value === undefined ? true : !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function getDenseSceneBlackRatioThreshold() {
  const value = Number(process.env.COLORING_ENGINE_DENSE_SCENE_BLACK_RATIO_THRESHOLD ?? "0.16");
  return Number.isFinite(value) && value > 0 ? value : 0.16;
}

function getDenseSceneBlackRatioImprovementThreshold() {
  const value = Number(process.env.COLORING_ENGINE_DENSE_SCENE_MIN_BLACK_RATIO_IMPROVEMENT ?? "0.03");
  return Number.isFinite(value) && value > 0 ? value : 0.03;
}

function getDenseSceneClosureTolerance() {
  const value = Number(process.env.COLORING_ENGINE_DENSE_SCENE_CLOSURE_TOLERANCE ?? "0.05");
  return Number.isFinite(value) && value >= 0 ? value : 0.05;
}

function getDenseSceneNoiseTolerance() {
  const value = Number(process.env.COLORING_ENGINE_DENSE_SCENE_NOISE_TOLERANCE ?? "0.0005");
  return Number.isFinite(value) && value >= 0 ? value : 0.0005;
}

function isSubjectFocusRerouteEnabled() {
  const value = process.env.COLORING_ENGINE_ENABLE_SUBJECT_FOCUS_REROUTE;
  return value === undefined ? true : !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function getSubjectFocusClosureThreshold() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_CLOSURE_THRESHOLD ?? "0.87");
  return Number.isFinite(value) && value > 0 ? value : 0.87;
}

function getSubjectFocusMaxBlackRatio() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_MAX_BLACK_RATIO ?? "0.15");
  return Number.isFinite(value) && value > 0 ? value : 0.15;
}

function getSubjectFocusMinAlternateBlackRatio() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_MIN_ALTERNATE_BLACK_RATIO ?? "0.07");
  return Number.isFinite(value) && value > 0 ? value : 0.07;
}

function getSubjectFocusMaxAlternateBlackRatio() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_MAX_ALTERNATE_BLACK_RATIO ?? "0.2");
  return Number.isFinite(value) && value > 0 ? value : 0.2;
}

function getSubjectFocusClosureTolerance() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_CLOSURE_TOLERANCE ?? "0.05");
  return Number.isFinite(value) && value >= 0 ? value : 0.05;
}

function getSubjectFocusNoiseTolerance() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_NOISE_TOLERANCE ?? "0.0005");
  return Number.isFinite(value) && value >= 0 ? value : 0.0005;
}

function getSubjectFocusMinScoreImprovement() {
  const value = Number(process.env.COLORING_ENGINE_SUBJECT_FOCUS_MIN_SCORE_IMPROVEMENT ?? "0.02");
  return Number.isFinite(value) && value >= 0 ? value : 0.02;
}

function getProviderQualityScore(metrics: ProviderQualityMetrics | null) {
  if (!metrics) {
    return Number.NEGATIVE_INFINITY;
  }

  const blackRatio = metrics.blackRatio ?? 0.12;
  const closure = metrics.lineClosureScore ?? 0.8;
  const noiseRatio = metrics.noiseRatio ?? 0.002;

  return closure - Math.abs(blackRatio - 0.12) * 3.5 - noiseRatio * 40;
}

function shouldProbeDenseSceneAlternate(rendered: RenderedPage, contourCore: string) {
  if (!isDenseSceneContourRerouteEnabled() || contourCore !== "controlnet-lineart-realistic" || rendered.provider !== "custom-python") {
    return false;
  }

  const blackRatio = rendered.providerQa?.blackRatio;
  return typeof blackRatio === "number" && blackRatio >= getDenseSceneBlackRatioThreshold();
}

function shouldProbeSubjectFocusAlternate(rendered: RenderedPage, contourCore: string) {
  if (!isSubjectFocusRerouteEnabled() || contourCore !== "controlnet-lineart-realistic" || rendered.provider !== "custom-python") {
    return false;
  }

  const blackRatio = rendered.providerQa?.blackRatio;
  const closure = rendered.providerQa?.lineClosureScore;

  if (typeof blackRatio !== "number" || typeof closure !== "number") {
    return false;
  }

  // Skip if dense-scene reroute would fire (that path handles over-dense scenes).
  if (blackRatio >= getDenseSceneBlackRatioThreshold()) {
    return false;
  }

  // Skip if the primary is clearly over-dense beyond the subject-focus trigger band.
  if (blackRatio > getSubjectFocusMaxBlackRatio()) {
    return false;
  }

  return closure < getSubjectFocusClosureThreshold();
}

function shouldPreferSubjectFocusAlternate(current: RenderedPage, alternate: RenderedPage) {
  const currentMetrics = current.providerQa;
  const alternateMetrics = alternate.providerQa;

  if (!currentMetrics || !alternateMetrics) {
    return false;
  }

  const currentClosure = currentMetrics.lineClosureScore;
  const alternateClosure = alternateMetrics.lineClosureScore;
  const currentNoise = currentMetrics.noiseRatio;
  const alternateNoise = alternateMetrics.noiseRatio;
  const alternateBlackRatio = alternateMetrics.blackRatio;

  if (
    typeof currentClosure !== "number" ||
    typeof alternateClosure !== "number" ||
    typeof currentNoise !== "number" ||
    typeof alternateNoise !== "number" ||
    typeof alternateBlackRatio !== "number"
  ) {
    return false;
  }

  // Guard against over-sparse alternates (e.g., seed-006 false positive during probing).
  if (alternateBlackRatio < getSubjectFocusMinAlternateBlackRatio()) {
    return false;
  }

  if (alternateBlackRatio > getSubjectFocusMaxAlternateBlackRatio()) {
    return false;
  }

  const closurePreserved = alternateClosure >= currentClosure - getSubjectFocusClosureTolerance();
  const noisePreserved = alternateNoise <= currentNoise + getSubjectFocusNoiseTolerance();
  const scoreImproved =
    getProviderQualityScore(alternateMetrics) - getProviderQualityScore(currentMetrics) >= getSubjectFocusMinScoreImprovement();

  return closurePreserved && noisePreserved && scoreImproved;
}

function shouldPreferDenseSceneAlternate(current: RenderedPage, alternate: RenderedPage) {
  const currentMetrics = current.providerQa;
  const alternateMetrics = alternate.providerQa;

  if (!currentMetrics || !alternateMetrics) {
    return false;
  }

  const currentBlackRatio = currentMetrics.blackRatio;
  const alternateBlackRatio = alternateMetrics.blackRatio;
  const currentClosure = currentMetrics.lineClosureScore;
  const alternateClosure = alternateMetrics.lineClosureScore;
  const currentNoiseRatio = currentMetrics.noiseRatio;
  const alternateNoiseRatio = alternateMetrics.noiseRatio;

  if (
    typeof currentBlackRatio !== "number" ||
    typeof alternateBlackRatio !== "number" ||
    typeof currentClosure !== "number" ||
    typeof alternateClosure !== "number" ||
    typeof currentNoiseRatio !== "number" ||
    typeof alternateNoiseRatio !== "number"
  ) {
    return false;
  }

  const improvedDensity = alternateBlackRatio <= currentBlackRatio - getDenseSceneBlackRatioImprovementThreshold();
  const preservedClosure = alternateClosure >= currentClosure - getDenseSceneClosureTolerance();
  const acceptableNoise = alternateNoiseRatio <= currentNoiseRatio + getDenseSceneNoiseTolerance();

  return improvedDensity && preservedClosure && acceptableNoise && getProviderQualityScore(alternateMetrics) > getProviderQualityScore(currentMetrics);
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

function getCompositionGoal(jobKind: PipelineJobKind, pageNumber: number) {
  if (jobKind === "sample") {
    return compositionGoals[0]!;
  }

  return compositionGoals[(pageNumber - 1) % compositionGoals.length];
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
        ? process.env.GEMINI_IMAGE_MODEL_SAMPLE ?? process.env.GEMINI_IMAGE_MODEL ?? FALLBACK_IMAGE_MODEL
        : process.env.GEMINI_IMAGE_MODEL ?? PRIMARY_IMAGE_MODEL;

  const requestedProvider = getRequestedPipelineProvider();
  const geminiConfigured = isGeminiConfigured();
  const customPythonConfigured = isCustomPythonConfigured();

  const provider: PipelineProvider =
    requestedProvider === "custom-python" && customPythonConfigured
      ? "custom-python"
      : geminiConfigured
        ? "gemini"
        : customPythonConfigured
          ? "custom-python"
          : "gemini";

  const fallbackProvider: PipelineProvider | null =
    provider === "custom-python" && geminiConfigured && !isPipelineFallbackDisabled() ? "gemini" : null;
  const selectedModel = provider === "custom-python" ? getCustomPythonModelName() : model;
  const fallbackModel = fallbackProvider === "gemini" ? model : null;

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

export function buildColoringPrompt(input: {
  attempt: number;
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  sourceLabel: string;
}) {
  const personalization = input.childFirstName
    ? `Make the page feel personalized for ${input.childFirstName}, while keeping the real people or pets from the photo recognizable.`
    : "Keep the real people or pets from the photo recognizable.";

  const retryLine =
    input.attempt > 0
      ? "The previous result was not premium enough. Tighten the closed contours, enlarge and clarify the faces, and keep the scene's environmental details (plants, animals, buildings, props) intact rather than stripping them away."
      : null;

  return [
    "Convert the provided photo into a premium black-and-white children's coloring book page with rich environmental detail.",
    "Priority order — spend ink in this order: (1) recognizable, expressive faces with clearly drawn eyes (including pupils and brows), nose, mouth, and hair; (2) subject bodies, clothing, and pose; (3) the full surrounding scene with environmental details; (4) overall clean closed contours with consistent line weight. Never let scenery compete with facial features.",
    personalization,
    `Composition goal: ${getCompositionGoal(input.jobKind, input.pageNumber)}.`,
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    "Faces are the highest-priority element. Draw every face with enough line detail to be clearly recognizable and expressive, with pupils inside the eyes, a readable nose, and a readable mouth. Do not let environmental detail flatten or overwhelm facial features.",
    "Stay faithful to the real setting in the photo — render the actual plants, animals, buildings, landscape, furniture, and props the subjects are with, not generic substitutes.",
    input.jobKind === "sample"
      ? "Optimize for the strongest single sellable page by crafting a rich, story-filled scene the child will want to spend time coloring."
      : "Keep the page consistent with a premium keepsake book full of contextual detail rather than an empty portrait sketch.",
    "Use smooth, continuous, closed black contours with medium-thick, consistent line weight.",
    "Render the surrounding scene — plants, trees, animals, buildings, sky, furniture, props — as clean simplified line-art shapes. The background should feel like a real illustrated environment, not a blank page.",
    "Include plenty of interesting, colorable details (foliage, clouds, bricks, patterns on clothing, small critters, toys, signage shapes) so there is lots for a child to engage with across the whole page.",
    "Do not add color, gray shading, crosshatching, halftones, stippling, sketch texture, speech bubbles, captions, borders, or text.",
    "Keep every mark intentional and connected to a scene element — avoid random floating fragments or sketchy noise, but do not strip away real environmental details.",
    "Never fill any region solid black — not dark fur, dark clothing, dark crates, dark furniture, dark foliage, or dark backgrounds. Even when the source photo shows a region as nearly black, break it into open colorable shapes with interior outlines so a child can color every area of the page.",
    "Avoid dense hatching or heavy shadow blocks in hair, fur, or clothing. Suggest dark tonality with a few clean outline strokes only.",
    "Keep the image friendly and easy for a child to color: large colorable areas for faces and subjects, with smaller detail work filling the scene around them.",
    "If the photo contains multiple people, enlarge the primary one to three subjects so each face reads clearly at coloring-book scale, then fit the wider scene around them.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    input.deliveryMode === "print"
      ? "The page must hold up in print. Favor crisp outlines and stable line weight over fine photographic texture, while keeping the scene's environmental details legible."
      : "The page should look clean on screen and be easy to print at home while preserving the full scene.",
    `Reference photo label: ${input.sourceLabel}.`,
    retryLine,
    "Return only the finished coloring page image.",
  ]
    .filter(Boolean)
    .join("\n");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractGeneratedImage(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];

    for (const part of parts) {
      const partRecord = asRecord(part);
      const inlineData = asRecord(partRecord?.inlineData) ?? asRecord(partRecord?.inline_data);
      const data = typeof inlineData?.data === "string" ? inlineData.data : null;
      const mimeType = typeof inlineData?.mimeType === "string" ? inlineData.mimeType : typeof inlineData?.mime_type === "string" ? inlineData.mime_type : null;

      if (data && mimeType) {
        return {
          data,
          mimeType,
        } satisfies GeneratedImagePart;
      }
    }
  }

  const message = candidates
    .map((candidate) => {
      const parts = Array.isArray(asRecord(asRecord(candidate)?.content)?.parts) ? (asRecord(candidate)?.content as Record<string, unknown>).parts as unknown[] : [];
      return parts
        .map((part) => {
          const text = asRecord(part)?.text;
          return typeof text === "string" ? text : null;
        })
        .filter((value): value is string => Boolean(value))
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");

  throw new Error(message || "Gemini did not return an image.");
}

async function renderImageWithGemini(input: {
  attempt: number;
  deliveryMode: DeliveryMode;
  imageSize: GeminiImageSize;
  mimeType: string;
  model: string;
  prompt: string;
  sourceBuffer: Buffer;
}) {
  const maxRateLimitRetries = 3;

  let response: Response | null = null;
  let payload: Record<string, unknown> | null = null;

  for (let rateLimitAttempt = 0; rateLimitAttempt <= maxRateLimitRetries; rateLimitAttempt++) {
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

    if (response.status === 429 && rateLimitAttempt < maxRateLimitRetries) {
      const backoffMs = Math.min(1000 * 2 ** rateLimitAttempt + Math.random() * 500, 10000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    break;
  }

  payload = (await response!.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response!.ok || !payload) {
    const detail =
      (payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
        ? payload.error.message
        : null) ?? `Gemini image generation failed with status ${response!.status}.`;
    throw new Error(detail);
  }

  const imagePart = extractGeneratedImage(payload);

  return {
    buffer: Buffer.from(imagePart.data, "base64"),
    mimeType: imagePart.mimeType,
    model: input.model,
    provider: "gemini",
    providerQa: null,
    providerQaFlags: [],
    renderAttempts: 1,
  } satisfies RenderedPage;
}

async function requestColoringEngineRender(input: {
  childFirstName?: string | null;
  contourCore: string;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  renderProfile?: string;
  source: RenderingSource;
}) {
  const env = getColoringEngineEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.timeoutMs);

  try {
    const response = await fetch(`${env.apiUrl}/v1/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request_id: `render-${input.jobKind}-${input.pageNumber}-${Date.now()}`,
        page_number: input.pageNumber,
        delivery_mode: input.deliveryMode,
        job_kind: input.jobKind,
        render_profile: input.renderProfile ?? getColoringEngineRenderProfile(),
        contour_core: input.contourCore,
        child_first_name: input.childFirstName ?? null,
        image_base64: input.source.buffer.toString("base64"),
        debug: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok || !payload) {
      const detail =
        (payload && typeof payload.detail === "string" ? payload.detail : null) ??
        (payload && typeof payload.error === "string" ? payload.error : null) ??
        `Coloring engine request failed with status ${response.status}.`;
      throw new Error(detail);
    }

    const imageBase64 = typeof payload.line_art_base64 === "string" ? payload.line_art_base64 : null;
    const mimeType = typeof payload.mime_type === "string" ? payload.mime_type : "image/png";
    const engine = typeof payload.engine === "string" ? payload.engine : "littlecolorbook-coloring-engine";
    const engineVersion = typeof payload.engine_version === "string" ? payload.engine_version : "unknown";
    const engineVariant = typeof payload.engine_variant === "string" ? payload.engine_variant : null;
    const quality = asRecord(payload.quality);
    const providerQa: ProviderQualityMetrics | null = quality
      ? {
          blackRatio: typeof quality.black_ratio === "number" ? quality.black_ratio : null,
          edgeDensity: typeof quality.edge_density === "number" ? quality.edge_density : null,
          lineClosureScore: typeof quality.line_closure_score === "number" ? quality.line_closure_score : null,
          noiseRatio: typeof quality.noise_ratio === "number" ? quality.noise_ratio : null,
        }
      : null;
    const providerQaFlags = Array.isArray(payload.quality_flags)
      ? payload.quality_flags.filter((flag): flag is string => typeof flag === "string" && flag.length > 0)
      : [];

    if (!imageBase64) {
      throw new Error("Coloring engine did not return line_art_base64.");
    }

    return {
      buffer: Buffer.from(imageBase64, "base64"),
      mimeType,
      model: engineVariant ? `${engine}:${engineVersion}:${engineVariant}` : `${engine}:${engineVersion}`,
      provider: "custom-python",
      providerQa,
      providerQaFlags,
      renderAttempts: 1,
    } satisfies RenderedPage;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Coloring engine timed out after ${env.timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function renderImageWithCustomPython(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  source: RenderingSource;
}) {
  const primaryContourCore = getColoringEngineContourCore();
  const primary = await requestColoringEngineRender({
    ...input,
    contourCore: primaryContourCore,
  });

  if (shouldProbeDenseSceneAlternate(primary, primaryContourCore)) {
    let alternate: RenderedPage;

    try {
      alternate = await requestColoringEngineRender({
        ...input,
        contourCore: "controlnet-lineart-coarse",
      });
    } catch {
      return primary;
    }

    return shouldPreferDenseSceneAlternate(primary, alternate) ? alternate : primary;
  }

  if (shouldProbeSubjectFocusAlternate(primary, primaryContourCore)) {
    let alternate: RenderedPage;

    try {
      alternate = await requestColoringEngineRender({
        ...input,
        contourCore: "controlnet-lineart-coarse",
        renderProfile: "subject-focus",
      });
    } catch {
      return primary;
    }

    return shouldPreferSubjectFocusAlternate(primary, alternate) ? alternate : primary;
  }

  return primary;
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

function pagePassesQa(blackRatio: number) {
  return blackRatio >= 0.012 && blackRatio <= 0.33;
}

function getQaThresholds(provider: PipelineProvider) {
  if (provider === "custom-python") {
    return {
      maxNoisyComponentCount: 220,
      maxSpeckleRatio: 0.012,
    };
  }

  return {
    maxNoisyComponentCount: 110,
    maxSpeckleRatio: 0.005,
  };
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

function processedPagePassesQa(
  input: { blackRatio: number; noisyComponentCount: number; speckleRatio: number },
  provider: PipelineProvider,
) {
  const thresholds = getQaThresholds(provider);

  return (
    pagePassesQa(input.blackRatio) &&
    input.noisyComponentCount <= thresholds.maxNoisyComponentCount &&
    input.speckleRatio <= thresholds.maxSpeckleRatio
  );
}

function getPostProcessQaFlags(
  provider: PipelineProvider,
  input: { blackRatio: number; noisyComponentCount: number; speckleRatio: number },
) {
  const flags: string[] = [];
  const thresholds = getQaThresholds(provider);

  if (input.blackRatio < 0.012) {
    flags.push("final_too_sparse");
  }
  if (input.blackRatio > 0.33) {
    flags.push("final_too_dense");
  }
  if (input.noisyComponentCount > thresholds.maxNoisyComponentCount) {
    flags.push("final_fragmented");
  }
  if (input.speckleRatio > thresholds.maxSpeckleRatio) {
    flags.push("final_noisy");
  }

  return flags;
}

function calculateQaScore(provider: PipelineProvider, input: { qaFlags: string[]; qaMetrics: PageQualityMetrics }) {
  const thresholds = getQaThresholds(provider);
  const densityPenalty = Math.min(Math.abs(input.qaMetrics.finalBlackRatio - 0.12) / 0.18, 1) * 38;
  const specklePenalty = Math.min(input.qaMetrics.finalSpeckleRatio / thresholds.maxSpeckleRatio, 1) * 24;
  const fragmentationPenalty = Math.min(input.qaMetrics.finalNoisyComponentCount / thresholds.maxNoisyComponentCount, 1) * 18;
  const providerNoisePenalty =
    input.qaMetrics.providerNoiseRatio !== null ? Math.min(input.qaMetrics.providerNoiseRatio / 0.01, 1) * 8 : 0;
  const providerClosurePenalty =
    input.qaMetrics.providerLineClosureScore !== null ? (1 - input.qaMetrics.providerLineClosureScore) * 8 : 0;
  const flagPenalty = Math.min(input.qaFlags.length * 6, 18);

  return Number(
    Math.max(0, 100 - densityPenalty - specklePenalty - fragmentationPenalty - providerNoisePenalty - providerClosurePenalty - flagPenalty).toFixed(1),
  );
}

function getCustomPythonCleanupThreshold(providerBlackRatio: number | null | undefined) {
  const br = typeof providerBlackRatio === "number" ? providerBlackRatio : 0.12;
  if (br < 0.08) return 205;
  if (br < 0.12) return 215;
  if (br < 0.16) return 220;
  return 225;
}

function getCustomPythonSpeckleMinComponentSize() {
  const value = Number(process.env.COLORING_ENGINE_CLEANUP_SPECKLE_MIN_COMPONENT ?? "1200");
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1200;
}

function getCustomPythonAggressiveCleanupNoiseThreshold() {
  const value = Number(process.env.COLORING_ENGINE_CLEANUP_AGGRESSIVE_NOISE_THRESHOLD ?? "0.0003");
  return Number.isFinite(value) && value >= 0 ? value : 0.0003;
}

function getCustomPythonAggressiveCleanupClosureThreshold() {
  const value = Number(process.env.COLORING_ENGINE_CLEANUP_AGGRESSIVE_CLOSURE_THRESHOLD ?? "0.9");
  return Number.isFinite(value) && value > 0 ? value : 0.9;
}

function shouldUseAggressiveCleanup(providerNoise: number | null | undefined, providerClosure: number | null | undefined) {
  if (typeof providerNoise === "number" && providerNoise >= getCustomPythonAggressiveCleanupNoiseThreshold()) return true;
  if (typeof providerClosure === "number" && providerClosure < getCustomPythonAggressiveCleanupClosureThreshold()) return true;
  return false;
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
  const customPythonThreshold = getCustomPythonCleanupThreshold(input.providerBlackRatio);
  const cleaned =
    input.provider === "custom-python"
      ? await removeSmallBlackComponents(
          await basePipeline
            .threshold(customPythonThreshold)
            .resize({
              width: FINAL_PAGE_SIZE.width - margin * 2,
              height: FINAL_PAGE_SIZE.height - margin * 2,
              fit: "inside",
              background: "#ffffff",
              withoutEnlargement: false,
            })
            .png()
            .toBuffer(),
          getCustomPythonSpeckleMinComponentSize(),
        )
      : await basePipeline
          .normalise()
          .linear(1.18, -12)
          .median(1)
          .threshold(208)
          .erode(1)
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

  const noiseMetrics = await measureNoiseMetrics(finalPng);

  return {
    blackRatio: await measureBlackRatio(finalPng),
    finalPng,
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

  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    const model = attempt === 0 ? input.primaryModel : getFallbackModel(input.primaryModel);
    const prompt = buildColoringPrompt({
      attempt,
      childFirstName: input.childFirstName,
      deliveryMode: input.deliveryMode,
      jobKind: input.jobKind,
      pageNumber: input.pageNumber,
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

      return {
        ...rendered,
        renderAttempts: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Gemini generation error.");
    }
  }

  throw lastError ?? new Error(`Failed to generate page ${input.pageNumber}.`);
}

async function renderSourceWithConfiguredProvider(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  enforceQa?: boolean;
  fallbackModel?: string | null;
  fallbackProvider?: PipelineProvider | null;
  jobKind: PipelineJobKind;
  pageNumber: number;
  primaryModel: string;
  primaryProvider: PipelineProvider;
  imageSize: GeminiImageSize;
  source: RenderingSource;
}) {
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

  for (const strategy of strategies) {
    try {
      const rendered =
        strategy.provider === "custom-python"
          ? await renderImageWithCustomPython({
              childFirstName: input.childFirstName,
              deliveryMode: input.deliveryMode,
              jobKind: input.jobKind,
              pageNumber: input.pageNumber,
              source: input.source,
            })
          : await renderImageWithGeminiWithRetries({
              childFirstName: input.childFirstName,
              deliveryMode: input.deliveryMode,
              jobKind: input.jobKind,
              pageNumber: input.pageNumber,
              primaryModel: strategy.model,
              imageSize: input.imageSize,
              source: input.source,
            });

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
        finalSpeckleRatio: processed.speckleRatio,
        finalNoisyComponentCount: processed.noisyComponentCount,
        providerBlackRatio: rendered.providerQa?.blackRatio ?? null,
        providerEdgeDensity: rendered.providerQa?.edgeDensity ?? null,
        providerLineClosureScore: rendered.providerQa?.lineClosureScore ?? null,
        providerNoiseRatio: rendered.providerQa?.noiseRatio ?? null,
      };
      const qaFlags = Array.from(new Set([...rendered.providerQaFlags, ...getPostProcessQaFlags(rendered.provider, processed)]));
      const qaScore = calculateQaScore(rendered.provider, {
        qaFlags,
        qaMetrics,
      });

      if ((input.enforceQa ?? true) && !processedPagePassesQa(processed, rendered.provider)) {
        lastError = new Error(
          `[${strategy.provider}:${strategy.model}] Rendered page ${input.pageNumber} failed QA with black ratio ${processed.blackRatio.toFixed(4)}, noisy components ${processed.noisyComponentCount}, and speckle ratio ${processed.speckleRatio.toFixed(4)}.`,
        );
        strategyErrors.push(lastError.message);
        continue;
      }

      return {
        ...processed,
        cleanupVersion: pipelineCleanupVersion,
        model: rendered.model,
        promptVersion: pipelinePromptVersion,
        provider: rendered.provider,
        qaFlags,
        qaMetrics,
        qaScore,
        renderAttempts: rendered.renderAttempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown rendering error.");
      strategyErrors.push(`[${strategy.provider}:${strategy.model}] ${lastError.message}`);
    }
  }

  throw new Error(strategyErrors.length > 0 ? strategyErrors.join(" | ") : lastError?.message ?? `Failed to generate page ${input.pageNumber}.`);
}

async function materializePage(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  fallbackModel?: string | null;
  fallbackProvider?: PipelineProvider | null;
  jobKind: PipelineJobKind;
  pageNumber: number;
  primaryModel: string;
  primaryProvider: PipelineProvider;
  imageSize: GeminiImageSize;
  upload: SourceUpload;
}) {
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

export async function renderMarketingPage(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  enforceQa?: boolean;
  fallbackModel?: string | null;
  fallbackProvider?: PipelineProvider | null;
  jobKind: PipelineJobKind;
  pageNumber: number;
  primaryModel: string;
  primaryProvider: PipelineProvider;
  imageSize: GeminiImageSize;
  source: RenderingSource;
}) {
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
  const palette: Record<CoverStyleCode, { back: [number, number, number]; front: [number, number, number]; title: [number, number, number]; body: [number, number, number] }> =
    {
      storybook: {
        back: [0.99, 0.96, 0.9],
        front: [0.97, 0.88, 0.62],
        title: [0.18, 0.14, 0.08],
        body: [0.28, 0.22, 0.14],
      },
      sunshine: {
        back: [1, 0.98, 0.9],
        front: [1, 0.9, 0.52],
        title: [0.27, 0.15, 0.1],
        body: [0.36, 0.21, 0.12],
      },
      crayon: {
        back: [0.99, 0.96, 0.95],
        front: [0.94, 0.62, 0.57],
        title: [0.22, 0.1, 0.08],
        body: [0.32, 0.16, 0.12],
      },
      minimal: {
        back: [0.98, 0.98, 0.98],
        front: [0.9, 0.9, 0.9],
        title: [0.07, 0.07, 0.07],
        body: [0.2, 0.2, 0.2],
      },
    };
  const colors = palette[coverStyle];

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
  if (coverStyle === "adventure") return "crayon";
  if (coverStyle === "storybook" || coverStyle === "sunshine" || coverStyle === "crayon" || coverStyle === "minimal") {
    return coverStyle;
  }
  return "storybook";
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
  const contentPages = 2 + input.pageBuffers.length + 1;
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
}): Promise<MaterializedPlan> {
  const uploads = input.uploads.length > 0 ? input.uploads : [{ fileName: "uploaded-photo.jpg", objectPath: "missing-upload.jpg" }];
  const assets: MaterializedAsset[] = [];
  const pageBuffers: Buffer[] = [];
  const pageResults: MaterializedPageResult[] = [];
  const renderSettings = getPipelineRenderSettings(input.plan.deliveryMode, input.plan.jobKind);
  let modelUsed = renderSettings.model;
  let providerUsed: PipelineProvider = renderSettings.provider;

  const concurrency = Number(process.env.PIPELINE_CONCURRENCY ?? "20");
  const { default: pLimit } = await import("p-limit");
  const limit = pLimit(concurrency);

  const renderTasks = input.plan.pages.map((page) =>
    limit(async () => {
      const matchedUpload = uploads.find((upload) => upload.id && upload.id === page.sourceUploadId) ?? uploads[(page.pageNumber - 1) % uploads.length];
      const rendered = await materializePage({
        childFirstName: input.childFirstName,
        deliveryMode: input.plan.deliveryMode,
        fallbackModel: renderSettings.fallbackModel,
        fallbackProvider: renderSettings.fallbackProvider,
        jobKind: input.plan.jobKind,
        pageNumber: page.pageNumber,
        primaryModel: renderSettings.model,
        primaryProvider: renderSettings.provider,
        imageSize: renderSettings.imageSize,
        upload: matchedUpload,
      });
      return { page, rendered };
    }),
  );

  const completedPages = await Promise.all(renderTasks);

  for (const { page, rendered } of completedPages.sort((a, b) => a.page.pageNumber - b.page.pageNumber)) {
    modelUsed = rendered.model;
    providerUsed = rendered.provider;
    pageBuffers.push(rendered.finalPng);
    pageResults.push({
      cleanupVersion: rendered.cleanupVersion,
      model: rendered.model,
      pageNumber: page.pageNumber,
      promptVersion: rendered.promptVersion,
      provider: rendered.provider,
      qaFlags: rendered.qaFlags,
      qaMetrics: rendered.qaMetrics,
      qaScore: rendered.qaScore,
      renderAttempts: rendered.renderAttempts,
      sourceUploadId: page.sourceUploadId,
    });
    assets.push({
      body: rendered.finalPng,
      contentType: "image/png",
      kind: "generated_page",
      objectPath: page.generatedImagePath,
      pageNumber: page.pageNumber,
    });
    assets.push({
      body: rendered.previewJpeg,
      contentType: "image/jpeg",
      kind: "preview",
      objectPath: page.previewImagePath,
      pageNumber: page.pageNumber,
    });
  }

  if (input.plan.jobKind === "full_book") {
    const { renderCoverPdf, renderInteriorPdf } = await import("@littlecolorbook/pdf-templates/render");
    const printTrim = getTrim();
    const basePayload = buildBookPayload({
      childFirstName: input.childFirstName,
      coverStyle: input.coverStyle,
      dedicationText: input.dedicationText,
      occasion: input.occasion,
      occasionContext: input.occasionContext,
      pageBuffers,
      titleName: input.childFirstName,
      trim: printTrim,
    });

    const downloadPayload: BookPayload = { ...basePayload, trim: DIGITAL_TRIM };
    const downloadPdf = await renderInteriorPdf(downloadPayload);

    const interiorPdf =
      input.plan.deliveryMode === "print"
        ? await renderInteriorPdf(basePayload)
        : downloadPdf;

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
          pageBuffers,
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
  }

  return {
    assets,
    model: modelUsed,
    pageResults,
    provider: providerUsed,
  };
}
