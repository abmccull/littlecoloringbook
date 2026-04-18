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
  // Phase 7a mocks
  getCopyElementById: vi.fn().mockResolvedValue(null),
  touchCopyElementUsage: vi.fn().mockResolvedValue(undefined),
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

import { produceCreative } from "../orchestrator";
import { ComplianceRejectedError, MissingClientError } from "../types";
import { renderColoringPageImage } from "../gemini";
import { uploadObject } from "@littlecolorbook/shared/storage";
import {
  insertCreativeBrief,
  insertCreativeAsset,
  getCopyElementById,
  touchCopyElementUsage,
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
    expect(result.crops?.aspect_1x1).toBeTruthy();
    expect(result.crops?.aspect_4x5).toBeTruthy();
    expect(result.crops?.aspect_9x16).toBeTruthy();
    expect(result.crops?.aspect_16x9).toBeTruthy();
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

  it("throws MissingClientError for ugc_narrated when voiceoverClient is absent", async () => {
    const videoBrief = { ...validBrief, kind: "ugc_narrated" as const };

    await expect(
      produceCreative(videoBrief, { sourceImagePath: "/fake/source.png" }),
    ).rejects.toThrow(MissingClientError);

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

  // ─── Phase 7a: element_ids hydration ────────────────────────────────────────

  it("hydrates hook text from DB when element_ids.hook_id is present", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });
    // Mock getCopyElementById to return an element with specific text
    (getCopyElementById as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValueOnce({
      id: "el_hook_001",
      kind: "hook",
      text: "HYDRATED HOOK TEXT",
    });

    const briefWithElementIds = {
      ...validBrief,
      hook: "FALLBACK INLINE HOOK",
      elementIds: { hook_id: "el_hook_001" },
    };

    await produceCreative(briefWithElementIds, {
      sourceImagePath: "/fake/source.png",
      skipCompliance: true,
    });

    // insertCreativeBrief should have been called with hydrated hook text
    expect(insertCreativeBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        hook: "HYDRATED HOOK TEXT",
        elementIds: { hook_id: "el_hook_001" },
      }),
    );
  });

  it("falls back to inline text when getCopyElementById returns null", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });
    // Return null — element not found
    (getCopyElementById as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValueOnce(null);

    const briefWithElementIds = {
      ...validBrief,
      hook: "INLINE HOOK FALLBACK",
      elementIds: { hook_id: "el_missing" },
    };

    await produceCreative(briefWithElementIds, {
      sourceImagePath: "/fake/source.png",
      skipCompliance: true,
    });

    // Should use the inline fallback hook since DB returned null
    expect(insertCreativeBrief).toHaveBeenCalledWith(
      expect.objectContaining({ hook: "INLINE HOOK FALLBACK" }),
    );
  });

  it("calls touchCopyElementUsage for each referenced element after success", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });
    (getCopyElementById as unknown as MockInstance<() => Promise<unknown>>)
      .mockResolvedValueOnce({ id: "el_hook_001", kind: "hook", text: "Hydrated hook" })
      .mockResolvedValueOnce({ id: "el_cta_001", kind: "cta", text: "Shop Now" });

    const briefWithMultipleIds = {
      ...validBrief,
      elementIds: { hook_id: "el_hook_001", cta_id: "el_cta_001" },
    };

    await produceCreative(briefWithMultipleIds, {
      sourceImagePath: "/fake/source.png",
      skipCompliance: true,
    });

    // touchCopyElementUsage should have been invoked for each referenced ID
    // (called asynchronously as fire-and-forget, so we wait a tick)
    await new Promise((r) => setTimeout(r, 0));
    expect(touchCopyElementUsage).toHaveBeenCalledWith(expect.objectContaining({ id: "el_hook_001" }));
    expect(touchCopyElementUsage).toHaveBeenCalledWith(expect.objectContaining({ id: "el_cta_001" }));
  });

  it("does not call touchCopyElementUsage when elementIds is absent", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    await produceCreative(validBrief, {
      sourceImagePath: "/fake/source.png",
      skipCompliance: true,
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(touchCopyElementUsage).not.toHaveBeenCalled();
  });
});
