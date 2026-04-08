import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { estimateInteriorPageCount, type DeliveryMode } from "@littlecolorbook/shared";
import { downloadObject } from "@littlecolorbook/shared/storage";

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

const variationGoals = [
  "focus on the main subject with a clean white background and only one or two playful props",
  "turn the scene into a simple portrait page with bold outlines and lots of open coloring space",
  "keep the subject recognizable while simplifying the background into a few stars, hearts, clouds, or soft shapes",
  "make the page feel adventurous and playful, but keep every shape easy for a child to color",
  "emphasize the face, clothing, and pose while removing photo clutter and tiny texture detail",
  "compose the page like a classic workbook illustration with clear foreground subject and a lightly simplified setting",
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
  previewJpeg: Buffer;
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

function getVariationGoal(pageNumber: number) {
  return variationGoals[(pageNumber - 1) % variationGoals.length];
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
        ? (process.env.GEMINI_IMAGE_SIZE_SAMPLE as GeminiImageSize | undefined) ?? "2K"
        : (process.env.GEMINI_IMAGE_SIZE as GeminiImageSize | undefined) ?? defaultImageSize;

  const model =
    deliveryMode === "print"
      ? process.env.GEMINI_IMAGE_MODEL_PRINT ?? process.env.GEMINI_IMAGE_MODEL ?? PRIMARY_IMAGE_MODEL
      : jobKind === "sample"
        ? process.env.GEMINI_IMAGE_MODEL_SAMPLE ?? process.env.GEMINI_IMAGE_MODEL ?? PRIMARY_IMAGE_MODEL
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
  pageNumber: number;
  sourceLabel: string;
}) {
  const personalization = input.childFirstName
    ? `Make the page feel personalized for ${input.childFirstName}, while keeping the real people or pets from the photo recognizable.`
    : "Keep the real people or pets from the photo recognizable.";

  const retryLine =
    input.attempt > 0
      ? "The previous result was too muddy or too dark. Simplify the scene even more, remove background clutter, and use fewer but clearer outlines."
      : null;

  return [
    "Turn the provided family photo into a black-and-white children's coloring book page.",
    personalization,
    `Variation goal: ${getVariationGoal(input.pageNumber)}.`,
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    "Use only strong black outlines on a pure white background.",
    "Do not add color, gray shading, crosshatching, halftones, speech bubbles, captions, borders, or text.",
    "Avoid large filled black regions. Keep the image open, simple, friendly, and easy for a child to color.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    input.deliveryMode === "print"
      ? "The page must hold up in print. Favor crisp outlines, simple backgrounds, and larger shapes over photo-realistic detail."
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

  return {
    blackRatio: await measureBlackRatio(finalPng),
    finalPng,
    previewJpeg,
  } satisfies ProcessedPageAsset;
}

async function materializePage(input: {
  childFirstName?: string | null;
  deliveryMode: DeliveryMode;
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

      if (!pagePassesQa(processed.blackRatio)) {
        lastError = new Error(`Rendered page ${input.pageNumber} failed QA with black ratio ${processed.blackRatio.toFixed(4)}.`);
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

      if (!pagePassesQa(processed.blackRatio)) {
        lastError = new Error(`Rendered page ${input.pageNumber} failed QA with black ratio ${processed.blackRatio.toFixed(4)}.`);
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
  childFirstName?: string | null;
  designCount: number;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PRINT_COVER_PAGE.width, PRINT_COVER_PAGE.height]);
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const frontX = PRINT_COVER_PAGE.width / 2 + 42;
  const backX = 42;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PRINT_COVER_PAGE.width,
    height: PRINT_COVER_PAGE.height,
    color: rgb(0.99, 0.96, 0.9),
  });

  page.drawRectangle({
    x: PRINT_COVER_PAGE.width / 2,
    y: 0,
    width: PRINT_COVER_PAGE.width / 2,
    height: PRINT_COVER_PAGE.height,
    color: rgb(0.97, 0.88, 0.62),
  });

  page.drawText("littlecolorbook.com", {
    x: backX,
    y: PRINT_COVER_PAGE.height - 92,
    size: 18,
    font: titleFont,
    color: rgb(0.2, 0.17, 0.12),
  });
  page.drawText("A personalized coloring book made from real family photos.", {
    x: backX,
    y: PRINT_COVER_PAGE.height - 130,
    size: 12,
    font: bodyFont,
    color: rgb(0.28, 0.24, 0.18),
    maxWidth: PRINT_COVER_PAGE.width / 2 - 84,
  });

  page.drawText(input.childFirstName ? `${input.childFirstName}'s` : "My", {
    x: frontX,
    y: PRINT_COVER_PAGE.height - 180,
    size: 34,
    font: titleFont,
    color: rgb(0.18, 0.14, 0.08),
  });
  page.drawText("memory coloring book", {
    x: frontX,
    y: PRINT_COVER_PAGE.height - 226,
    size: 28,
    font: titleFont,
    color: rgb(0.18, 0.14, 0.08),
  });
  page.drawText(`${input.designCount} personalized designs`, {
    x: frontX,
    y: PRINT_COVER_PAGE.height - 268,
    size: 16,
    font: bodyFont,
    color: rgb(0.28, 0.22, 0.14),
  });

  return Buffer.from(await doc.save());
}

export function buildGenerationPlan(input: {
  deliveryMode: DeliveryMode;
  designCount: number;
  jobKind: PipelineJobKind;
  orderId: string;
  sourceUploadIds: string[];
}) {
  const targetPages = input.jobKind === "sample" ? 1 : input.designCount;
  const sourceUploadIds = input.sourceUploadIds.length > 0 ? input.sourceUploadIds : [""];

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
      coverPdfPath: input.deliveryMode === "print" ? `orders/${input.orderId}/pdf/cover.pdf` : null,
      downloadPdfPath: `orders/${input.orderId}/pdf/download.pdf`,
      interiorPdfPath: `orders/${input.orderId}/pdf/interior.pdf`,
    },
    targetPages,
  } satisfies GenerationPlan;
}

export async function materializeGenerationPlan(input: {
  childFirstName?: string | null;
  dedicationText?: string | null;
  plan: GenerationPlan;
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
    const downloadPdf = await createDownloadPdf({
      childFirstName: input.childFirstName,
      dedicationText: input.dedicationText,
      designCount: input.plan.designCount,
      orderId: input.plan.orderId,
      pageBuffers,
    });

    const interiorPdf =
      input.plan.deliveryMode === "print"
        ? await createPrintInteriorPdf({
            childFirstName: input.childFirstName,
            dedicationText: input.dedicationText,
            designCount: input.plan.designCount,
            orderId: input.plan.orderId,
            pageBuffers,
          })
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

    if (input.plan.pdf.coverPdfPath) {
      const coverPdf = await createPrintCoverPdf({
        childFirstName: input.childFirstName,
        designCount: input.plan.designCount,
      });

      assets.push({
        body: coverPdf,
        contentType: "application/pdf",
        kind: "cover_pdf",
        objectPath: input.plan.pdf.coverPdfPath,
      });
    }
  }

  return {
    assets,
    model: modelUsed,
    provider: "gemini",
  };
}
