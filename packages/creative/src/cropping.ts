import sharp from "sharp";
import type { CropKey } from "./types";

// Target pixel dimensions per aspect ratio
const CROP_SPECS: Record<
  CropKey,
  { width: number; height: number; strategy: "cover" | "contain_white" }
> = {
  aspect_1x1: { width: 1080, height: 1080, strategy: "cover" },
  // Coloring pages are ~3:4 ≈ 0.75. 4:5 is 0.80, so a small center crop works.
  aspect_4x5: { width: 1080, height: 1350, strategy: "cover" },
  // 9:16 is taller than 3:4, so we fit and pad sides with white.
  aspect_9x16: { width: 1080, height: 1920, strategy: "contain_white" },
  // 16:9 is much wider than 3:4, so we fit and pad top/bottom with white.
  aspect_16x9: { width: 1920, height: 1080, strategy: "contain_white" },
};

async function coverCrop(
  source: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(source)
    .resize({ width, height, fit: "cover", position: "centre" })
    .png({ compressionLevel: 7, quality: 85 })
    .toBuffer();
}

async function containWhite(
  source: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  // Fit artwork inside the canvas, then extend with white padding to fill.
  const fitted = await sharp(source)
    .resize({ width, height, fit: "inside" })
    .png()
    .toBuffer();

  const meta = await sharp(fitted).metadata();
  const fittedWidth = meta.width ?? width;
  const fittedHeight = meta.height ?? height;

  // Reserve 2px (1px each side) for the neutral border so after adding it
  // the total stays exactly width×height.
  const BORDER = 1;
  const innerWidth = width - BORDER * 2;
  const innerHeight = height - BORDER * 2;

  const padLeft = Math.floor((innerWidth - fittedWidth) / 2);
  const padTop = Math.floor((innerHeight - fittedHeight) / 2);
  const padRight = innerWidth - fittedWidth - padLeft;
  const padBottom = innerHeight - fittedHeight - padTop;

  // Two-step extend: white fill, then 1px neutral border.
  // Because we already budgeted 2px, the final dimensions are exactly width×height.
  const padded = await sharp(fitted)
    .extend({
      top: Math.max(0, padTop),
      bottom: Math.max(0, padBottom),
      left: Math.max(0, padLeft),
      right: Math.max(0, padRight),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  // Add 1px neutral border (reduces Meta's "black edge" warning risk).
  // Then force-resize to guarantee exact output dimensions regardless of
  // any rounding drift in the padding calculation above.
  return sharp(padded)
    .extend({
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
      background: { r: 240, g: 240, b: 240, alpha: 1 },
    })
    .png()
    .toBuffer()
    .then((buf) =>
      sharp(buf)
        .resize({ width, height, fit: "cover", position: "centre" })
        .png({ compressionLevel: 7, quality: 85 })
        .toBuffer(),
    );
}

export async function deriveAspectCrops(
  heroBuffer: Buffer,
): Promise<Record<CropKey, Buffer>> {
  const entries = await Promise.all(
    (
      Object.entries(CROP_SPECS) as [CropKey, (typeof CROP_SPECS)[CropKey]][]
    ).map(async ([key, spec]) => {
      const buf =
        spec.strategy === "cover"
          ? await coverCrop(heroBuffer, spec.width, spec.height)
          : await containWhite(heroBuffer, spec.width, spec.height);
      return [key, buf] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<CropKey, Buffer>;
}
