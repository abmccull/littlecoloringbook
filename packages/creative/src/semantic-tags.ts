/**
 * semantic-tags.ts
 *
 * Phase 7b — Zod schema for the rich visual semantic tags produced by the
 * auto-tagger vision LLM. This schema drives:
 *   - Structured output validation (auto-tagger.ts)
 *   - creative_assets.semantic_tags JSONB shape (DB layer)
 *   - Tag-performance attribution queries (repositories.ts)
 *
 * Versioning: bump tagger_version whenever the tag taxonomy changes so
 * existing rows can be selectively re-tagged.
 */

import { z } from "zod";

export const TAGGER_VERSION = "2026-04-a-vision";

export const SemanticTagsSchema = z.object({
  scene_type: z
    .enum(["indoor", "outdoor", "studio", "vehicle", "mixed", "unknown"])
    .optional(),
  setting: z
    .enum([
      "home",
      "park",
      "beach",
      "vacation",
      "birthday",
      "school",
      "restaurant",
      "other",
      "unknown",
    ])
    .optional(),
  subject_types: z
    .array(
      z.enum([
        "family",
        "couple",
        "adult_solo",
        "kid_solo",
        "kids_group",
        "toddler",
        "baby",
        "pet_dog",
        "pet_cat",
        "pet_other",
        "object_only",
      ]),
    )
    .default([]),
  subject_count: z.number().int().min(0).max(10).optional(),
  props: z
    .array(
      z.enum([
        "toy",
        "book",
        "food",
        "pet",
        "gift",
        "sports_equipment",
        "musical_instrument",
        "vehicle",
        "screen",
        "nature_object",
        "none",
      ]),
    )
    .default([]),
  emotion: z
    .enum([
      "joyful",
      "calm",
      "playful",
      "serious",
      "surprised",
      "affectionate",
      "neutral",
      "unknown",
    ])
    .optional(),
  pose: z
    .enum(["portrait", "action", "candid", "posed", "group_shot", "unknown"])
    .optional(),
  style: z
    .object({
      line_weight: z.enum(["thin", "medium", "thick", "mixed"]).optional(),
      detail_level: z.enum(["minimal", "simple", "medium", "detailed"]).optional(),
      background: z.enum(["white", "sparse", "suggested", "detailed"]).optional(),
      subject_framing: z.enum(["close_up", "medium", "wide", "full_scene"]).optional(),
    })
    .optional(),
  complexity_score: z.number().int().min(1).max(5).optional(),
  child_recognition_risk: z.enum(["low", "medium", "high"]).optional(),
  tagger_model: z.string().optional(),
  tagger_version: z.string().default(TAGGER_VERSION),
});

export type SemanticTags = z.infer<typeof SemanticTagsSchema>;
