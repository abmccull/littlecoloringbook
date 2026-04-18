/**
 * ugc_narrated kind producer.
 *
 * Pipeline:
 *  1. Render a hero image via Gemini (source photo required)
 *  2. Synthesize voiceover from hook + body
 *  3. Probe audio duration → build still-image video
 *  4. Overlay audio on video
 *  5. Burn caption subtitles
 *  6. Upload to GCS
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { buildColoringPrompt } from "@littlecolorbook/pipeline";
import type { DeliveryMode } from "@littlecolorbook/shared";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import type { InsertCreativeBriefInput } from "@littlecolorbook/db/repositories";
import type { ElevenLabsClient } from "@littlecolorbook/voiceover";
import type { CreativeBriefParsed, ProduceResult, ComplianceReport } from "../types.js";
import { renderColoringPageImage } from "../gemini.js";
import { tagsToTagsJson } from "../tagging.js";
import {
  imageToMp4,
  overlayAudio,
  burnCaptions,
  probeDuration,
  splitToSubtitles,
} from "./ffmpeg.js";
import type { ProduceCreativeOptions } from "../orchestrator.js";

const GCS_BUCKET = "exports" as const;

function generateId(): string {
  return crypto.randomUUID();
}

export type UgcNarratedOptions = {
  voiceoverClient: ElevenLabsClient;
};

export async function produceUgcNarrated(
  brief: CreativeBriefParsed,
  report: ComplianceReport,
  opts: ProduceCreativeOptions,
  { voiceoverClient }: UgcNarratedOptions,
): Promise<ProduceResult> {
  if (!opts.sourceImagePath) {
    throw new Error(
      "opts.sourceImagePath is required for ugc_narrated. Provide a source photo path.",
    );
  }

  // a. Read source image
  const sourceBuffer = readFileSync(opts.sourceImagePath);
  const sourceMimeType = opts.sourceImagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  // b. Render hero via Gemini
  const prompt = buildColoringPrompt({
    attempt: 0,
    deliveryMode: "sample" as DeliveryMode,
    jobKind: "sample",
    pageNumber: 1,
    sourceLabel: brief.visualPrompt,
  });

  const rendered = await renderColoringPageImage({
    sourceImageBuffer: sourceBuffer,
    mimeType: sourceMimeType,
    prompt,
    aspectRatio: brief.targetAspectRatio,
  });

  const heroBuffer = rendered.buffer;

  // c. Resolve voice
  let voiceId: string;
  if (brief.voiceFamily) {
    const voices = await voiceoverClient.listVoices();
    const matched = voiceoverClient.resolveVoiceForFamily(brief.voiceFamily, voices);
    voiceId = matched?.voice_id ?? voices[0]?.voice_id ?? "21m00Tcm4TlvDq8ikWAM";
  } else {
    const voices = await voiceoverClient.listVoices();
    voiceId = voices[0]?.voice_id ?? "21m00Tcm4TlvDq8ikWAM";
  }

  // d. Build narration text
  const narrationText =
    brief.narrationScript ?? [brief.hook, brief.body].filter(Boolean).join("\n");

  // e. Synthesize voiceover
  const { audioBuffer } = await voiceoverClient.synthesize({ voiceId, text: narrationText });

  // f. Probe audio duration
  const audioDuration = await probeDuration(audioBuffer);
  const videoDuration = audioDuration + 0.5;

  // g. Build still-image video
  const silentVideo = await imageToMp4({
    imageBuffer: heroBuffer,
    durationSeconds: videoDuration,
    aspectRatio: brief.targetAspectRatio,
  });

  // h. Overlay audio
  const videoWithAudio = await overlayAudio({ videoBuffer: silentVideo, audioBuffer });

  // i. Burn captions
  const captions = splitToSubtitles(narrationText, audioDuration);
  const finalVideo = await burnCaptions({ videoBuffer: videoWithAudio, captions });

  // j. IDs + GCS upload
  const briefId = generateId();
  const videoAssetId = generateId();
  const audioAssetId = generateId();

  const videoGcsObject = `creative-library/video/${videoAssetId}.mp4`;
  const audioGcsObject = `creative-library/audio/${audioAssetId}.mp3`;

  await Promise.all([
    uploadObject({
      bucket: GCS_BUCKET,
      objectPath: videoGcsObject,
      body: finalVideo,
      contentType: "video/mp4",
      cacheControl: "public, max-age=31536000",
    }),
    uploadObject({
      bucket: GCS_BUCKET,
      objectPath: audioGcsObject,
      body: audioBuffer,
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000",
    }),
  ]);

  // k. Tags + DB rows
  const tagsJson = tagsToTagsJson({
    concept: brief.concept,
    format: brief.format,
    persona: brief.persona ?? undefined,
    occasion: brief.occasion ?? undefined,
    offer: brief.offerCode ?? undefined,
    ...brief.tags,
  });

  const reportJson: Record<string, unknown> = {
    status: report.status,
    warnings: report.warnings,
    errors: report.errors,
    policyVersion: report.policyVersion,
  };

  // NOTE: cast needed because "ugc_narrated" is in the DB enum but brief.kind type is wider.
  await insertCreativeBrief({
    id: briefId,
    kind: brief.kind as InsertCreativeBriefInput["kind"],
    concept: brief.concept,
    format: brief.format,
    hook: brief.hook,
    body: brief.body,
    cta: brief.cta,
    persona: brief.persona,
    occasion: brief.occasion,
    offerCode: brief.offerCode,
    visualPrompt: brief.visualPrompt,
    voiceFamily: brief.voiceFamily,
    createdBy: opts.createdBy,
  });

  await insertCreativeAsset({
    id: videoAssetId,
    briefId,
    source: "agent_generated",
    kind: "video",
    gcsBucket: GCS_BUCKET,
    gcsObject: videoGcsObject,
    mimeType: "video/mp4",
    tagsJson,
    complianceStatus: report.status,
    complianceCheckedAt: new Date(),
    complianceReportJson: reportJson,
    consentSource: "internal",
    createdBy: opts.createdBy,
  });

  await insertCreativeAsset({
    id: audioAssetId,
    briefId,
    source: "agent_generated",
    kind: "voiceover",
    gcsBucket: GCS_BUCKET,
    gcsObject: audioGcsObject,
    mimeType: "audio/mpeg",
    tagsJson,
    complianceStatus: report.status,
    complianceCheckedAt: new Date(),
    complianceReportJson: null,
    consentSource: "internal",
    createdBy: opts.createdBy,
  });

  return {
    briefId,
    videoAssetId,
    audioAssetId,
    durationSeconds: audioDuration,
    complianceStatus: report.status,
  };
}
