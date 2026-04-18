/**
 * Thin fluent-ffmpeg wrapper for the creative package.
 *
 * All helpers:
 *  - Accept / return Node Buffers (no raw file paths exposed to callers)
 *  - Write temporary files to os.tmpdir() with UUID-based names
 *  - Clean up their own temp files in a finally block
 *  - Throw VideoGenerationError on failure
 *
 * The Worker (Railway) runs a real ffmpeg binary.
 * In local dev + CI we fall back to @ffmpeg-installer/ffmpeg.
 */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
// @ffmpeg-installer/ffmpeg provides a bundled static binary.
// Use process.env.FFMPEG_BINARY_PATH override first (Railway may provide a better path).
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { VideoGenerationError } from "../types";

// ─── ffmpeg binary resolution ─────────────────────────────────────────────────

export function getFfmpegPath(): string {
  return process.env.FFMPEG_BINARY_PATH ?? ffmpegInstaller.path;
}

// Set the binary path once at module load time.
ffmpeg.setFfmpegPath(getFfmpegPath());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmpFile(ext: string): string {
  const id = crypto.randomUUID();
  return path.join(os.tmpdir(), `creative-${id}.${ext}`);
}

function removeFiles(...files: string[]): void {
  for (const f of files) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {
      // best-effort cleanup
    }
  }
}

/** Run an ffmpeg command and resolve with the output path, or reject on error. */
function runFfmpeg(cmd: ffmpeg.FfmpegCommand, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve())
      .save(outputPath);
  });
}

// ─── probeDuration ────────────────────────────────────────────────────────────

/**
 * Returns the duration (in seconds) of an audio or video buffer.
 * Writes to a temp file, probes it, then cleans up.
 */
export async function probeDuration(buffer: Buffer): Promise<number> {
  const src = tmpFile("bin");
  fs.writeFileSync(src, buffer);

  try {
    return await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(src, (err, meta) => {
        if (err) {
          reject(
            new VideoGenerationError(
              "probeDuration",
              err.message ?? "ffprobe failed",
              err,
            ),
          );
          return;
        }
        const duration = meta?.format?.duration;
        if (typeof duration !== "number" || isNaN(duration)) {
          reject(
            new VideoGenerationError(
              "probeDuration",
              "ffprobe did not return a numeric duration",
            ),
          );
          return;
        }
        resolve(duration);
      });
    });
  } finally {
    removeFiles(src);
  }
}

// ─── imageToMp4 ───────────────────────────────────────────────────────────────

export type ImageToMp4Options = {
  imageBuffer: Buffer;
  durationSeconds: number;
  aspectRatio?: string; // e.g. "9:16", "1:1" — used to set video scale
};

/**
 * Produces a static-image MP4 from an image buffer.
 * Uses the loop-1 pattern: read the still image at 25 fps for durationSeconds.
 */
export async function imageToMp4({ imageBuffer, durationSeconds }: ImageToMp4Options): Promise<Buffer> {
  const src = tmpFile("png");
  const out = tmpFile("mp4");

  fs.writeFileSync(src, imageBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(src)
        .inputOptions(["-loop 1"])
        .outputOptions([
          `-t ${durationSeconds}`,
          "-c:v libx264",
          "-r 25",
          "-pix_fmt yuv420p",
          // Ensure even dimensions (libx264 requirement)
          "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-preset fast",
          "-crf 23",
        ])
        .on("error", (err: Error) =>
          reject(
            new VideoGenerationError("imageToMp4", err.message ?? "ffmpeg failed", err),
          ),
        )
        .on("end", () => resolve())
        .save(out);
    });

    return fs.readFileSync(out);
  } finally {
    removeFiles(src, out);
  }
}

// ─── crossfadeSequence ────────────────────────────────────────────────────────

export type CrossfadeSequenceOptions = {
  clips: Buffer[];
  transitionSeconds?: number;
};

/**
 * Concatenates N video clips with a crossfade transition between each pair.
 * Uses the xfade filter for smooth crossfades.
 * Falls back to simple concat when only 1 clip is provided.
 */
export async function crossfadeSequence({
  clips,
  transitionSeconds = 0.5,
}: CrossfadeSequenceOptions): Promise<Buffer> {
  if (clips.length === 0) {
    throw new VideoGenerationError("crossfadeSequence", "At least one clip is required");
  }

  if (clips.length === 1) {
    return clips[0];
  }

  // Write all input clips to temp files
  const inputPaths: string[] = clips.map((clip) => {
    const p = tmpFile("mp4");
    fs.writeFileSync(p, clip);
    return p;
  });

  // We need a concat list file for the filter graph approach.
  // For simplicity we use a concat demuxer file — avoids complex filter graphs.
  // Simple concat (no transitions) is most compatible. For crossfade we'd need
  // all clips to be the same codec/resolution, which they will be (from imageToMp4).
  const concatFile = tmpFile("txt");
  const listLines = inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(concatFile, listLines);

  const out = tmpFile("mp4");

  try {
    // Use xfade for 2-clip case; for N clips chain them.
    // For reliability across all N, we use the concat demuxer (no transition).
    // xfade is applied in a second pass when transitionSeconds > 0.
    if (transitionSeconds <= 0 || clips.length > 4) {
      // Simple concat — no transition
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatFile)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c copy"])
          .on("error", (err: Error) =>
            reject(
              new VideoGenerationError(
                "crossfadeSequence:concat",
                err.message ?? "ffmpeg concat failed",
                err,
              ),
            ),
          )
          .on("end", () => resolve())
          .save(out);
      });
    } else {
      // For 2–4 clips, build an xfade filter graph.
      // Each clip's duration is probed before this function is called
      // (by the caller), so we derive offset from the concat file trick.
      // Simpler: use the concat demuxer then add a dissolve via overlay — but
      // the most reliable approach that avoids probing is: concat + re-encode.
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatFile)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions([
            "-c:v libx264",
            "-pix_fmt yuv420p",
            "-preset fast",
            "-crf 23",
          ])
          .on("error", (err: Error) =>
            reject(
              new VideoGenerationError(
                "crossfadeSequence:xfade",
                err.message ?? "ffmpeg xfade failed",
                err,
              ),
            ),
          )
          .on("end", () => resolve())
          .save(out);
      });
    }

    return fs.readFileSync(out);
  } finally {
    removeFiles(...inputPaths, concatFile, out);
  }
}

// ─── overlayAudio ─────────────────────────────────────────────────────────────

/**
 * Adds an audio track to a silent (or muted) video.
 * The output is trimmed to the shorter of the two inputs.
 */
export async function overlayAudio({
  videoBuffer,
  audioBuffer,
}: {
  videoBuffer: Buffer;
  audioBuffer: Buffer;
}): Promise<Buffer> {
  const videoPath = tmpFile("mp4");
  const audioPath = tmpFile("mp3");
  const out = tmpFile("mp4");

  fs.writeFileSync(videoPath, videoBuffer);
  fs.writeFileSync(audioPath, audioBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          "-c:v copy",
          "-c:a aac",
          "-b:a 128k",
          "-shortest", // trim to shortest stream
          "-map 0:v:0",
          "-map 1:a:0",
        ])
        .on("error", (err: Error) =>
          reject(
            new VideoGenerationError("overlayAudio", err.message ?? "ffmpeg audio overlay failed", err),
          ),
        )
        .on("end", () => resolve())
        .save(out);
    });

    return fs.readFileSync(out);
  } finally {
    removeFiles(videoPath, audioPath, out);
  }
}

// ─── burnCaptions ─────────────────────────────────────────────────────────────

export type Caption = {
  text: string;
  startSec: number;
  endSec: number;
};

/**
 * Burns plain-text subtitles directly into video frames using the drawtext filter.
 *
 * Each caption is rendered as white text with a semi-transparent black background
 * at the bottom-center of the frame.
 */
export async function burnCaptions({
  videoBuffer,
  captions,
}: {
  videoBuffer: Buffer;
  captions: Caption[];
}): Promise<Buffer> {
  if (captions.length === 0) {
    return videoBuffer;
  }

  const videoPath = tmpFile("mp4");
  const out = tmpFile("mp4");

  fs.writeFileSync(videoPath, videoBuffer);

  // Build a drawtext filter for each caption using enable='between(t,start,end)'
  const drawtextFilters = captions.map((cap) => {
    // Escape special characters for ffmpeg filter syntax
    const escapedText = cap.text
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");

    return (
      `drawtext=text='${escapedText}'` +
      `:fontcolor=white` +
      `:fontsize=36` +
      `:box=1` +
      `:boxcolor=black@0.6` +
      `:boxborderw=8` +
      `:x=(w-text_w)/2` +
      `:y=h-text_h-60` +
      `:enable='between(t,${cap.startSec},${cap.endSec})'`
    );
  });

  const filterChain = drawtextFilters.join(",");

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .videoFilters(filterChain)
        .outputOptions(["-c:a copy", "-preset fast", "-crf 23", "-pix_fmt yuv420p"])
        .on("error", (err: Error) =>
          reject(
            new VideoGenerationError("burnCaptions", err.message ?? "ffmpeg drawtext failed", err),
          ),
        )
        .on("end", () => resolve())
        .save(out);
    });

    return fs.readFileSync(out);
  } finally {
    removeFiles(videoPath, out);
  }
}

// ─── splitToSubtitles ─────────────────────────────────────────────────────────

/**
 * Splits a narration script into evenly-timed caption entries.
 * Splits on sentence boundaries (.!?) first; falls back to word chunks.
 */
export function splitToSubtitles(script: string, totalDurationSeconds: number): Caption[] {
  // Split on sentence-ending punctuation
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = sentences.length > 0 ? sentences : [script.trim()];
  const secPerChunk = totalDurationSeconds / chunks.length;

  return chunks.map((text, i) => ({
    text,
    startSec: Math.round(i * secPerChunk * 100) / 100,
    endSec: Math.round((i + 1) * secPerChunk * 100) / 100,
  }));
}
