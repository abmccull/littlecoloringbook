/**
 * slideshow_narration_video kind tests.
 * Mocks: Gamma, ElevenLabs, ffmpeg wrapper, GCS upload, DB repos.
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

vi.mock("../video/ffmpeg.js", () => ({
  imageToMp4: vi.fn().mockResolvedValue(Buffer.from("SLIDE_VIDEO")),
  overlayAudio: vi.fn().mockResolvedValue(Buffer.from("AUDIO_VIDEO")),
  crossfadeSequence: vi.fn().mockResolvedValue(Buffer.from("FINAL_VIDEO")),
  probeDuration: vi.fn().mockResolvedValue(3.0),
  burnCaptions: vi.fn().mockResolvedValue(Buffer.from("CAPTIONED")),
  splitToSubtitles: vi.fn().mockReturnValue([]),
  getFfmpegPath: vi.fn().mockReturnValue("/usr/bin/ffmpeg"),
}));

import { produceCreative } from "../orchestrator";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import { imageToMp4, overlayAudio, crossfadeSequence } from "../video/ffmpeg";
import { MissingClientError } from "../types";

// ─── Mock clients ──────────────────────────────────────────────────────────────

function makeMockGammaClient(numSlides = 3) {
  const fakeSlides = Array.from({ length: numSlides }, (_, i) =>
    Buffer.from(`SLIDE_${i}`),
  );

  return {
    generateAndWait: vi.fn().mockResolvedValue({
      id: "gen-123",
      status: "completed",
      exports: fakeSlides.map((_, i) => ({
        cardIndex: i + 1,
        url: `https://example.com/slide-${i}.png`,
        contentType: "image/png",
      })),
    }),
    downloadSlidePngs: vi.fn().mockResolvedValue(fakeSlides),
  };
}

function makeMockVoiceoverClient() {
  return {
    listVoices: vi.fn().mockResolvedValue([
      { voice_id: "voice-123", name: "Rachel", labels: { gender: "female" } },
    ]),
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("MP3_AUDIO"),
      contentType: "audio/mpeg",
    }),
    resolveVoiceForFamily: vi.fn().mockReturnValue({
      voice_id: "voice-123",
      name: "Rachel",
    }),
  };
}

const validBrief = {
  kind: "slideshow_narration_video" as const,
  concept: "coloring-book",
  format: "slideshow",
  hook: "Your photos turned into art",
  body: "A personalized coloring experience for the whole family.",
  cta: "Get your free sample",
  visualPrompt: "family portrait",
  cardCount: 3,
  voiceFamily: "calm_premium_female" as const,
};

describe("produceCreative — slideshow_narration_video", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (imageToMp4 as unknown as MockInstance).mockResolvedValue(Buffer.from("SLIDE_VIDEO"));
    (overlayAudio as unknown as MockInstance).mockResolvedValue(Buffer.from("AUDIO_VIDEO"));
    (crossfadeSequence as unknown as MockInstance).mockResolvedValue(Buffer.from("FINAL_VIDEO"));
  });

  it("returns a result with videoAssetId and briefId", async () => {
    const gammaClient = makeMockGammaClient(3);
    const voiceoverClient = makeMockVoiceoverClient();

    const result = await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    expect(result.briefId).toBeTruthy();
    expect(result.videoAssetId).toBeTruthy();
    expect(result.complianceStatus).toBe("passed");
  });

  it("calls generateAndWait with the composed prompt", async () => {
    const gammaClient = makeMockGammaClient(3);
    const voiceoverClient = makeMockVoiceoverClient();

    await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    expect(gammaClient.generateAndWait).toHaveBeenCalledTimes(1);
    const args = gammaClient.generateAndWait.mock.calls[0][0] as {
      numCards: number;
      exportAs: string;
    };
    expect(args.numCards).toBe(3);
    expect(args.exportAs).toBe("png");
  });

  it("synthesizes audio once per slide", async () => {
    const numSlides = 3;
    const gammaClient = makeMockGammaClient(numSlides);
    const voiceoverClient = makeMockVoiceoverClient();

    await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    expect(voiceoverClient.synthesize).toHaveBeenCalledTimes(numSlides);
  });

  it("calls imageToMp4 and overlayAudio once per slide", async () => {
    const numSlides = 3;
    const gammaClient = makeMockGammaClient(numSlides);
    const voiceoverClient = makeMockVoiceoverClient();

    await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    expect(imageToMp4).toHaveBeenCalledTimes(numSlides);
    expect(overlayAudio).toHaveBeenCalledTimes(numSlides);
  });

  it("calls crossfadeSequence once with all slide clips", async () => {
    const numSlides = 3;
    const gammaClient = makeMockGammaClient(numSlides);
    const voiceoverClient = makeMockVoiceoverClient();

    await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    expect(crossfadeSequence).toHaveBeenCalledTimes(1);
    const args = (crossfadeSequence as unknown as MockInstance).mock.calls[0][0] as {
      clips: Buffer[];
    };
    expect(args.clips).toHaveLength(numSlides);
  });

  it("uploads one video file to GCS", async () => {
    const gammaClient = makeMockGammaClient(3);
    const voiceoverClient = makeMockVoiceoverClient();

    await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    const calls = (uploadObject as unknown as MockInstance).mock.calls;
    const videoUploads = calls.filter(
      (c) => (c[0] as { contentType: string }).contentType === "video/mp4",
    );
    expect(videoUploads).toHaveLength(1);
  });

  it("inserts one brief row and one video asset row", async () => {
    const gammaClient = makeMockGammaClient(3);
    const voiceoverClient = makeMockVoiceoverClient();

    await produceCreative(validBrief, {
      gammaClient: gammaClient as never,
      voiceoverClient: voiceoverClient as never,
      skipCompliance: true,
    });

    expect(insertCreativeBrief).toHaveBeenCalledTimes(1);
    expect(insertCreativeAsset).toHaveBeenCalledTimes(1);
  });

  it("throws MissingClientError when gammaClient is absent", async () => {
    const voiceoverClient = makeMockVoiceoverClient();
    await expect(
      produceCreative(validBrief, {
        voiceoverClient: voiceoverClient as never,
        skipCompliance: true,
      }),
    ).rejects.toThrow(MissingClientError);
  });

  it("throws MissingClientError when voiceoverClient is absent", async () => {
    const gammaClient = makeMockGammaClient(3);
    await expect(
      produceCreative(validBrief, {
        gammaClient: gammaClient as never,
        skipCompliance: true,
      }),
    ).rejects.toThrow(MissingClientError);
  });

  it("uses narrationScript when provided instead of hook+body+cta", async () => {
    const gammaClient = makeMockGammaClient(3);
    const voiceoverClient = makeMockVoiceoverClient();
    const customScript = "Slide one. Slide two. Slide three.";

    await produceCreative(
      { ...validBrief, narrationScript: customScript },
      {
        gammaClient: gammaClient as never,
        voiceoverClient: voiceoverClient as never,
        skipCompliance: true,
      },
    );

    // The script should be split into beats for each slide
    expect(voiceoverClient.synthesize).toHaveBeenCalledTimes(3);
  });
});
