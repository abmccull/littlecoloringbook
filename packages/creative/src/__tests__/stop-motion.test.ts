/**
 * stop_motion_reveal kind tests.
 * Mocks: Gemini, ffmpeg wrapper, GCS upload, DB repos.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Mock the ffmpeg helpers to return fake buffers — no actual encoding needed
vi.mock("../video/ffmpeg.js", () => ({
  imageToMp4: vi.fn().mockResolvedValue(Buffer.from("MP4_CLIP")),
  crossfadeSequence: vi.fn().mockResolvedValue(Buffer.from("FINAL_MP4")),
  overlayAudio: vi.fn().mockResolvedValue(Buffer.from("AUDIO_VIDEO")),
  probeDuration: vi.fn().mockResolvedValue(5.0),
  burnCaptions: vi.fn().mockResolvedValue(Buffer.from("CAPTIONED_VIDEO")),
  splitToSubtitles: vi.fn().mockReturnValue([
    { text: "Hello.", startSec: 0, endSec: 2.5 },
    { text: "World.", startSec: 2.5, endSec: 5 },
  ]),
  getFfmpegPath: vi.fn().mockReturnValue("/usr/bin/ffmpeg"),
}));

import { produceCreative } from "../orchestrator";
import { renderColoringPageImage } from "../gemini";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import { imageToMp4, crossfadeSequence } from "../video/ffmpeg";
import type { MockInstance } from "vitest";

const validStopMotionBrief = {
  kind: "stop_motion_reveal" as const,
  concept: "family-portrait",
  format: "reveal",
  hook: "Watch your photo become a coloring page",
  body: "A magical transformation your kids will love.",
  cta: "Try free now",
  visualPrompt: "Family portrait in the park",
};

describe("produceCreative — stop_motion_reveal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (renderColoringPageImage as unknown as MockInstance).mockResolvedValue({
      buffer: Buffer.from("COLORING_PAGE"),
      mimeType: "image/png",
    });

    (imageToMp4 as unknown as MockInstance).mockResolvedValue(Buffer.from("MP4_CLIP"));
    (crossfadeSequence as unknown as MockInstance).mockResolvedValue(Buffer.from("FINAL_MP4"));
  });

  it("returns a result with videoAssetId and briefId", async () => {
    const result = await produceCreative(validStopMotionBrief, {
      sourceImagePath: "/fake/photo.jpg",
      skipCompliance: true,
    });

    expect(result.briefId).toBeTruthy();
    expect(result.videoAssetId).toBeTruthy();
    expect(result.complianceStatus).toBe("passed");
  });

  it("calls imageToMp4 three times (one per timeline segment)", async () => {
    await produceCreative(validStopMotionBrief, {
      sourceImagePath: "/fake/photo.jpg",
      skipCompliance: true,
    });

    expect(imageToMp4).toHaveBeenCalledTimes(3);
  });

  it("calls crossfadeSequence with 3 clips", async () => {
    await produceCreative(validStopMotionBrief, {
      sourceImagePath: "/fake/photo.jpg",
      skipCompliance: true,
    });

    const calls = (crossfadeSequence as unknown as MockInstance).mock.calls;
    expect(calls).toHaveLength(1);
    const args = calls[0][0] as { clips: Buffer[] };
    expect(args.clips).toHaveLength(3);
  });

  it("uploads the final video to GCS", async () => {
    await produceCreative(validStopMotionBrief, {
      sourceImagePath: "/fake/photo.jpg",
      skipCompliance: true,
    });

    const uploadCalls = (uploadObject as unknown as MockInstance).mock.calls;
    const videoUpload = uploadCalls.find(
      (call) => (call[0] as { contentType: string }).contentType === "video/mp4",
    );
    expect(videoUpload).toBeTruthy();
  });

  it("inserts brief and video asset into the DB", async () => {
    await produceCreative(validStopMotionBrief, {
      sourceImagePath: "/fake/photo.jpg",
      skipCompliance: true,
    });

    expect(insertCreativeBrief).toHaveBeenCalledTimes(1);
    expect(insertCreativeAsset).toHaveBeenCalledTimes(1);

    const assetArgs = (insertCreativeAsset as unknown as MockInstance).mock.calls[0][0] as {
      kind: string;
    };
    expect(assetArgs.kind).toBe("video");
  });

  it("throws when sourceImagePath is missing", async () => {
    await expect(
      produceCreative(validStopMotionBrief, { skipCompliance: true }),
    ).rejects.toThrow("sourceImagePath is required");
  });
});
