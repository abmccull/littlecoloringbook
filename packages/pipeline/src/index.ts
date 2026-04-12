import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { estimateInteriorPageCount, normalizeCoverStyle, type CoverStyleCode, type DeliveryMode } from "@littlecolorbook/shared";
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

export type PipelineJobKind = "sample" | "full_book";

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
  "crop closer on the main subjects and remove distant background detail",
  "keep faces large and readable with simple clothing shapes and strong outer contours",
  "reduce the scene to the clearest interaction and the biggest recognizable forms",
  "leave generous white space around the subjects and keep props minimal",
  "simplify the environment into one or two large grounding shapes at most",
  "favor a clean portrait composition over preserving every object from the photo",
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

export type MaterializedPlan = {
  assets: MaterializedAsset[];
  model: string;
  provider: "gemini";
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
};

type PipelineRenderSettings = {
  imageSize: GeminiImageSize;
  model: string;
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

  return {
    imageSize,
    model,
  };
}

function getFallbackModel(primaryModel: string) {
  return process.env.GEMINI_IMAGE_FALLBACK_MODEL ?? (primaryModel === FALLBACK_IMAGE_MODEL ? PRIMARY_IMAGE_MODEL : FALLBACK_IMAGE_MODEL);
}

function buildColoringPrompt(input: {
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
      ? "The previous result was not premium enough. Remove more background, use fewer but cleaner closed contours, enlarge the faces, and eliminate sketchy fragments or noise."
      : null;

  return [
    "Convert the provided photo into a premium black-and-white children's coloring book page.",
    personalization,
    `Composition goal: ${getCompositionGoal(input.jobKind, input.pageNumber)}.`,
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    input.jobKind === "sample"
      ? "Optimize for the strongest single sellable page, even if that means simplifying or removing more of the original scene."
      : "Keep the page consistent with a premium keepsake book rather than a novelty sketch.",
    "Use smooth, continuous, closed black contours with medium-thick, consistent line weight.",
    "Faces must stay readable with a few clean lines. Keep the eyes, nose, mouth, hair shape, and clothing silhouette recognizable without adding texture.",
    "Use a pure white background or at most one or two large simple grounding shapes.",
    "Do not add color, gray shading, crosshatching, halftones, stippling, sketch texture, speech bubbles, captions, borders, or text.",
    "Do not leave disconnected stray marks, floating fragments, or tiny noisy details anywhere on the page.",
    "Do not fill dark clothing, shadows, or hair with solid black. Convert dark regions into open outline shapes a child can color.",
    "Keep the image open, simple, friendly, and easy for a child to color, with large colorable areas and clear silhouettes.",
    "If the photo contains multiple people, enlarge and simplify the primary one to three subjects so each face reads clearly at coloring-book scale.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    input.deliveryMode === "print"
      ? "The page must hold up in print. Favor crisp outlines, simple backgrounds, larger shapes, and stable line weight over photo-realistic detail."
      : "The page should look clean on screen and be easy to print at home.",
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
  const response = await fetch(`${getGeminiApiBaseUrl()}/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, {
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

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || !payload) {
    const detail =
      (payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
        ? payload.error.message
        : null) ?? `Gemini image generation failed with status ${response.status}.`;
    throw new Error(detail);
  }

  const imagePart = extractGeneratedImage(payload);

  return {
    buffer: Buffer.from(imagePart.data, "base64"),
    mimeType: imagePart.mimeType,
    model: input.model,
  } satisfies RenderedPage;
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

function processedPagePassesQa(input: { blackRatio: number; noisyComponentCount: number; speckleRatio: number }) {
  return pagePassesQa(input.blackRatio) && input.noisyComponentCount <= 110 && input.speckleRatio <= 0.005;
}

async function cleanupGeneratedPage(input: {
  deliveryMode: DeliveryMode;
  imageBuffer: Buffer;
}) {
  const margin = input.deliveryMode === "print" ? 170 : 150;

  const cleaned = await sharp(input.imageBuffer)
    .rotate()
    .flatten({ background: "#ffffff" })
    .grayscale()
    .normalise()
    .linear(1.18, -12)
    .median(1)
    .threshold(208)
    .negate()
    .dilate(1)
    .negate()
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

async function materializePage(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  primaryModel: string;
  imageSize: GeminiImageSize;
  upload: SourceUpload;
}) {
  const sourceBuffer = await downloadObject({
    bucket: "uploads",
    objectPath: input.upload.objectPath,
  });
  const mimeType = inferUploadMimeType(input.upload);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    const model = attempt === 0 ? input.primaryModel : getFallbackModel(input.primaryModel);
    const prompt = buildColoringPrompt({
      attempt,
      childFirstName: input.childFirstName,
      deliveryMode: input.deliveryMode,
      jobKind: input.jobKind,
      pageNumber: input.pageNumber,
      sourceLabel: input.upload.fileName,
    });

    try {
      const rendered = await renderImageWithGemini({
        attempt,
        deliveryMode: input.deliveryMode,
        imageSize: input.imageSize,
        mimeType,
        model,
        prompt,
        sourceBuffer,
      });
      const processed = await cleanupGeneratedPage({
        deliveryMode: input.deliveryMode,
        imageBuffer: rendered.buffer,
      });

      if (!processedPagePassesQa(processed)) {
        lastError = new Error(
          `Rendered page ${input.pageNumber} failed QA with black ratio ${processed.blackRatio.toFixed(4)}, noisy components ${processed.noisyComponentCount}, and speckle ratio ${processed.speckleRatio.toFixed(4)}.`,
        );
        continue;
      }

      return {
        ...processed,
        model: rendered.model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Gemini generation error.");
    }
  }

  throw lastError ?? new Error(`Failed to generate page ${input.pageNumber}.`);
}

export async function renderMarketingPage(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
  jobKind: PipelineJobKind;
  pageNumber: number;
  primaryModel: string;
  imageSize: GeminiImageSize;
  source: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  };
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
      const processed = await cleanupGeneratedPage({
        deliveryMode: input.deliveryMode,
        imageBuffer: rendered.buffer,
      });

      if (!processedPagePassesQa(processed)) {
        lastError = new Error(
          `Rendered page ${input.pageNumber} failed QA with black ratio ${processed.blackRatio.toFixed(4)}, noisy components ${processed.noisyComponentCount}, and speckle ratio ${processed.speckleRatio.toFixed(4)}.`,
        );
        continue;
      }

      return {
        ...processed,
        model: rendered.model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Gemini generation error.");
    }
  }

  throw lastError ?? new Error(`Failed to generate page ${input.pageNumber}.`);
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
  const renderSettings = getPipelineRenderSettings(input.plan.deliveryMode, input.plan.jobKind);
  let modelUsed = renderSettings.model;

  for (const page of input.plan.pages) {
    const matchedUpload = uploads.find((upload) => upload.id && upload.id === page.sourceUploadId) ?? uploads[(page.pageNumber - 1) % uploads.length];
    const rendered = await materializePage({
      childFirstName: input.childFirstName,
      deliveryMode: input.plan.deliveryMode,
      jobKind: input.plan.jobKind,
      pageNumber: page.pageNumber,
      primaryModel: renderSettings.model,
      imageSize: renderSettings.imageSize,
      upload: matchedUpload,
    });

    modelUsed = rendered.model;
    pageBuffers.push(rendered.finalPng);
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
    provider: "gemini",
  };
}
