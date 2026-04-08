import "server-only";

import { createHash } from "node:crypto";
import { getAssetsByIds, getUploadsByIds, isDatabaseConfigured } from "@littlecolorbook/db";
import { getPipelineRenderSettings, renderMarketingPage } from "@littlecolorbook/pipeline";
import {
  createMarketingRequestId,
  getOfferByCode,
  type InternalProductAssetRequest,
  type InternalProductAssetResponse,
  type InternalProductAssetResponseAsset,
  type MarketingArcadsBatchCreateRequest,
  type MarketingGammaGenerateRequest,
  type MarketingVoiceRenderRequest,
} from "@littlecolorbook/shared";
import { getArcadsEnv, getElevenLabsEnv, getGammaEnv, getIntegrationStatus, getMarketingVideoEnv } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, downloadObject, uploadObject, type StorageBucketKind } from "@littlecolorbook/shared/storage";
import sharp from "sharp";

type ResolvedMarketingSource = {
  sourceAssetId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
};

type MarketingCanvas = {
  width: number;
  height: number;
};

const CANVAS_BY_RATIO: Record<string, MarketingCanvas> = {
  "1:1": { width: 1200, height: 1200 },
  "3:4": { width: 1200, height: 1600 },
  "4:5": { width: 1200, height: 1500 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1600, height: 900 },
};

function inferExtension(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "audio/wav") return "wav";
  if (contentType === "audio/mpeg") return "mp3";
  return "png";
}

function hashForId(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function guessBucketFromObjectPath(objectPath: string): StorageBucketKind {
  return objectPath.startsWith("orders/") || objectPath.startsWith("marketing/") ? "exports" : "uploads";
}

function maybeParseGcsRef(sourceAssetId: string) {
  const gcsMatch = sourceAssetId.match(/^gcs:\/\/(uploads|exports)\/(.+)$/);

  if (!gcsMatch) {
    return null;
  }

  return {
    bucket: gcsMatch[1] as StorageBucketKind,
    objectPath: gcsMatch[2]!,
  };
}

async function fetchRemoteBuffer(sourceAssetId: string) {
  const response = await fetch(sourceAssetId, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch marketing source '${sourceAssetId}' with status ${response.status}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const url = new URL(sourceAssetId);
  const fileName = url.pathname.split("/").filter(Boolean).pop() ?? `${hashForId(sourceAssetId)}.jpg`;
  const contentType = response.headers.get("content-type") ?? "image/jpeg";

  return {
    sourceAssetId,
    fileName,
    contentType,
    buffer,
  } satisfies ResolvedMarketingSource;
}

async function downloadByObjectPath(sourceAssetId: string, bucket: StorageBucketKind, objectPath: string, fileName?: string, contentType?: string) {
  const buffer = await downloadObject({ bucket, objectPath });

  return {
    sourceAssetId,
    fileName: fileName ?? sanitizeFileName(objectPath.split("/").pop() ?? `${hashForId(objectPath)}.jpg`),
    contentType: contentType ?? "image/jpeg",
    buffer,
  } satisfies ResolvedMarketingSource;
}

async function resolveMarketingSources(sourceAssetIds: string[]) {
  const resolved = new Map<string, ResolvedMarketingSource>();
  const unresolved = new Set(sourceAssetIds);

  if (isDatabaseConfigured()) {
    const [uploads, assets] = await Promise.all([getUploadsByIds(sourceAssetIds), getAssetsByIds(sourceAssetIds)]);

    for (const upload of uploads) {
      unresolved.delete(upload.id);
      resolved.set(
        upload.id,
        await downloadByObjectPath(upload.id, "uploads", upload.objectPath, upload.fileName, upload.contentType),
      );
    }

    for (const asset of assets) {
      unresolved.delete(asset.id);
      resolved.set(
        asset.id,
        await downloadByObjectPath(asset.id, "exports", asset.objectPath, `${asset.kind}-${asset.id}.png`, asset.mimeType),
      );
    }
  }

  for (const sourceAssetId of unresolved) {
    if (sourceAssetId.startsWith("http://") || sourceAssetId.startsWith("https://")) {
      resolved.set(sourceAssetId, await fetchRemoteBuffer(sourceAssetId));
      continue;
    }

    const gcsRef = maybeParseGcsRef(sourceAssetId);

    if (gcsRef) {
      resolved.set(
        sourceAssetId,
        await downloadByObjectPath(sourceAssetId, gcsRef.bucket, gcsRef.objectPath, gcsRef.objectPath.split("/").pop(), undefined),
      );
      continue;
    }

    if (sourceAssetId.includes("/")) {
      const bucket = guessBucketFromObjectPath(sourceAssetId);
      resolved.set(
        sourceAssetId,
        await downloadByObjectPath(sourceAssetId, bucket, sourceAssetId, sourceAssetId.split("/").pop(), undefined),
      );
      continue;
    }

    throw new Error(`Unable to resolve marketing source asset '${sourceAssetId}'.`);
  }

  return sourceAssetIds.map((sourceAssetId) => {
    const source = resolved.get(sourceAssetId);

    if (!source) {
      throw new Error(`Unable to load marketing source '${sourceAssetId}'.`);
    }

    return source;
  });
}

async function fitImageOnCanvas(input: {
  buffer: Buffer;
  canvas: MarketingCanvas;
  background?: string;
  padding?: number;
}) {
  const background = input.background ?? "#ffffff";
  const padding = input.padding ?? 0;
  const width = Math.max(1, input.canvas.width - padding * 2);
  const height = Math.max(1, input.canvas.height - padding * 2);

  const fitted = await sharp(input.buffer)
    .flatten({ background })
    .resize({
      width,
      height,
      fit: "contain",
      background,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const metadata = await sharp(fitted).metadata();
  const left = Math.floor((input.canvas.width - (metadata.width ?? width)) / 2);
  const top = Math.floor((input.canvas.height - (metadata.height ?? height)) / 2);

  return sharp({
    create: {
      width: input.canvas.width,
      height: input.canvas.height,
      channels: 4,
      background,
    },
  })
    .composite([{ input: fitted, left, top }])
    .png()
    .toBuffer();
}

async function encodeBufferAsContentType(buffer: Buffer, contentType: string) {
  if (contentType === "image/jpeg") {
    return sharp(buffer).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }

  if (contentType === "image/webp") {
    return sharp(buffer).webp({ quality: 88 }).toBuffer();
  }

  return sharp(buffer).png().toBuffer();
}

function createTextOverlaySvg(input: {
  width: number;
  height: number;
  title?: string;
  subtitle?: string;
  accent?: string;
  align?: "left" | "center";
}) {
  const accent = input.accent ?? "#f3b965";
  const align = input.align ?? "left";
  const textAnchor = align === "center" ? "middle" : "start";
  const x = align === "center" ? input.width / 2 : 64;

  const subtitleSvg = input.subtitle
    ? `<text x="${x}" y="148" font-size="38" font-family="Helvetica, Arial, sans-serif" fill="#5b4632" text-anchor="${textAnchor}">${escapeXml(
        input.subtitle,
      )}</text>`
    : "";

  return Buffer.from(`
    <svg width="${input.width}" height="${input.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${input.width}" height="190" rx="0" fill="rgba(255,248,237,0.96)" />
      <rect x="0" y="0" width="${input.width}" height="16" fill="${accent}" />
      ${input.title ? `<text x="${x}" y="96" font-size="56" font-weight="700" font-family="Helvetica, Arial, sans-serif" fill="#2f2418" text-anchor="${textAnchor}">${escapeXml(input.title)}</text>` : ""}
      ${subtitleSvg}
    </svg>
  `);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function composeProofPair(input: {
  aspectRatio: string;
  sourceBuffer: Buffer;
  generatedBuffer: Buffer;
}) {
  const canvas = CANVAS_BY_RATIO[input.aspectRatio] ?? CANVAS_BY_RATIO["4:5"];
  const isPortrait = canvas.height >= canvas.width;
  const panelCanvas = isPortrait
    ? { width: canvas.width, height: Math.floor((canvas.height - 220) / 2) }
    : { width: Math.floor((canvas.width - 72) / 2), height: canvas.height - 220 };
  const topOffset = 190;
  const originalPanel = await fitImageOnCanvas({
    buffer: input.sourceBuffer,
    canvas: panelCanvas,
    background: "#f8f1e8",
    padding: 28,
  });
  const generatedPanel = await fitImageOnCanvas({
    buffer: input.generatedBuffer,
    canvas: panelCanvas,
    background: "#ffffff",
    padding: 28,
  });
  const composites = isPortrait
    ? [
        { input: originalPanel, left: 0, top: topOffset },
        { input: generatedPanel, left: 0, top: topOffset + panelCanvas.height + 24 },
      ]
    : [
        { input: originalPanel, left: 24, top: topOffset },
        { input: generatedPanel, left: 48 + panelCanvas.width, top: topOffset },
      ];

  return sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: "#fffaf3",
    },
  })
    .composite([
      ...composites,
      {
        input: createTextOverlaySvg({
          width: canvas.width,
          height: canvas.height,
          title: "From photo to coloring page",
          subtitle: "Personalized proof creative",
          accent: "#e58d5b",
          align: "center",
        }),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

async function composeBookPreview(input: {
  request: InternalProductAssetRequest;
  pageBuffers: Buffer[];
}) {
  const canvas = CANVAS_BY_RATIO["4:5"];
  const cells = [
    { left: 48, top: 228 },
    { left: 624, top: 228 },
    { left: 48, top: 936 },
    { left: 624, top: 936 },
  ];
  const cellCanvas = { width: 528, height: 660 };
  const pages = input.pageBuffers.slice(0, cells.length);
  const preparedPages = await Promise.all(
    pages.map((pageBuffer) =>
      fitImageOnCanvas({
        buffer: pageBuffer,
        canvas: cellCanvas,
        background: "#ffffff",
        padding: 18,
      }),
    ),
  );

  return sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: "#f7f0e7",
    },
  })
    .composite([
      ...preparedPages.map((pageBuffer, index) => ({
        input: pageBuffer,
        ...cells[index]!,
      })),
      {
        input: createTextOverlaySvg({
          width: canvas.width,
          height: canvas.height,
          title: getOfferByCode(input.request.offerId).title,
          subtitle: `${input.request.pageCountOffer} personalized pages`,
          accent: "#f0a04b",
          align: "center",
        }),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

async function composePrintMockup(input: {
  request: InternalProductAssetRequest;
  coverBuffer: Buffer;
}) {
  const canvas = CANVAS_BY_RATIO["4:5"];
  const book = await sharp(input.coverBuffer)
    .resize({ width: 780, height: 1060, fit: "contain", background: "#fffefb" })
    .png()
    .toBuffer();

  const shadow = Buffer.from(`
    <svg width="880" height="1120" xmlns="http://www.w3.org/2000/svg">
      <rect x="48" y="44" width="760" height="1040" rx="28" fill="rgba(45,31,16,0.12)" />
    </svg>
  `);

  const stack = Buffer.from(`
    <svg width="880" height="1120" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="20" width="760" height="1040" rx="26" fill="#efe5d4" />
      <rect x="38" y="28" width="760" height="1040" rx="26" fill="#f6efe4" />
    </svg>
  `);

  return sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: "#f3eadc",
    },
  })
    .composite([
      { input: shadow, left: 180, top: 274 },
      { input: stack, left: 168, top: 258 },
      { input: book, left: 190, top: 240 },
      {
        input: createTextOverlaySvg({
          width: canvas.width,
          height: canvas.height,
          title: input.request.bundleOffer === "solo" ? "Solo Keepsake" : input.request.bundleOffer === "sibling_set" ? "Sibling Set" : "Sibling Trio",
          subtitle: "Spiral-bound print mockup",
          accent: "#a66f44",
          align: "center",
        }),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

async function composeCoverVariant(input: {
  request: InternalProductAssetRequest;
  pageBuffer: Buffer;
}) {
  const canvas = CANVAS_BY_RATIO["4:5"];
  const inset = await sharp(input.pageBuffer)
    .resize({ width: 720, height: 940, fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();

  const childName = input.request.childFirstName ?? "Your";
  return sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: "#f8dfb1",
    },
  })
    .composite([
      { input: inset, left: 240, top: 420 },
      {
        input: createTextOverlaySvg({
          width: canvas.width,
          height: canvas.height,
          title: `${childName}'s memory coloring book`,
          subtitle: `${input.request.pageCountOffer} personalized pages`,
          accent: "#dc8d53",
          align: "center",
        }),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

async function persistBinaryAsset(input: {
  request: InternalProductAssetRequest;
  assetType: InternalProductAssetResponseAsset["assetType"];
  buffer: Buffer;
  contentType: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  suffix: string;
  provider: "internal-renderer" | "gemini" | "video-api";
}) {
  const extension = inferExtension(input.contentType);
  const assetId = createMarketingRequestId("mktast");
  const objectPath = `marketing/generated/${input.request.requestId}/${input.suffix}.${extension}`;
  const encodedBuffer = await encodeBufferAsContentType(input.buffer, input.contentType);

  await uploadObject({
    bucket: "exports",
    objectPath,
    body: encodedBuffer,
    contentType: input.contentType,
    cacheControl: "private, max-age=3600",
  });

  const signed = await createSignedDownloadUrl({
    bucket: "exports",
    objectPath,
    expiresInMinutes: 24 * 60,
  });

  return {
    assetId,
    assetType: input.assetType,
    sourceAssetIds: input.request.sourceAssetIds,
    storageUrl: `gcs://exports/${objectPath}`,
    previewUrl: signed.url,
    contentType: input.contentType,
    width: input.width ?? null,
    height: input.height ?? null,
    durationMs: input.durationMs ?? null,
    offerId: input.request.offerId,
    pageCountOffer: input.request.pageCountOffer,
    bundleOffer: input.request.bundleOffer,
    occasion: input.request.occasion ?? null,
    renderProfile:
      input.provider === "gemini"
        ? `gemini:${getPipelineRenderSettings(input.request.deliveryMode ?? (input.request.offerId.startsWith("print-") ? "print" : "pdf"), "sample").model}`
        : input.provider,
    createdAt: new Date().toISOString(),
  } satisfies InternalProductAssetResponseAsset;
}

async function executeVideoProvider(input: {
  request: InternalProductAssetRequest;
  imageUrls: string[];
}) {
  const integrations = getIntegrationStatus();

  if (!integrations.marketingVideoConfigured) {
    return null;
  }

  const env = getMarketingVideoEnv();
  const response = await fetch(env.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.apiKey ? { Authorization: `Bearer ${env.apiKey}` } : {}),
    },
    body: JSON.stringify({
      requestId: input.request.requestId,
      orderStyle: input.request.orderStyle,
      offerId: input.request.offerId,
      bundleOffer: input.request.bundleOffer,
      occasion: input.request.occasion,
      imageUrls: input.imageUrls,
      aspectRatios: input.request.aspectRatios,
      outputFormats: input.request.outputFormats,
      notes: input.request.notes,
    }),
  });

  if (!response.ok) {
    throw new Error(`Marketing video API request failed with status ${response.status}.`);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const previewUrl =
    (typeof payload?.previewUrl === "string" && payload.previewUrl) ||
    (typeof payload?.videoUrl === "string" && payload.videoUrl) ||
    (typeof payload?.url === "string" && payload.url) ||
    null;

  if (!previewUrl) {
    return null;
  }

  return {
    assetId: createMarketingRequestId("mktvid"),
    assetType: "book_preview_video" as const,
    sourceAssetIds: input.request.sourceAssetIds,
    storageUrl: previewUrl,
    previewUrl,
    contentType: "video/mp4",
    width: null,
    height: null,
    durationMs: typeof payload?.durationMs === "number" ? payload.durationMs : null,
    offerId: input.request.offerId,
    pageCountOffer: input.request.pageCountOffer,
    bundleOffer: input.request.bundleOffer,
    occasion: input.request.occasion ?? null,
    renderProfile: "marketing-video-api",
    createdAt: new Date().toISOString(),
  } satisfies InternalProductAssetResponseAsset;
}

export async function executeInternalProductRender(input: InternalProductAssetRequest): Promise<InternalProductAssetResponse | null> {
  const integrations = getIntegrationStatus();

  if (!integrations.marketingRendererConfigured) {
    return null;
  }

  const sources = await resolveMarketingSources(input.sourceAssetIds);
  const deliveryMode = input.deliveryMode ?? (input.offerId.startsWith("print-") ? "print" : "pdf");
  const renderSettings = getPipelineRenderSettings(deliveryMode, input.orderStyle === "sample" ? "sample" : "full_book");
  const renderedPages = await Promise.all(
    sources.map((source, index) =>
      renderMarketingPage({
        childFirstName: input.childFirstName,
        deliveryMode,
        pageNumber: index + 1,
        primaryModel: renderSettings.model,
        imageSize: renderSettings.imageSize,
        source: {
          buffer: source.buffer,
          fileName: source.fileName,
          mimeType: source.contentType,
        },
      }),
    ),
  );

  const firstPage = renderedPages[0]!;
  const imageFormats = input.outputFormats.filter((format) => format !== "mp4");
  const preferredImageType = imageFormats[0] === "jpeg" ? "image/jpeg" : imageFormats[0] === "webp" ? "image/webp" : "image/png";
  const assets: InternalProductAssetResponseAsset[] = [];

  if (input.orderStyle === "sample") {
    assets.push(
      await persistBinaryAsset({
        request: input,
        assetType: "sample_page",
        buffer: firstPage.finalPng,
        contentType: preferredImageType,
        width: 2400,
        height: 3105,
        suffix: "sample-page",
        provider: "gemini",
      }),
    );
  }

  if (input.orderStyle === "proof_pair") {
    for (const aspectRatio of input.aspectRatios) {
      const composite = await composeProofPair({
        aspectRatio,
        sourceBuffer: sources[0]!.buffer,
        generatedBuffer: firstPage.finalPng,
      });
      const canvas = CANVAS_BY_RATIO[aspectRatio] ?? CANVAS_BY_RATIO["4:5"];

      assets.push(
        await persistBinaryAsset({
          request: input,
          assetType: "before_after_pair",
          buffer: composite,
          contentType: "image/png",
          width: canvas.width,
          height: canvas.height,
          suffix: `proof-pair-${aspectRatio.replace(":", "x")}`,
          provider: "internal-renderer",
        }),
      );
    }
  }

  if (input.orderStyle === "book_preview") {
    const contactSheet = await composeBookPreview({
      request: input,
      pageBuffers: renderedPages.map((page) => page.previewJpeg),
    });
    assets.push(
      await persistBinaryAsset({
        request: input,
        assetType: "book_preview_image",
        buffer: contactSheet,
        contentType: "image/png",
        width: CANVAS_BY_RATIO["4:5"].width,
        height: CANVAS_BY_RATIO["4:5"].height,
        suffix: "book-preview",
        provider: "internal-renderer",
      }),
    );

    if (input.outputFormats.includes("mp4")) {
      const videoAsset = await executeVideoProvider({
        request: input,
        imageUrls: assets.map((asset) => asset.previewUrl),
      });

      if (videoAsset) {
        assets.push(videoAsset);
      }
    }
  }

  if (input.orderStyle === "print_mockup") {
    const coverVariant = await composeCoverVariant({
      request: input,
      pageBuffer: firstPage.previewJpeg,
    });
    const mockup = await composePrintMockup({
      request: input,
      coverBuffer: coverVariant,
    });

    assets.push(
      await persistBinaryAsset({
        request: input,
        assetType: "print_mockup",
        buffer: mockup,
        contentType: "image/png",
        width: CANVAS_BY_RATIO["4:5"].width,
        height: CANVAS_BY_RATIO["4:5"].height,
        suffix: "print-mockup",
        provider: "internal-renderer",
      }),
    );
  }

  if (input.orderStyle === "cover_variant") {
    const coverVariant = await composeCoverVariant({
      request: input,
      pageBuffer: firstPage.previewJpeg,
    });
    assets.push(
      await persistBinaryAsset({
        request: input,
        assetType: "cover_variant",
        buffer: coverVariant,
        contentType: "image/png",
        width: CANVAS_BY_RATIO["4:5"].width,
        height: CANVAS_BY_RATIO["4:5"].height,
        suffix: "cover-variant",
        provider: "internal-renderer",
      }),
    );
  }

  if (input.orderStyle === "proof_video") {
    const proofPair = await composeProofPair({
      aspectRatio: input.aspectRatios[0] ?? "9:16",
      sourceBuffer: sources[0]!.buffer,
      generatedBuffer: firstPage.finalPng,
    });
    const proofAsset = await persistBinaryAsset({
      request: input,
      assetType: "before_after_pair",
      buffer: proofPair,
      contentType: "image/png",
      width: CANVAS_BY_RATIO[input.aspectRatios[0] ?? "9:16"]?.width ?? CANVAS_BY_RATIO["9:16"].width,
      height: CANVAS_BY_RATIO[input.aspectRatios[0] ?? "9:16"]?.height ?? CANVAS_BY_RATIO["9:16"].height,
      suffix: "proof-video-frame",
      provider: "internal-renderer",
    });

    assets.push(proofAsset);

    if (input.outputFormats.includes("mp4")) {
      const videoAsset = await executeVideoProvider({
        request: input,
        imageUrls: [proofAsset.previewUrl],
      });

      if (videoAsset) {
        assets.push(videoAsset);
      }
    }
  }

  return {
    requestId: input.requestId,
    status: assets.some((asset) => asset.contentType === "video/mp4") || assets.length > 0 ? "completed" : "queued",
    assets,
    provider: "internal-renderer",
    createdAt: new Date().toISOString(),
    error: null,
  };
}

export async function renderVoiceWithElevenLabs(input: MarketingVoiceRenderRequest) {
  const env = getElevenLabsEnv();
  const response = await fetch(`${env.apiBaseUrl}/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": env.apiKey,
      Accept: input.outputFormat === "wav" ? "audio/wav" : "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.scriptText,
      model_id: env.modelId,
      voice_settings: {
        speed: input.speed,
        style: input.emotionStyle ? 0.6 : 0.3,
        similarity_boost: 0.65,
        stability: 0.5,
      },
      output_format: input.outputFormat === "wav" ? "pcm_44100" : "mp3_44100_128",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`ElevenLabs request failed with status ${response.status}: ${errorText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const audioAssetId = createMarketingRequestId("audio");
  const contentType = input.outputFormat === "wav" ? "audio/wav" : "audio/mpeg";
  const objectPath = `marketing/audio/${audioAssetId}.${inferExtension(contentType)}`;

  await uploadObject({
    bucket: "exports",
    objectPath,
    body: buffer,
    contentType,
    cacheControl: "private, max-age=3600",
  });

  const signed = await createSignedDownloadUrl({
    bucket: "exports",
    objectPath,
    expiresInMinutes: 24 * 60,
  });

  return {
    accepted: true,
    audioAssetId,
    audioUrl: signed.url,
    durationMs: null,
    provider: "elevenlabs",
    createdAt: new Date().toISOString(),
    transcript: input.scriptText,
    storageUrl: `gcs://exports/${objectPath}`,
  };
}

export async function createArcadsBatch(input: MarketingArcadsBatchCreateRequest) {
  const env = getArcadsEnv();
  const response = await fetch(env.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Arcads request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    accepted: true,
    batchId:
      (typeof payload.batchId === "string" && payload.batchId) ||
      (typeof payload.id === "string" && payload.id) ||
      (typeof payload.jobId === "string" && payload.jobId) ||
      createMarketingRequestId("arcads"),
    provider: "arcads",
    queuedVariants: input.variants.length,
    createdAt: new Date().toISOString(),
    status: typeof payload.status === "string" ? payload.status : "submitted",
    providerPayload: payload,
  };
}

export async function createGammaGeneration(input: MarketingGammaGenerateRequest) {
  const env = getGammaEnv();
  const response = await fetch(`${env.apiBaseUrl}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.apiKey,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      ...input.payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gamma request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    accepted: true,
    provider: "gamma",
    generationId:
      (typeof payload.id === "string" && payload.id) ||
      (typeof payload.generationId === "string" && payload.generationId) ||
      createMarketingRequestId("gamma"),
    status: typeof payload.status === "string" ? payload.status : "submitted",
    viewUrl: typeof payload.viewUrl === "string" ? payload.viewUrl : typeof payload.url === "string" ? payload.url : null,
    providerPayload: payload,
    createdAt: new Date().toISOString(),
  };
}
