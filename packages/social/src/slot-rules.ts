/**
 * slot-rules.ts — Phase 3b Organic Backfill
 *
 * Pure functions (no I/O) for:
 *   - Enumerating the full slot grid over a date window
 *   - Finding which slots are already filled by existing posts
 *   - Scoring creative assets against a slot for picker ranking
 *
 * All functions are deterministic and side-effect-free so they are easily
 * unit-testable and callable from both the cron route and future admin UIs.
 */

import type { OrganicPostPlatform, OrganicPostFormat, CreativeAssetTagsJson } from "@littlecolorbook/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlotPlatformEntry = {
  platform: OrganicPostPlatform;
  format: OrganicPostFormat;
  /** Local-time HH:mm strings, e.g. "08:00" */
  timesOfDay: string[];
  targetPerDay: number;
};

export type SlotConfig = {
  platforms: SlotPlatformEntry[];
};

/** A single resolved slot in the calendar. */
export type Slot = {
  /** ISO-8601 UTC timestamp for this slot. */
  scheduledAt: Date;
  platform: OrganicPostPlatform;
  format: OrganicPostFormat;
  /** Human-readable local time, for debugging. */
  localTimeLabel: string;
};

/** Minimal shape of an existing post used for filled-slot detection. */
export type ExistingPostRef = {
  platform: OrganicPostPlatform;
  format: OrganicPostFormat;
  scheduledAt: Date | null | undefined;
};

/** Taxonomy shape used by scoreCreativeMatch. */
export type Taxonomy = {
  personas?: Array<{ id: string; name: string }>;
  occasions?: string[];
  formats?: string[];
};

/** Minimal creative asset shape needed for scoring. */
export type CreativeAsset = {
  id: string;
  kind: string;
  tagsJson: CreativeAssetTagsJson;
  /** True if this asset was used within the recent-use exclusion window. */
  recentlyUsed?: boolean;
};

// ─── Default Config ───────────────────────────────────────────────────────────

/**
 * 10 slots/day matching the plan:
 *   5 IG feed (4 single_image + 1 reel)
 *   2 IG story
 *   2 FB feed (single_image)
 *   1 FB+IG carousel
 *
 * Times are local to the timezone passed to enumerateSlotsForWindow.
 */
export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  platforms: [
    {
      platform: "ig",
      format: "single_image",
      timesOfDay: ["08:00", "12:00", "18:00", "20:00"],
      targetPerDay: 4,
    },
    {
      platform: "ig",
      format: "story",
      timesOfDay: ["10:00", "15:00"],
      targetPerDay: 2,
    },
    {
      platform: "ig",
      format: "reel",
      timesOfDay: ["19:00"],
      targetPerDay: 1,
    },
    {
      platform: "fb",
      format: "single_image",
      timesOfDay: ["09:00", "14:00"],
      targetPerDay: 2,
    },
    {
      platform: "fb_ig",
      format: "carousel",
      timesOfDay: ["17:00"],
      targetPerDay: 1,
    },
  ],
};

// ─── Timezone helpers ─────────────────────────────────────────────────────────

/**
 * Parse a local HH:mm time string and return a UTC Date for the given
 * calendar date (YYYY-MM-DD) and IANA timezone.
 *
 * Strategy: use the Intl.DateTimeFormat API to resolve the UTC offset for the
 * exact local-time instant we want. This handles DST correctly.
 */
export function localTimeToUtc(
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:mm"
  timezone: string,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number) as [number, number, number];
  const [hour, minute] = timeStr.split(":").map(Number) as [number, number];

  // Build an ISO string treating the components as local time in the target tz.
  // We use a trick: create the date in UTC, then measure the offset via Intl,
  // then adjust.
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Get the UTC offset for this instant in the target timezone.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(naiveUtc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  const tzYear = get("year");
  const tzMonth = get("month");
  const tzDay = get("day");
  const tzHour = get("hour") % 24; // 24 can appear for midnight in some locales
  const tzMinute = get("minute");

  // Difference between what the formatter shows vs what we wanted
  const tzInterpretedAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0);
  const offsetMs = naiveUtc.getTime() - tzInterpretedAsUtc;

  return new Date(naiveUtc.getTime() + offsetMs);
}

/**
 * Returns an array of YYYY-MM-DD strings for every calendar day in [fromDate, toDate).
 * The date boundaries are evaluated in the given timezone.
 */
export function calendarDaysInWindow(
  fromDate: Date,
  toDate: Date,
  timezone: string,
): string[] {
  const days: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Include every local calendar day that has any overlap with [fromDate, toDate).
  // Strategy: walk cursor from the local-date of fromDate forward, 1 day per step.
  // A day is included if its local-date <= the local-date of the last instant
  // before toDate (i.e. toDate - 1ms).
  const endLocalDate = fromDate < toDate
    ? fmt.format(new Date(toDate.getTime() - 1))
    : null;

  if (!endLocalDate) return days;

  let cursor = new Date(fromDate.getTime());

  while (true) {
    const localDate = fmt.format(cursor);
    if (localDate > endLocalDate) break;
    if (!days.includes(localDate)) {
      days.push(localDate);
    }
    // Advance by 1 day (in UTC — safe because we compare local dates via fmt)
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    // Safety: never loop more than 365 days
    if (days.length > 365) break;
  }

  return days;
}

// ─── Core: enumerate all slots ────────────────────────────────────────────────

/**
 * Returns every slot defined by `config` for each calendar day in [fromDate, toDate).
 * Slots whose resolved UTC time falls outside [fromDate, toDate) are dropped.
 */
export function enumerateSlotsForWindow(
  config: SlotConfig,
  fromDate: Date,
  toDate: Date,
  timezone: string,
): Slot[] {
  const days = calendarDaysInWindow(fromDate, toDate, timezone);
  const slots: Slot[] = [];

  for (const day of days) {
    for (const entry of config.platforms) {
      for (const timeStr of entry.timesOfDay) {
        const scheduledAt = localTimeToUtc(day, timeStr, timezone);

        // Only include slots whose UTC time falls within the requested window
        if (scheduledAt < fromDate || scheduledAt >= toDate) continue;

        slots.push({
          scheduledAt,
          platform: entry.platform,
          format: entry.format,
          localTimeLabel: `${day} ${timeStr} ${timezone}`,
        });
      }
    }
  }

  return slots;
}

// ─── Core: find unfilled slots ────────────────────────────────────────────────

/**
 * Given the full slot grid and existing posts, returns slots that are NOT
 * already covered by an existing post.
 *
 * A slot is considered "filled" when there is an existing post that:
 *   - has the same platform
 *   - has the same format
 *   - has a scheduledAt within ±MATCH_WINDOW_MS of the slot time
 */
const MATCH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export function findUnfilledSlots(
  allSlots: Slot[],
  existingPosts: ExistingPostRef[],
): Slot[] {
  return allSlots.filter((slot) => {
    const isFilled = existingPosts.some((post) => {
      if (!post.scheduledAt) return false;
      if (post.platform !== slot.platform) return false;
      if (post.format !== slot.format) return false;
      const diff = Math.abs(post.scheduledAt.getTime() - slot.scheduledAt.getTime());
      return diff <= MATCH_WINDOW_MS;
    });
    return !isFilled;
  });
}

// ─── Core: score creative asset against a slot ────────────────────────────────

/**
 * Score how well a creative asset fits a given slot.
 * Higher is better. Returns a number ≥ 0.
 *
 * Scoring factors:
 *   +40  format alignment (asset kind matches slot format class)
 *   +20  audience_tag present in tags (indicates richer tagging)
 *   +10  occasion tag is set (non-evergreen specialization)
 *   +10  persona tag is set
 *   -30  recently used penalty (asset used in last 14 days)
 */
export function scoreCreativeMatch(
  slot: Slot,
  asset: CreativeAsset,
  _taxonomy: Taxonomy,
): number {
  let score = 0;

  // Format alignment: map slot format to expected asset kinds
  const formatAssetKindMap: Record<OrganicPostFormat, string[]> = {
    single_image: ["hero_image", "aspect_1x1", "aspect_4x5", "aspect_9x16"],
    story: ["hero_image", "aspect_9x16"],
    reel: ["video"],
    carousel: ["hero_image", "aspect_1x1", "aspect_4x5"],
  };

  const acceptedKinds = formatAssetKindMap[slot.format] ?? [];
  if (acceptedKinds.includes(asset.kind)) {
    score += 40;
  }

  // Audience tag bonus (well-tagged assets are preferred)
  if (asset.tagsJson.audience_tag) {
    score += 20;
  }

  // Occasion tag bonus (targeted content is preferred over evergreen)
  if (asset.tagsJson.occasion && asset.tagsJson.occasion !== "evergreen") {
    score += 10;
  }

  // Persona tag bonus
  if (asset.tagsJson.persona) {
    score += 10;
  }

  // Recently-used penalty
  if (asset.recentlyUsed) {
    score -= 30;
  }

  return Math.max(0, score);
}
