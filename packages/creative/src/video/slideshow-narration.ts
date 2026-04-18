/**
 * slideshow_narration_video kind producer.
 *
 * Pipeline:
 *  1. Generate a Gamma deck (PNG per slide)
 *  2. Download slide PNGs
 *  3. Split narration script into N beats (one per slide)
 *  4. For each slide: synthesize audio → probe duration → render still-image clip → overlay audio
 *  5. Concatenate clips with crossfade
 *  6. Upload final MP4 to GCS
 */

import crypto from "node:crypto";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { insertCreativeBrief, insertCreativeAsset } from "@littlecolorbook/db/repositories";
import type { InsertCreativeBriefInput } from "@littlecolorbook/db/repositories";
import type { GammaClient } from "@littlecolorbook/gamma";
import type { ElevenLabsClient } from "@littlecolorbook/voiceover";
import type { CreativeBriefParsed, ProduceResult, ComplianceReport } from "../types";
import { tagsToTagsJson } from "../tagging";
import {
  imageToMp4,
  crossfadeSequence,
  overlayAudio,
  probeDuration,
  splitToSubtitles,
} from "./ffmpeg";
import type { ProduceCreativeOptions } from "../orchestrator";

const GCS_BUCKET = "exports" as const;

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Split a script into N beats aligned with slide count.
 * Tries sentence splits first; if we get fewer chunks than slides, pads with empty strings.
 */
function splitIntoBeat(script: string, numSlides: number): string[] {
  const raw = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (raw.length >= numSlides) {
    // Merge excess sentences into last bucket
    const beats: string[] = raw.slice(0, numSlides - 1);
    beats.push(raw.slice(numSlides - 1).join(" "));
    return beats;
  }

  // Pad remaining beats with a soft pause marker (empty string → ElevenLabs handles gracefully)
  const padded = [...raw];
  while (padded.length < numSlides) {
    padded.push(raw[raw.length - 1] ?? "");
  }
  return padded;
}

export type SlideshowNarrationOptions = {
  gammaClient: GammaClient;
  voiceoverClient: ElevenLabsClient;
};

export async function produceSlideshowNarrationVideo(
  brief: CreativeBriefParsed,
  report: ComplianceReport,
  opts: ProduceCreativeOptions,
  { gammaClient, voiceoverClient }: SlideshowNarrationOptions,
): Promise<ProduceResult> {
  const numCards = brief.cardCount;

  // a. Build prompt for Gamma
  const composedPrompt = [
    `Title: ${brief.hook}`,
    `Topic: ${brief.concept}`,
    brief.body,
    `Call to action: ${brief.cta}`,
    brief.occasion ? `Occasion: ${brief.occasion}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // b. Generate Gamma deck and download PNG slides
  const gammaResponse = await gammaClient.generateAndWait({
    inputText: composedPrompt,
    format: "presentation",
    numCards,
    exportAs: "png",
  });

  const slideBuffers = await gammaClient.downloadSlidePngs(gammaResponse);
  const actualSlides = slideBuffers.length;

  // c. Resolve voice
  let voiceId: string;
  if (brief.voiceFamily) {
    const voices = await voiceoverClient.listVoices();
    const matched = voiceoverClient.resolveVoiceForFamily(brief.voiceFamily, voices);
    voiceId = matched?.voice_id ?? voices[0]?.voice_id ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel fallback
  } else {
    // Default to first available voice; a real deployment would always pass voiceFamily
    const voices = await voiceoverClient.listVoices();
    voiceId = voices[0]?.voice_id ?? "21m00Tcm4TlvDq8ikWAM";
  }

  // d. Build narration beats
  const script =
    brief.narrationScript ??
    [brief.hook, brief.body, brief.cta].filter(Boolean).join(". ");

  const beats = splitIntoBeat(script, actualSlides);

  // e. For each slide: synth audio → probe duration → build video clip → overlay
  const perSlideClips: Buffer[] = [];
  for (let i = 0; i < actualSlides; i++) {
    const beat = beats[i] ?? beats[beats.length - 1] ?? brief.hook;

    const { audioBuffer } = await voiceoverClient.synthesize({ voiceId, text: beat });

    const audioDuration = await probeDuration(audioBuffer);
    const videoDuration = audioDuration + 0.5; // 0.5 s buffer after audio

    const videoClip = await imageToMp4({
      imageBuffer: slideBuffers[i],
      durationSeconds: videoDuration,
      aspectRatio: brief.targetAspectRatio,
    });

    const clipWithAudio = await overlayAudio({ videoBuffer: videoClip, audioBuffer });
    perSlideClips.push(clipWithAudio);
  }

  // f. Concatenate with crossfade
  const finalVideo = await crossfadeSequence({
    clips: perSlideClips,
    transitionSeconds: 0.5,
  });

  // g. IDs + GCS upload
  const briefId = generateId();
  const videoAssetId = generateId();
  const gcsObject = `creative-library/video/${videoAssetId}.mp4`;

  await uploadObject({
    bucket: GCS_BUCKET,
    objectPath: gcsObject,
    body: finalVideo,
    contentType: "video/mp4",
    cacheControl: "public, max-age=31536000",
  });

  // h. Tags + DB rows
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

  // NOTE: cast needed because "slideshow_narration_video" is not yet in the DB enum.
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
    gcsObject,
    mimeType: "video/mp4",
    tagsJson,
    complianceStatus: report.status,
    complianceCheckedAt: new Date(),
    complianceReportJson: reportJson,
    consentSource: "internal",
    createdBy: opts.createdBy,
  });

  return {
    briefId,
    videoAssetId,
    complianceStatus: report.status,
  };
}
