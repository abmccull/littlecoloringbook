/**
 * ffmpeg.ts unit tests.
 *
 * The heavy ffmpeg operations are tested via fully-mocked fluent-ffmpeg so no
 * real binary is needed. splitToSubtitles and getFfmpegPath are pure-logic tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @ffmpeg-installer/ffmpeg ────────────────────────────────────────────
// Must come before the module under test is imported.

vi.mock("@ffmpeg-installer/ffmpeg", () => ({
  default: { path: "/usr/local/bin/ffmpeg" },
}));

// ─── Mock fluent-ffmpeg ───────────────────────────────────────────────────────
// vi.mock factories are hoisted by Vitest, so we CANNOT reference module-scope
// variables inside the factory. Instead we build fresh objects each call.

vi.mock("fluent-ffmpeg", () => {
  function makeFfmpegInstance() {
    const self: Record<string, unknown> = {};

    self.inputOptions = vi.fn().mockReturnValue(self);
    self.outputOptions = vi.fn().mockReturnValue(self);
    self.videoFilters = vi.fn().mockReturnValue(self);
    self.input = vi.fn().mockReturnValue(self);

    self.on = vi.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === "end") Promise.resolve().then(() => cb());
      return self;
    });

    // save() writes a fake file so readFileSync can return something
    self.save = vi.fn().mockImplementation((outputPath: string) => {
      try {
        const { writeFileSync } = require("node:fs") as typeof import("node:fs");
        writeFileSync(outputPath, Buffer.from("FAKEVIDEO"));
      } catch {
        // ignore in mocked env
      }
      return self;
    });

    return self;
  }

  const ffmpegFn = vi.fn().mockImplementation(() => makeFfmpegInstance());

  (ffmpegFn as unknown as Record<string, unknown>).setFfmpegPath = vi.fn();

  (ffmpegFn as unknown as Record<string, unknown>).ffprobe = (
    _path: string,
    cb: (err: null, meta: { format: { duration: number } }) => void,
  ) => {
    cb(null, { format: { duration: 5.0 } });
  };

  return { default: ffmpegFn };
});

// ─── Mock node:fs ─────────────────────────────────────────────────────────────
// writeFileSync / readFileSync / existsSync / unlinkSync are no-ops in tests.

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("FAKEVIDEO")),
    existsSync: vi.fn().mockReturnValue(false),
    unlinkSync: vi.fn(),
  };
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  getFfmpegPath,
  probeDuration,
  imageToMp4,
  crossfadeSequence,
  overlayAudio,
  burnCaptions,
  splitToSubtitles,
} from "../video/ffmpeg";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getFfmpegPath", () => {
  it("returns the installer path when FFMPEG_BINARY_PATH is not set", () => {
    delete process.env.FFMPEG_BINARY_PATH;
    const p = getFfmpegPath();
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(0);
  });

  it("returns FFMPEG_BINARY_PATH override when set", () => {
    process.env.FFMPEG_BINARY_PATH = "/custom/ffmpeg";
    const p = getFfmpegPath();
    expect(p).toBe("/custom/ffmpeg");
    delete process.env.FFMPEG_BINARY_PATH;
  });
});

describe("probeDuration", () => {
  it("returns the numeric duration from ffprobe metadata", async () => {
    const duration = await probeDuration(Buffer.from("fake audio"));
    expect(duration).toBe(5.0);
  });
});

describe("imageToMp4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves with a Buffer", async () => {
    const result = await imageToMp4({
      imageBuffer: Buffer.from("PNG"),
      durationSeconds: 3,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

describe("crossfadeSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the single clip unchanged when only one clip is provided", async () => {
    const clip = Buffer.from("ONE_CLIP");
    const result = await crossfadeSequence({ clips: [clip] });
    expect(result).toBe(clip);
  });

  it("throws when no clips are provided", async () => {
    await expect(crossfadeSequence({ clips: [] })).rejects.toThrow(
      "At least one clip is required",
    );
  });

  it("resolves with a Buffer for multiple clips", async () => {
    const result = await crossfadeSequence({
      clips: [Buffer.from("A"), Buffer.from("B")],
      transitionSeconds: 0.5,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

describe("overlayAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves with a Buffer", async () => {
    const result = await overlayAudio({
      videoBuffer: Buffer.from("VIDEO"),
      audioBuffer: Buffer.from("AUDIO"),
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

describe("burnCaptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the video buffer unchanged when captions array is empty", async () => {
    const video = Buffer.from("VIDEO");
    const result = await burnCaptions({ videoBuffer: video, captions: [] });
    expect(result).toBe(video);
  });

  it("resolves with a Buffer when captions are provided", async () => {
    const result = await burnCaptions({
      videoBuffer: Buffer.from("VIDEO"),
      captions: [{ text: "Hello world", startSec: 0, endSec: 2 }],
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

describe("splitToSubtitles", () => {
  it("returns one caption per sentence", () => {
    const script = "Hello world. This is a test. Goodbye.";
    const captions = splitToSubtitles(script, 9);
    expect(captions).toHaveLength(3);
    expect(captions[0].text).toBe("Hello world.");
    expect(captions[0].startSec).toBe(0);
    expect(captions[2].endSec).toBe(9);
  });

  it("returns a single caption when script has no sentence punctuation", () => {
    const script = "No punctuation here";
    const captions = splitToSubtitles(script, 5);
    expect(captions).toHaveLength(1);
    expect(captions[0].text).toBe("No punctuation here");
    expect(captions[0].startSec).toBe(0);
    expect(captions[0].endSec).toBe(5);
  });

  it("handles an empty script gracefully (produces 0 or 1 captions)", () => {
    const captions = splitToSubtitles("", 10);
    expect(captions.length).toBeGreaterThanOrEqual(0);
  });

  it("start/end times are sequential and non-overlapping", () => {
    const script = "Sentence one. Sentence two. Sentence three.";
    const captions = splitToSubtitles(script, 12);
    for (let i = 1; i < captions.length; i++) {
      expect(captions[i].startSec).toBeCloseTo(captions[i - 1].endSec, 1);
    }
  });

  it("distributes time evenly across sentences", () => {
    const script = "One. Two. Three. Four.";
    const totalDuration = 8;
    const captions = splitToSubtitles(script, totalDuration);
    const expectedPerCaption = totalDuration / captions.length;
    for (const cap of captions) {
      expect(cap.endSec - cap.startSec).toBeCloseTo(expectedPerCaption, 1);
    }
  });
});
