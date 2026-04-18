import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import sharp from "sharp";

// ─── Mock external dependencies before importing the orchestrator ─────────────

vi.mock("@littlecolorbook/pipeline", () => ({
  buildColoringPrompt: vi.fn(() => "mocked-coloring-prompt"),
}));

vi.mock("@littlecolorbook/shared/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@littlecolorbook/db/repositories", () => ({
  insertCreativeBrief: vi.fn().mockResolvedValue({ id: "brief-id-mock" }),
  insertCreativeAsset: vi.fn().mockResolvedValue({ id: "asset-id-mock" }),
  updateCreativeAssetCompliance: vi.fn().mockResolvedValue(null),
}));

vi.mock("../gemini.js", () => ({
  renderColoringPageImage: vi.fn(),
}));

// readFileSync is used to read the source image — mock it to return a tiny PNG
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    readFileSync: vi.fn(),
  };
});

import { produceCreative } from "../orchestrator.js";
import { ComplianceRejectedError, NotImplementedError } from "../types.js";
import { renderColoringPageImage } from "../gemini.js";
import { uploadObject } from "@littlecolorbook/shared/storage";
import {
  insertCreativeBrief,
  insertCreativeAsset,
} from "@littlecolorbook/db/repositories";
import { readFileSync } from "node:fs";

async function makeTinyPngBuffer(width = 400, height = 533): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("produceCreative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBrief = {
    kind: "static_image" as const,
    concept: "family-portrait",
    format: "before_after",
    hook: "Turn your family photos into coloring pages",
    body: "A personalized coloring book they will treasure forever.",
    cta: "Try a free sample",
    visualPrompt: "Family photo in the park",
    persona: "warm_millennial_mom",
    occasion: "evergreen",
    offerCode: "free_sample",
  };

  it("returns a ProduceResult with 5 asset IDs on the happy path", async () => {
    const fakeBuffer = await makeTinyPngBuffer();

    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    const result = await produceCreative(validBrief, {
      sourceImagePath: "/fake/source.png",
    });

    expect(result.briefId).toBeTruthy();
    expect(result.heroAssetId).toBeTruthy();
    expect(result.crops.aspect_1x1).toBeTruthy();
    expect(result.crops.aspect_4x5).toBeTruthy();
    expect(result.crops.aspect_9x16).toBeTruthy();
    expect(result.crops.aspect_16x9).toBeTruthy();
    expect(result.complianceStatus).toBe("passed");
  });

  it("calls uploadObject 5 times (1 hero + 4 crops)", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    await produceCreative(validBrief, { sourceImagePath: "/fake/source.jpg" });

    expect(uploadObject).toHaveBeenCalledTimes(5);
  });

  it("calls insertCreativeBrief once and insertCreativeAsset 5 times", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    await produceCreative(validBrief, { sourceImagePath: "/fake/source.png" });

    expect(insertCreativeBrief).toHaveBeenCalledTimes(1);
    expect(insertCreativeAsset).toHaveBeenCalledTimes(5);
  });

  it("throws ComplianceRejectedError without calling Gemini when brief is rejected", async () => {
    const rejectedBrief = {
      ...validBrief,
      body: "We know your child best. #1 best coloring book 48 hours only!!!",
    };

    await expect(
      produceCreative(rejectedBrief, { sourceImagePath: "/fake/source.png" }),
    ).rejects.toThrow(ComplianceRejectedError);

    expect(renderColoringPageImage).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
    expect(insertCreativeBrief).not.toHaveBeenCalled();
  });

  it("throws NotImplementedError for non-static_image kinds", async () => {
    const videoBrief = { ...validBrief, kind: "stop_motion_reveal" as const };

    await expect(
      produceCreative(videoBrief, { sourceImagePath: "/fake/source.png" }),
    ).rejects.toThrow(NotImplementedError);

    expect(renderColoringPageImage).not.toHaveBeenCalled();
  });

  it("throws when sourceImagePath is missing", async () => {
    await expect(
      produceCreative(validBrief, {}),
    ).rejects.toThrow("sourceImagePath is required");
  });

  it("throws zod validation error for invalid brief", async () => {
    const invalidBrief = { ...validBrief, kind: "not_a_valid_kind" as "static_image" };
    await expect(produceCreative(invalidBrief, {})).rejects.toThrow();
  });

  it("proceeds with 'warned' status when brief has compliance warnings", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    const warnedBrief = { ...validBrief, hook: "ORDER NOW!!!" };
    const result = await produceCreative(warnedBrief, {
      sourceImagePath: "/fake/source.png",
    });

    expect(result.complianceStatus).toBe("warned");
    expect(renderColoringPageImage).toHaveBeenCalledOnce();
  });
});
