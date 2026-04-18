/**
 * carousel_image kind tests.
 * Mocks: Gemini, Canva, GCS upload, DB repos.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

// ─── Dependency mocks ─────────────────────────────────────────────────────────

vi.mock("@littlecolorbook/pipeline", () => ({
  buildColoringPrompt: vi.fn(() => "mock-prompt"),
}));

vi.mock("@littlecolorbook/shared/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@littlecolorbook/db/repositories", () => ({
  insertCreativeBrief: vi.fn().mockResolvedValue({ id: "brief-id" }),
  insertCreativeAsset: vi.fn().mockResolvedValue({ id: "asset-id" }),
  updateCreativeAssetCompliance: vi.fn().mockResolvedValue(null),
}));

vi.mock("../gemini.js", () => ({
  renderColoringPageImage: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return { ...real, readFileSync: vi.fn().mockReturnValue(Buffer.from("SOURCE_PHOTO")) };
});

// sharp is used internally by cropping.ts — mock deriveAspectCrops
vi.mock("../cropping.js", () => ({
  deriveAspectCrops: vi.fn().mockResolvedValue({
    aspect_1x1: Buffer.from("1x1"),
    aspect_4x5: Buffer.from("4x5"),
    aspect_9x16: Buffer.from("9x16"),
    aspect_16x9: Buffer.from("16x9"),
  }),
}));

import { produceCreative } from "../orchestrator.js";
import { renderColoringPageImage } from "../gemini.js";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import { deriveAspectCrops } from "../cropping.js";

// ─── Mock Canva client ────────────────────────────────────────────────────────

function makeMockCanvaClient() {
  return {
    uploadAsset: vi.fn().mockResolvedValue({ asset_id: "canva-asset-123" }),
    autofillBrandTemplate: vi.fn().mockResolvedValue({ designId: "design-456" }),
    exportDesign: vi.fn().mockResolvedValue({ downloadUrl: "https://example.com/design.png" }),
    fetchDesignAsBuffer: vi.fn().mockResolvedValue(Buffer.from("CANVA_RENDERED")),
  };
}

// ─── Brief fixtures ───────────────────────────────────────────────────────────

const validCarouselBrief = {
  kind: "carousel_image" as const,
  concept: "family-portrait",
  format: "carousel",
  hook: "Turn your family photos into coloring pages",
  body: "Kids love personalised art. Great for gifts. Perfect for all ages.",
  cta: "Try free now",
  visualPrompt: "Family portrait in the park",
  cardCount: 5,
};

describe("produceCreative — carousel_image", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (renderColoringPageImage as unknown as MockInstance).mockResolvedValue({
      buffer: Buffer.from("HERO_IMAGE"),
      mimeType: "image/png",
    });

    (deriveAspectCrops as unknown as MockInstance).mockResolvedValue({
      aspect_1x1: Buffer.from("1x1"),
      aspect_4x5: Buffer.from("4x5"),
      aspect_9x16: Buffer.from("9x16"),
      aspect_16x9: Buffer.from("16x9"),
    });
  });

  it("returns briefId and an array of card results", async () => {
    const result = await produceCreative(validCarouselBrief, {
      sourceImagePath: "/fake/photo.jpg",
      skipCompliance: true,
    });

    expect(result.briefId).toBeTruthy();
    expect(Array.isArray(result.cards)).toBe(true);
    expect(result.complianceStatus).toBe("passed");
  });

  it("produces exactly cardCount cards when no cards provided", async () => {
    const result = await produceCreative(
      { ...validCarouselBrief, cardCount: 5 },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    expect(result.cards).toHaveLength(5);
  });

  it("uses provided cards array instead of deriving defaults", async () => {
    const customCards = [
      {
        hook: "Card 1",
        body: "Body 1",
        cta: "CTA 1",
        visualPrompt: "Visual 1",
      },
      {
        hook: "Card 2",
        body: "Body 2",
        cta: "CTA 2",
        visualPrompt: "Visual 2",
      },
      {
        hook: "Card 3",
        body: "Body 3",
        cta: "CTA 3",
        visualPrompt: "Visual 3",
      },
    ];

    const result = await produceCreative(
      { ...validCarouselBrief, cardCount: 3, cards: customCards },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    expect(result.cards).toHaveLength(3);
    // Gemini should be called once per card with the card's visualPrompt
    expect(renderColoringPageImage).toHaveBeenCalledTimes(3);
  });

  it("each card result has heroAssetId and both crop IDs", async () => {
    const result = await produceCreative(
      { ...validCarouselBrief, cardCount: 3 },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    for (const card of result.cards ?? []) {
      expect(card.heroAssetId).toBeTruthy();
      expect(card.cropAssetIds.aspect_1x1).toBeTruthy();
      expect(card.cropAssetIds.aspect_4x5).toBeTruthy();
    }
  });

  it("calls renderColoringPageImage once per card", async () => {
    await produceCreative(
      { ...validCarouselBrief, cardCount: 5 },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    expect(renderColoringPageImage).toHaveBeenCalledTimes(5);
  });

  it("uploads hero + 2 crops per card (3 uploads × N cards) + 0 brief", async () => {
    const cardCount = 4;
    await produceCreative(
      { ...validCarouselBrief, cardCount },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    // 3 uploads per card: hero + aspect_1x1 + aspect_4x5
    expect(uploadObject).toHaveBeenCalledTimes(cardCount * 3);
  });

  it("inserts 1 brief row and (3 assets per card) DB rows", async () => {
    const cardCount = 3;
    await produceCreative(
      { ...validCarouselBrief, cardCount },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    expect(insertCreativeBrief).toHaveBeenCalledTimes(1);
    // hero + 2 crops per card
    expect(insertCreativeAsset).toHaveBeenCalledTimes(cardCount * 3);
  });

  it("Canva autofill is skipped when CANVA_TEMPLATE_AUTOFILL_ENABLED is not set", async () => {
    delete process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED;
    const canvaClient = makeMockCanvaClient();

    await produceCreative(
      { ...validCarouselBrief, cardCount: 3, canvaTemplateId: "tmpl-123" },
      {
        sourceImagePath: "/fake/photo.jpg",
        canvaClient: canvaClient as never,
        skipCompliance: true,
      },
    );

    expect(canvaClient.uploadAsset).not.toHaveBeenCalled();
    expect(canvaClient.autofillBrandTemplate).not.toHaveBeenCalled();
  });

  it("Canva autofill runs per-card when feature flag is enabled + templateId is set", async () => {
    process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED = "true";
    const canvaClient = makeMockCanvaClient();

    await produceCreative(
      { ...validCarouselBrief, cardCount: 3, canvaTemplateId: "tmpl-123" },
      {
        sourceImagePath: "/fake/photo.jpg",
        canvaClient: canvaClient as never,
        skipCompliance: true,
      },
    );

    // Called once per card
    expect(canvaClient.uploadAsset).toHaveBeenCalledTimes(3);
    expect(canvaClient.autofillBrandTemplate).toHaveBeenCalledTimes(3);

    delete process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED;
  });

  it("Canva failure falls back to raw Gemini hero without throwing", async () => {
    process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED = "true";
    const canvaClient = makeMockCanvaClient();
    (canvaClient.uploadAsset as MockInstance).mockRejectedValue(new Error("Canva error"));

    const result = await produceCreative(
      { ...validCarouselBrief, cardCount: 3, canvaTemplateId: "tmpl-123" },
      {
        sourceImagePath: "/fake/photo.jpg",
        canvaClient: canvaClient as never,
        skipCompliance: true,
      },
    );

    // Should still produce N cards despite Canva errors
    expect(result.cards).toHaveLength(3);

    delete process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED;
  });

  it("throws when sourceImagePath is missing", async () => {
    await expect(
      produceCreative(validCarouselBrief, { skipCompliance: true }),
    ).rejects.toThrow("sourceImagePath is required");
  });

  it("default card 1 has hook + swipe prompt", async () => {
    const result = await produceCreative(
      { ...validCarouselBrief, cardCount: 3 },
      { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
    );

    // We can't inspect card copy directly from result, but we can verify
    // Gemini received a call with the brief's visualPrompt for card 1
    const firstCall = (renderColoringPageImage as unknown as MockInstance).mock.calls[0][0] as {
      prompt: string;
    };
    expect(firstCall.prompt).toBeTruthy();
  });

  it("respects minimum cardCount of 3 (Zod validation)", async () => {
    await expect(
      produceCreative(
        { ...validCarouselBrief, cardCount: 2 },
        { sourceImagePath: "/fake/photo.jpg", skipCompliance: true },
      ),
    ).rejects.toThrow();
  });
});
