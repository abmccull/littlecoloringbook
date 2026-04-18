-- Phase 2d: ensure the new video creative kinds are members of the
-- creative_brief_kind enum. Phase 2a seeded the enum with the four
-- placeholder values; re-adding is idempotent via ADD VALUE IF NOT EXISTS.

ALTER TYPE "creative_brief_kind" ADD VALUE IF NOT EXISTS 'static_image';
ALTER TYPE "creative_brief_kind" ADD VALUE IF NOT EXISTS 'carousel_image';
ALTER TYPE "creative_brief_kind" ADD VALUE IF NOT EXISTS 'stop_motion_reveal';
ALTER TYPE "creative_brief_kind" ADD VALUE IF NOT EXISTS 'ugc_narrated';
ALTER TYPE "creative_brief_kind" ADD VALUE IF NOT EXISTS 'slideshow_narration_video';
