/**
 * ugc_narrated kind tests.
 * Mocks: Gemini, ElevenLabs, ffmpeg wrapper, GCS upload, DB repos.
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

vi.mock("../video/ffmpeg.js", () => ({
  imageToMp4: vi.fn().mockResolvedValue(Buffer.from("SILENT_VIDEO")),
  overlayAudio: vi.fn().mockResolvedValue(Buffer.from("AUDIO_VIDEO")),
  burnCaptions: vi.fn().mockResolvedValue(Buffer.from("CAPTIONED_VIDEO")),
  probeDuration: vi.fn().mockResolvedValue(8.5),
  splitToSubtitles: vi.fn().mockReturnValue([
    { text: "Watch your photo.", startSec: 0, endSec: 4.25 },
    { text: "Become a coloring page.", startSec: 4.25, endSec: 8.5 },
  ]),
  crossfadeSequence: vi.fn().mockResolvedValue(Buffer.from("CONCAT")),
  getFfmpegPath: vi.fn().mockReturnValue("/usr/bin/ffmpeg"),
}));

import { produceCreative } from "../orchestrator";
import { renderColoringPageImage } from "../gemini";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import {
  imageToMp4,
  overlayAudio,
  burnCaptions,
  probeDuration,
} from "../video/ffmpeg";
import { MissingClientError } from "../types";

// ─── Mock ElevenLabs client ───────────────────────────────────────────────────

function makeMockVoiceoverClient() {
  return {
    listVoices: vi.fn().mockResolvedValue([
      { voice_id: "test-voice-id", name: "Test Voice", labels: { gender: "female" } },
    ]),
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("MP3_AUDIO"),
      contentType: "audio/mpeg",
    }),
    resolveVoiceForFamily: vi.fn().mockReturnValue({
      voice_id: "test-voice-id",
      name: "Test Voice",
    }),
  };
}

const validBrief = {
  kind: "ugc_narrated" as const,
  concept: "coloring-book",
  format: "ugc_video",
  hook: "Turn your photos into coloring pages",
  body: "Kids love personalised coloring books. Great for gifts.",
  cta: "Try free now",
  visualPrompt: "Family portrait in the park",
  voiceFamily: "warm_conversational_female" as const,
};

describe("produceCreative — ugc_narrated", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (renderColoringPageImage as unknown as MockInstance).mockResolvedValue({
      buffer: Buffer.from("HERO_IMAGE"),
      mimeType: "image/png",
    });

    (imageToMp4 as unknown as MockInstance).mockResolvedValue(Buffer.from("SILENT_VIDEO"));
    (overlayAudio as unknown as MockInstance).mockResolvedValue(Buffer.from("AUDIO_VIDEO"));
    (burnCaptions as unknown as MockInstance).mockResolvedValue(Buffer.from("CAPTIONED_VIDEO"));
    (probeDuration as unknown as MockInstance).mockResolvedValue(8.5);
  });

  it("returns result with videoAssetId, audioAssetId, and briefId", async () => {
    const client = makeMockVoiceoverClient();
    const result = await produceCreative(validBrief, {
      sourceImagePath: "/fake/photo.jpg",
      voiceoverClient: client as never,
      skipCompliance: true,
    });

    expect(result.briefId).toBeTruthy();
    expect(result.videoAssetId).toBeTruthy();
    expect(result.audioAssetId).toBeTruthy();
    expect(result.durationSeconds).toBe(8.5);
  });

  it("calls synthesize with hook + body as narration text", async () => {
    const client = makeMockVoiceoverClient();
    await produceCreative(validBrief, {
      sourceImagePath: "/fake/photo.jpg",
      voiceoverClient: client as never,
      skipCompliance: true,
    });

    expect(client.synthesize).toHaveBeenCalledTimes(1);
    const synthArgs = client.synthesize.mock.calls[0][0] as { text: string };
    expect(synthArgs.text).toContain(validBrief.hook);
  });

  it("uses narrationScript when provided instead of hook+body", async () => {
    const client = makeMockVoiceoverClient();
    const customScript = "Custom narration script.";
    await produceCreative(
      { ...validBrief, narrationScript: customScript },
      {
        sourceImagePath: "/fake/photo.jpg",
        voiceoverClient: client as never,
        skipCompliance: true,
      },
    );

    const synthArgs = client.synthesize.mock.calls[0][0] as { text: string };
    expect(synthArgs.text).toBe(customScript);
  });

  it("calls overlayAudio and burnCaptions in sequence", async () => {
    const client = makeMockVoiceoverClient();
    await produceCreative(validBrief, {
      sourceImagePath: "/fake/photo.jpg",
      voiceoverClient: client as never,
      skipCompliance: true,
    });

    expect(overlayAudio).toHaveBeenCalledTimes(1);
    expect(burnCaptions).toHaveBeenCalledTimes(1);
  });

  it("uploads both video and audio to GCS", async () => {
    const client = makeMockVoiceoverClient();
    await produceCreative(validBrief, {
      sourceImagePath: "/fake/photo.jpg",
      voiceoverClient: client as never,
      skipCompliance: true,
    });

    const calls = (uploadObject as unknown as MockInstance).mock.calls;
    const videoUpload = calls.find((c) => (c[0] as { contentType: string }).contentType === "video/mp4");
    const audioUpload = calls.find((c) => (c[0] as { contentType: string }).contentType === "audio/mpeg");
    expect(videoUpload).toBeTruthy();
    expect(audioUpload).toBeTruthy();
  });

  it("inserts brief + video asset + audio asset into DB", async () => {
    const client = makeMockVoiceoverClient();
    await produceCreative(validBrief, {
      sourceImagePath: "/fake/photo.jpg",
      voiceoverClient: client as never,
      skipCompliance: true,
    });

    expect(insertCreativeBrief).toHaveBeenCalledTimes(1);
    expect(insertCreativeAsset).toHaveBeenCalledTimes(2);

    const kinds = (insertCreativeAsset as unknown as MockInstance).mock.calls.map(
      (c) => (c[0] as { kind: string }).kind,
    );
    expect(kinds).toContain("video");
    expect(kinds).toContain("voiceover");
  });

  it("throws MissingClientError when voiceoverClient is absent", async () => {
    await expect(
      produceCreative(validBrief, {
        sourceImagePath: "/fake/photo.jpg",
        skipCompliance: true,
      }),
    ).rejects.toThrow(MissingClientError);
  });

  it("throws when sourceImagePath is missing", async () => {
    const client = makeMockVoiceoverClient();
    await expect(
      produceCreative(validBrief, {
        voiceoverClient: client as never,
        skipCompliance: true,
      }),
    ).rejects.toThrow("sourceImagePath is required");
  });
});
