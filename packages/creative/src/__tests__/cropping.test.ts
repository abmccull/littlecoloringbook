import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { deriveAspectCrops } from "../cropping";
import type { CropKey } from "../types";

// Synthetic 3:4 portrait fixture (400×533 px, pure white)
async function makeFixturePng(width = 400, height = 533): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
}

describe("deriveAspectCrops", () => {
  let fixtureBuffer: Buffer;
  let crops: Record<CropKey, Buffer>;

  beforeAll(async () => {
    fixtureBuffer = await makeFixturePng();
    crops = await deriveAspectCrops(fixtureBuffer);
  });

  // ─── aspect_1x1 ─────────────────────────────────────────────────────────────

  it("produces aspect_1x1 at 1080×1080", async () => {
    const meta = await sharp(crops.aspect_1x1).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1080);
  });

  it("aspect_1x1 is a valid PNG buffer", async () => {
    const meta = await sharp(crops.aspect_1x1).metadata();
    expect(meta.format).toBe("png");
  });

  // ─── aspect_4x5 ─────────────────────────────────────────────────────────────

  it("produces aspect_4x5 at 1080×1350", async () => {
    const meta = await sharp(crops.aspect_4x5).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
  });

  it("aspect_4x5 is a valid PNG buffer", async () => {
    const meta = await sharp(crops.aspect_4x5).metadata();
    expect(meta.format).toBe("png");
  });

  // ─── aspect_9x16 ────────────────────────────────────────────────────────────

  it("produces aspect_9x16 at 1080×1920", async () => {
    const meta = await sharp(crops.aspect_9x16).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
  });

  it("aspect_9x16 is a valid PNG buffer", async () => {
    const meta = await sharp(crops.aspect_9x16).metadata();
    expect(meta.format).toBe("png");
  });

  // ─── aspect_16x9 ────────────────────────────────────────────────────────────

  it("produces aspect_16x9 at 1920×1080", async () => {
    const meta = await sharp(crops.aspect_16x9).metadata();
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
  });

  it("aspect_16x9 is a valid PNG buffer", async () => {
    const meta = await sharp(crops.aspect_16x9).metadata();
    expect(meta.format).toBe("png");
  });

  // ─── All four present ────────────────────────────────────────────────────────

  it("returns all four crop keys", () => {
    expect(Object.keys(crops).sort()).toEqual(
      ["aspect_16x9", "aspect_1x1", "aspect_4x5", "aspect_9x16"].sort(),
    );
  });

  // ─── Landscape source ────────────────────────────────────────────────────────

  it("handles a landscape source image without throwing", async () => {
    const landscape = await makeFixturePng(1920, 1080);
    const landscapeCrops = await deriveAspectCrops(landscape);
    const meta1x1 = await sharp(landscapeCrops.aspect_1x1).metadata();
    expect(meta1x1.width).toBe(1080);
    expect(meta1x1.height).toBe(1080);
  });

  // ─── Very small source ───────────────────────────────────────────────────────

  it("handles a tiny source image (100×133)", async () => {
    const tiny = await makeFixturePng(100, 133);
    const tinyCrops = await deriveAspectCrops(tiny);
    const meta = await sharp(tinyCrops.aspect_4x5).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
  });
});
