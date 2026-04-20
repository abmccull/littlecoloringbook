import sharp from "sharp";
import { BRAND_COLORS } from "./brand";
import { buildSvg, type TextBlock } from "./text-svg";

export const COMPOSITOR_VARIANTS = [
  "hero_v1",
  "hero_v2",
  "hero_v3",
  "before_after",
] as const;

export type CompositorVariant = (typeof COMPOSITOR_VARIANTS)[number];

export type CompositorInput = {
  /** Main image buffer (Gemini coloring page, or pre-composited before/after). */
  heroImage: Buffer;
  /** Hook headline — 1 line, bold, display typeface. */
  hook: string;
  /** Body supporting copy — 1–2 lines, body typeface. */
  body: string;
  /** Call-to-action label for the pill button. */
  cta: string;
  /** Layout selection. Defaults to hero_v1 (image left / text right). */
  variant?: CompositorVariant;
  /** Output dimensions — defaults to 1080×1080. */
  width?: number;
  height?: number;
};

/**
 * Composite a source photo and a coloring page side-by-side with a
 * small divider. Both images are cropped to cover the half-canvas
 * without distortion. Use the output as the heroImage input to
 * renderStaticHeroAd with variant "before_after" for a full ad.
 */
export async function compositeBeforeAfter({
  sourcePhoto,
  coloringPage,
  width = 1080,
  height = 1080,
  divider = true,
}: {
  sourcePhoto: Buffer;
  coloringPage: Buffer;
  width?: number;
  height?: number;
  divider?: boolean;
}): Promise<Buffer> {
  const halfWidth = Math.floor(width / 2);

  const [leftHalf, rightHalf] = await Promise.all([
    sharp(sourcePhoto).resize(halfWidth, height, { fit: "cover", position: "attention" }).png().toBuffer(),
    sharp(coloringPage).resize(halfWidth, height, { fit: "cover", position: "center" }).png().toBuffer(),
  ]);

  const composites: sharp.OverlayOptions[] = [
    { input: leftHalf, top: 0, left: 0 },
    { input: rightHalf, top: 0, left: halfWidth },
  ];

  if (divider) {
    const dividerWidth = Math.max(4, Math.round(width / 180));
    const dividerSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${dividerWidth}" height="${height}"><rect width="${dividerWidth}" height="${height}" fill="${BRAND_COLORS.cream}"/></svg>`,
    );
    composites.push({
      input: dividerSvg,
      top: 0,
      left: Math.floor(halfWidth - dividerWidth / 2),
    });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 248, b: 242, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Render a static hero ad composite: heroImage + hook/body/cta
 * overlays. Three variants control the layout — the brief picks one,
 * or the orchestrator defaults to hero_v1.
 */
export async function renderStaticHeroAd(input: CompositorInput): Promise<Buffer> {
  const variant = input.variant ?? "hero_v1";
  const width = input.width ?? 1080;
  const height = input.height ?? 1080;

  switch (variant) {
    case "hero_v1":
      return renderHeroV1({ ...input, width, height });
    case "hero_v2":
      return renderHeroV2({ ...input, width, height });
    case "hero_v3":
      return renderHeroV3({ ...input, width, height });
    case "before_after":
      return renderBeforeAfter({ ...input, width, height });
  }
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

type LayoutInput = CompositorInput & { width: number; height: number };

/** V1 — Image left (55%), text stack right (45%) on cream surface. */
async function renderHeroV1({ heroImage, hook, body, cta, width, height }: LayoutInput): Promise<Buffer> {
  const imageWidth = Math.floor(width * 0.55);
  const textX = imageWidth + Math.floor(width * 0.04);
  const textWidth = width - textX - Math.floor(width * 0.04);

  const heroResized = await sharp(heroImage)
    .resize(imageWidth, height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const hookBlock: TextBlock = { text: hook, font: "display", sizePx: Math.floor(width * 0.06), weight: 700, color: "ink" };
  const bodyBlock: TextBlock = { text: body, font: "body", sizePx: Math.floor(width * 0.026), weight: 400, color: "cocoa", lineHeight: 1.35 };
  const ctaBlock: TextBlock = { text: cta, font: "body", sizePx: Math.floor(width * 0.028), weight: 700, color: "paper", align: "middle" };

  const hookY = Math.floor(height * 0.18);
  const bodyY = hookY + hookBlock.sizePx * 2.4;
  const ctaY = Math.floor(height * 0.75);
  const ctaPillWidth = Math.min(textWidth, Math.floor(width * 0.3));
  const ctaPillHeight = Math.floor(width * 0.07);
  const ctaPillX = textX;
  const ctaTextY = ctaY + Math.floor((ctaPillHeight - ctaBlock.sizePx) / 2);

  const svg = buildSvg({
    width,
    height,
    rects: [
      { x: imageWidth, y: 0, width: width - imageWidth, height, color: "cream" },
      {
        x: ctaPillX,
        y: ctaY,
        width: ctaPillWidth,
        height: ctaPillHeight,
        color: "coral",
        rx: Math.floor(ctaPillHeight / 2),
      },
    ],
    texts: [
      { block: hookBlock, x: textX, y: hookY, widthPx: textWidth },
      { block: bodyBlock, x: textX, y: bodyY, widthPx: textWidth },
      {
        block: ctaBlock,
        x: ctaPillX,
        y: ctaTextY,
        widthPx: ctaPillWidth,
      },
    ],
  });

  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 248, b: 242, alpha: 1 } },
  })
    .composite([
      { input: heroResized, top: 0, left: 0 },
      { input: svg, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

/** V2 — Image full-bleed, bottom 30% is a paper strip with copy. */
async function renderHeroV2({ heroImage, hook, body, cta, width, height }: LayoutInput): Promise<Buffer> {
  const stripHeight = Math.floor(height * 0.32);
  const stripY = height - stripHeight;

  const heroResized = await sharp(heroImage)
    .resize(width, height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const padding = Math.floor(width * 0.05);
  const textWidth = width - padding * 2;

  const hookBlock: TextBlock = { text: hook, font: "display", sizePx: Math.floor(width * 0.055), weight: 700, color: "ink" };
  const bodyBlock: TextBlock = { text: body, font: "body", sizePx: Math.floor(width * 0.022), weight: 400, color: "cocoa", lineHeight: 1.3 };
  const ctaBlock: TextBlock = { text: cta, font: "body", sizePx: Math.floor(width * 0.024), weight: 700, color: "paper", align: "middle" };

  const hookY = stripY + Math.floor(stripHeight * 0.15);
  const bodyY = hookY + hookBlock.sizePx * 1.9;
  const ctaPillHeight = Math.floor(width * 0.065);
  const ctaPillWidth = Math.floor(width * 0.28);
  const ctaPillX = width - padding - ctaPillWidth;
  const ctaPillY = stripY + stripHeight - ctaPillHeight - Math.floor(stripHeight * 0.15);
  const ctaTextY = ctaPillY + Math.floor((ctaPillHeight - ctaBlock.sizePx) / 2);

  const svg = buildSvg({
    width,
    height,
    rects: [
      { x: 0, y: stripY, width, height: stripHeight, color: "paper", opacity: 0.96 },
      { x: ctaPillX, y: ctaPillY, width: ctaPillWidth, height: ctaPillHeight, color: "coral", rx: Math.floor(ctaPillHeight / 2) },
    ],
    texts: [
      { block: hookBlock, x: padding, y: hookY, widthPx: textWidth },
      { block: bodyBlock, x: padding, y: bodyY, widthPx: textWidth - ctaPillWidth - padding },
      { block: ctaBlock, x: ctaPillX, y: ctaTextY, widthPx: ctaPillWidth },
    ],
  });

  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 248, b: 242, alpha: 1 } },
  })
    .composite([
      { input: heroResized, top: 0, left: 0 },
      { input: svg, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

/** V3 — Image top 60%, text-only bottom 40% on fog surface. */
async function renderHeroV3({ heroImage, hook, body, cta, width, height }: LayoutInput): Promise<Buffer> {
  const imageHeight = Math.floor(height * 0.6);
  const textY = imageHeight;
  const textZoneHeight = height - imageHeight;

  const heroResized = await sharp(heroImage)
    .resize(width, imageHeight, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const padding = Math.floor(width * 0.06);
  const textWidth = width - padding * 2;

  const hookBlock: TextBlock = { text: hook, font: "display", sizePx: Math.floor(width * 0.05), weight: 700, color: "ink", align: "middle" };
  const bodyBlock: TextBlock = { text: body, font: "body", sizePx: Math.floor(width * 0.022), weight: 400, color: "cocoa", align: "middle", lineHeight: 1.3 };
  const ctaBlock: TextBlock = { text: cta, font: "body", sizePx: Math.floor(width * 0.025), weight: 700, color: "paper", align: "middle" };

  const hookY = textY + Math.floor(textZoneHeight * 0.12);
  const bodyY = hookY + hookBlock.sizePx * 1.9;
  const ctaPillHeight = Math.floor(width * 0.07);
  const ctaPillWidth = Math.floor(width * 0.34);
  const ctaPillX = Math.floor((width - ctaPillWidth) / 2);
  const ctaPillY = height - ctaPillHeight - Math.floor(textZoneHeight * 0.15);
  const ctaTextY = ctaPillY + Math.floor((ctaPillHeight - ctaBlock.sizePx) / 2);

  const svg = buildSvg({
    width,
    height,
    rects: [
      { x: 0, y: textY, width, height: textZoneHeight, color: "fog" },
      { x: ctaPillX, y: ctaPillY, width: ctaPillWidth, height: ctaPillHeight, color: "coral", rx: Math.floor(ctaPillHeight / 2) },
    ],
    texts: [
      { block: hookBlock, x: padding, y: hookY, widthPx: textWidth },
      { block: bodyBlock, x: padding, y: bodyY, widthPx: textWidth },
      { block: ctaBlock, x: ctaPillX, y: ctaTextY, widthPx: ctaPillWidth },
    ],
  });

  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 248, b: 242, alpha: 1 } },
  })
    .composite([
      { input: heroResized, top: 0, left: 0 },
      { input: svg, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * Before/after layout — assumes heroImage is already a side-by-side
 * composite (use compositeBeforeAfter() first). Overlays top hook band
 * and bottom caption card with CTA.
 */
async function renderBeforeAfter({ heroImage, hook, body, cta, width, height }: LayoutInput): Promise<Buffer> {
  const heroResized = await sharp(heroImage)
    .resize(width, height, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  const bandHeight = Math.floor(height * 0.14);
  const padding = Math.floor(width * 0.04);

  const hookBlock: TextBlock = { text: hook, font: "display", sizePx: Math.floor(bandHeight * 0.4), weight: 700, color: "ink", align: "middle" };

  const cardHeight = Math.floor(height * 0.22);
  const cardY = height - cardHeight;
  const cardWidth = Math.floor(width * 0.62);
  const cardX = padding;

  const bodyBlock: TextBlock = { text: body, font: "body", sizePx: Math.floor(cardHeight * 0.14), weight: 400, color: "cocoa", lineHeight: 1.3 };

  const ctaPillHeight = Math.floor(cardHeight * 0.28);
  const ctaPillWidth = Math.floor(width * 0.3);
  const ctaPillX = width - padding - ctaPillWidth;
  const ctaPillY = cardY + Math.floor((cardHeight - ctaPillHeight) / 2);
  const ctaBlock: TextBlock = { text: cta, font: "body", sizePx: Math.floor(ctaPillHeight * 0.38), weight: 700, color: "paper", align: "middle" };
  const ctaTextY = ctaPillY + Math.floor((ctaPillHeight - ctaBlock.sizePx) / 2);

  const bodyY = cardY + Math.floor(cardHeight * 0.18);

  const svg = buildSvg({
    width,
    height,
    rects: [
      { x: 0, y: 0, width, height: bandHeight, color: "sunshine", opacity: 0.92 },
      { x: cardX, y: cardY, width: cardWidth, height: cardHeight, color: "paper", rx: Math.floor(cardHeight / 12), opacity: 0.96 },
      { x: ctaPillX, y: ctaPillY, width: ctaPillWidth, height: ctaPillHeight, color: "coral", rx: Math.floor(ctaPillHeight / 2) },
    ],
    texts: [
      { block: hookBlock, x: padding, y: Math.floor((bandHeight - hookBlock.sizePx) / 2), widthPx: width - padding * 2 },
      { block: bodyBlock, x: cardX + Math.floor(cardWidth * 0.06), y: bodyY, widthPx: Math.floor(cardWidth * 0.88) },
      { block: ctaBlock, x: ctaPillX, y: ctaTextY, widthPx: ctaPillWidth },
    ],
  });

  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 248, b: 242, alpha: 1 } },
  })
    .composite([
      { input: heroResized, top: 0, left: 0 },
      { input: svg, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}
