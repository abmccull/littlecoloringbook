import { z } from "zod";

// ---------------------------------------------------------------------------
// Voice metadata
// ---------------------------------------------------------------------------

export const VoiceLabelsSchema = z.object({
  accent: z.string().optional(),
  gender: z.string().optional(),
  age: z.string().optional(),
  use_case: z.string().optional(),
  description: z.string().optional(),
});
export type VoiceLabels = z.infer<typeof VoiceLabelsSchema>;

export const VoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string(),
  labels: VoiceLabelsSchema.optional(),
});
export type Voice = z.infer<typeof VoiceSchema>;

export const VoiceListResponseSchema = z.object({
  voices: z.array(VoiceSchema),
});
export type VoiceListResponse = z.infer<typeof VoiceListResponseSchema>;

// ---------------------------------------------------------------------------
// TTS request
// ---------------------------------------------------------------------------

export const VoiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1),
  similarity_boost: z.number().min(0).max(1),
  style: z.number().min(0).max(1).optional(),
  use_speaker_boost: z.boolean().optional(),
});
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

/**
 * ElevenLabs output format identifiers.
 * mp3_44100_128 is the API default and the most widely compatible.
 */
export const OutputFormatSchema = z.enum([
  "mp3_44100_128",
  "mp3_44100_64",
  "mp3_22050_32",
  "pcm_16000",
  "pcm_22050",
  "pcm_44100",
  "ulaw_8000",
]);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

export const VoiceoverRequestSchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1),
  modelId: z.string().optional(),
  voiceSettings: VoiceSettingsSchema.optional(),
  outputFormat: OutputFormatSchema.optional().default("mp3_44100_128"),
});
export type VoiceoverRequest = z.infer<typeof VoiceoverRequestSchema>;
export type VoiceoverRequestInput = z.input<typeof VoiceoverRequestSchema>;

// ---------------------------------------------------------------------------
// Voice family taxonomy
// Used by resolveVoiceForFamily() to pick the best voice for a use-case.
// ---------------------------------------------------------------------------

export const VoiceFamilySchema = z.enum([
  "warm_conversational_female",
  "upbeat_female",
  "calm_premium_female",
  "friendly_gift_guide",
]);
export type VoiceFamily = z.infer<typeof VoiceFamilySchema>;

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class VoiceoverError extends Error {
  public readonly code: string;
  public readonly statusCode: number | undefined;

  constructor(message: string, code = "VOICEOVER_ERROR", statusCode?: number) {
    super(message);
    this.name = "VoiceoverError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
