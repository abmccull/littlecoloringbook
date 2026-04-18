import { describe, it, expect } from "vitest";
import {
  enumerateSlotsForWindow,
  findUnfilledSlots,
  scoreCreativeMatch,
  localTimeToUtc,
  calendarDaysInWindow,
  DEFAULT_SLOT_CONFIG,
} from "../slot-rules";
import type { Slot, ExistingPostRef, CreativeAsset, Taxonomy } from "../slot-rules";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TZ = "America/New_York";

/** Build a Date at a specific UTC time. */
function utc(iso: string): Date {
  return new Date(iso);
}

const EMPTY_TAXONOMY: Taxonomy = {};

function makeAsset(overrides: Partial<CreativeAsset> = {}): CreativeAsset {
  return {
    id: "asset_001",
    kind: "hero_image",
    tagsJson: {},
    recentlyUsed: false,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    scheduledAt: utc("2026-04-20T13:00:00Z"),
    platform: "ig",
    format: "single_image",
    localTimeLabel: "2026-04-20 09:00 America/New_York",
    ...overrides,
  };
}

// ─── localTimeToUtc ───────────────────────────────────────────────────────────

describe("localTimeToUtc", () => {
  it("converts a standard eastern time (UTC-4 in spring) correctly", () => {
    // America/New_York is UTC-4 during EDT (April).
    const result = localTimeToUtc("2026-04-20", "09:00", TZ);
    // 09:00 EDT = 13:00 UTC
    expect(result.toISOString()).toBe("2026-04-20T13:00:00.000Z");
  });

  it("converts midnight local to correct UTC boundary", () => {
    // 00:00 EDT = 04:00 UTC
    const result = localTimeToUtc("2026-04-20", "00:00", TZ);
    expect(result.toISOString()).toBe("2026-04-20T04:00:00.000Z");
  });

  it("handles UTC-5 (EST) in winter correctly", () => {
    // America/New_York in January is UTC-5
    const result = localTimeToUtc("2026-01-15", "12:00", TZ);
    // 12:00 EST = 17:00 UTC
    expect(result.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("handles a UTC timezone with zero offset", () => {
    const result = localTimeToUtc("2026-04-20", "08:00", "UTC");
    expect(result.toISOString()).toBe("2026-04-20T08:00:00.000Z");
  });
});

// ─── calendarDaysInWindow ─────────────────────────────────────────────────────

describe("calendarDaysInWindow", () => {
  it("returns calendar days overlapping a 48h window (may include partial tail day)", () => {
    // from = 09:00 EDT Apr 20, to = 09:00 EDT Apr 22
    // Apr 22 partially overlaps the window boundary, so it's included for iteration.
    // enumerateSlotsForWindow filters out any slot times >= toDate afterward.
    const from = utc("2026-04-20T13:00:00Z"); // 09:00 EDT Apr 20
    const to = utc("2026-04-22T13:00:00Z");   // 09:00 EDT Apr 22
    const days = calendarDaysInWindow(from, to, TZ);
    expect(days).toContain("2026-04-20");
    expect(days).toContain("2026-04-21");
    // Length is 2 or 3 depending on whether Apr 22 tail day is included
    expect(days.length).toBeGreaterThanOrEqual(2);
    expect(days.length).toBeLessThanOrEqual(3);
  });

  it("returns 1 day when window is within a single calendar day", () => {
    const from = utc("2026-04-20T13:00:00Z");
    const to = utc("2026-04-20T22:00:00Z");
    const days = calendarDaysInWindow(from, to, TZ);
    expect(days).toEqual(["2026-04-20"]);
  });
});

// ─── enumerateSlotsForWindow ──────────────────────────────────────────────────

describe("enumerateSlotsForWindow — default config", () => {
  it("produces 10 × 2 = 20 slots over a 2-day window", () => {
    // 2 full calendar days: Apr 20 and Apr 21 EDT
    const from = utc("2026-04-20T04:00:00Z"); // midnight EDT Apr 20
    const to = utc("2026-04-22T04:00:00Z");   // midnight EDT Apr 22
    const slots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, from, to, TZ);
    expect(slots).toHaveLength(20);
  });

  it("each slot has a valid platform, format, and scheduledAt", () => {
    const from = utc("2026-04-20T04:00:00Z");
    const to = utc("2026-04-21T04:00:00Z");
    const slots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, from, to, TZ);
    for (const slot of slots) {
      expect(slot.scheduledAt).toBeInstanceOf(Date);
      expect(slot.platform).toMatch(/^(ig|fb|fb_ig)$/);
      expect(slot.format).toMatch(/^(single_image|carousel|reel|story)$/);
    }
  });

  it("produces slots only for platforms in the config", () => {
    const from = utc("2026-04-20T04:00:00Z");
    const to = utc("2026-04-21T04:00:00Z");
    const slots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, from, to, TZ);
    const platforms = [...new Set(slots.map((s) => s.platform))].sort();
    expect(platforms).toEqual(["fb", "fb_ig", "ig"].sort());
  });

  it("all slot times fall within the requested window", () => {
    const from = utc("2026-04-20T04:00:00Z");
    const to = utc("2026-04-21T04:00:00Z");
    const slots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, from, to, TZ);
    for (const slot of slots) {
      expect(slot.scheduledAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(slot.scheduledAt.getTime()).toBeLessThan(to.getTime());
    }
  });

  it("produces 0 slots when window is empty (from >= to)", () => {
    const from = utc("2026-04-20T12:00:00Z");
    const to = utc("2026-04-20T12:00:00Z");
    const slots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, from, to, TZ);
    expect(slots).toHaveLength(0);
  });

  it("respects custom config with reduced slot count", () => {
    const from = utc("2026-04-20T04:00:00Z");
    const to = utc("2026-04-22T04:00:00Z");
    const customConfig = {
      platforms: [
        { platform: "ig" as const, format: "single_image" as const, timesOfDay: ["09:00"], targetPerDay: 1 },
      ],
    };
    const slots = enumerateSlotsForWindow(customConfig, from, to, TZ);
    expect(slots).toHaveLength(2); // 1 per day × 2 days
  });
});

// ─── findUnfilledSlots ────────────────────────────────────────────────────────

describe("findUnfilledSlots", () => {
  it("returns all slots when no existing posts", () => {
    const from = utc("2026-04-20T04:00:00Z");
    const to = utc("2026-04-21T04:00:00Z");
    const allSlots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, from, to, TZ);
    const unfilled = findUnfilledSlots(allSlots, []);
    expect(unfilled).toHaveLength(allSlots.length);
  });

  it("marks a slot filled when a matching post is within ±30min", () => {
    const slot = makeSlot({ scheduledAt: utc("2026-04-20T13:00:00Z"), platform: "ig", format: "single_image" });
    // Existing post exactly on slot time
    const post: ExistingPostRef = {
      platform: "ig",
      format: "single_image",
      scheduledAt: utc("2026-04-20T13:00:00Z"),
    };
    const unfilled = findUnfilledSlots([slot], [post]);
    expect(unfilled).toHaveLength(0);
  });

  it("marks a slot filled when post is 29 minutes away", () => {
    const slot = makeSlot({ scheduledAt: utc("2026-04-20T13:00:00Z"), platform: "ig", format: "single_image" });
    const post: ExistingPostRef = {
      platform: "ig",
      format: "single_image",
      scheduledAt: utc("2026-04-20T13:29:00Z"),
    };
    const unfilled = findUnfilledSlots([slot], [post]);
    expect(unfilled).toHaveLength(0);
  });

  it("does NOT mark a slot filled when post is 31 minutes away", () => {
    const slot = makeSlot({ scheduledAt: utc("2026-04-20T13:00:00Z"), platform: "ig", format: "single_image" });
    const post: ExistingPostRef = {
      platform: "ig",
      format: "single_image",
      scheduledAt: utc("2026-04-20T13:31:00Z"),
    };
    const unfilled = findUnfilledSlots([slot], [post]);
    expect(unfilled).toHaveLength(1);
  });

  it("does NOT mark a slot filled when platform differs", () => {
    const slot = makeSlot({ platform: "ig", format: "single_image" });
    const post: ExistingPostRef = {
      platform: "fb",
      format: "single_image",
      scheduledAt: utc("2026-04-20T13:00:00Z"),
    };
    const unfilled = findUnfilledSlots([slot], [post]);
    expect(unfilled).toHaveLength(1);
  });

  it("does NOT mark a slot filled when format differs", () => {
    const slot = makeSlot({ platform: "ig", format: "single_image" });
    const post: ExistingPostRef = {
      platform: "ig",
      format: "story",
      scheduledAt: utc("2026-04-20T13:00:00Z"),
    };
    const unfilled = findUnfilledSlots([slot], [post]);
    expect(unfilled).toHaveLength(1);
  });

  it("handles posts with null scheduledAt gracefully", () => {
    const slot = makeSlot();
    const post: ExistingPostRef = { platform: "ig", format: "single_image", scheduledAt: null };
    const unfilled = findUnfilledSlots([slot], [post]);
    expect(unfilled).toHaveLength(1);
  });

  it("correctly fills subset of slots", () => {
    const slots = [
      makeSlot({ scheduledAt: utc("2026-04-20T13:00:00Z"), platform: "ig", format: "single_image" }),
      makeSlot({ scheduledAt: utc("2026-04-20T16:00:00Z"), platform: "ig", format: "story" }),
      makeSlot({ scheduledAt: utc("2026-04-20T23:00:00Z"), platform: "fb", format: "single_image" }),
    ];
    const posts: ExistingPostRef[] = [
      { platform: "ig", format: "single_image", scheduledAt: utc("2026-04-20T13:05:00Z") },
    ];
    const unfilled = findUnfilledSlots(slots, posts);
    expect(unfilled).toHaveLength(2);
    expect(unfilled.some((s) => s.format === "story")).toBe(true);
    expect(unfilled.some((s) => s.platform === "fb")).toBe(true);
  });
});

// ─── scoreCreativeMatch ───────────────────────────────────────────────────────

describe("scoreCreativeMatch", () => {
  it("gives a higher score to an asset whose kind matches the slot format", () => {
    const slot = makeSlot({ format: "single_image" });
    const goodAsset = makeAsset({ kind: "hero_image" });
    const badAsset = makeAsset({ kind: "video" });
    expect(scoreCreativeMatch(slot, goodAsset, EMPTY_TAXONOMY)).toBeGreaterThan(
      scoreCreativeMatch(slot, badAsset, EMPTY_TAXONOMY),
    );
  });

  it("awards bonus for audience_tag", () => {
    const slot = makeSlot();
    const tagged = makeAsset({ tagsJson: { audience_tag: "moms_25_45" } });
    const untagged = makeAsset({ tagsJson: {} });
    expect(scoreCreativeMatch(slot, tagged, EMPTY_TAXONOMY)).toBeGreaterThan(
      scoreCreativeMatch(slot, untagged, EMPTY_TAXONOMY),
    );
  });

  it("awards bonus for non-evergreen occasion", () => {
    const slot = makeSlot();
    const seasonal = makeAsset({ tagsJson: { occasion: "birthday" } });
    const evergreen = makeAsset({ tagsJson: { occasion: "evergreen" } });
    const unset = makeAsset({ tagsJson: {} });
    expect(scoreCreativeMatch(slot, seasonal, EMPTY_TAXONOMY)).toBeGreaterThan(
      scoreCreativeMatch(slot, evergreen, EMPTY_TAXONOMY),
    );
    expect(scoreCreativeMatch(slot, evergreen, EMPTY_TAXONOMY)).toBe(
      scoreCreativeMatch(slot, unset, EMPTY_TAXONOMY),
    );
  });

  it("applies recently-used penalty", () => {
    const slot = makeSlot();
    const fresh = makeAsset({ kind: "hero_image", recentlyUsed: false });
    const stale = makeAsset({ kind: "hero_image", recentlyUsed: true });
    expect(scoreCreativeMatch(slot, fresh, EMPTY_TAXONOMY)).toBeGreaterThan(
      scoreCreativeMatch(slot, stale, EMPTY_TAXONOMY),
    );
  });

  it("never returns a negative score", () => {
    const slot = makeSlot();
    const asset = makeAsset({ kind: "video", recentlyUsed: true, tagsJson: {} });
    expect(scoreCreativeMatch(slot, asset, EMPTY_TAXONOMY)).toBeGreaterThanOrEqual(0);
  });

  it("story format accepts hero_image and aspect_9x16 asset kinds", () => {
    const slot = makeSlot({ format: "story" });
    const hero = makeAsset({ kind: "hero_image" });
    const wide = makeAsset({ kind: "aspect_9x16" });
    const video = makeAsset({ kind: "video" });
    expect(scoreCreativeMatch(slot, hero, EMPTY_TAXONOMY)).toBeGreaterThan(0);
    expect(scoreCreativeMatch(slot, wide, EMPTY_TAXONOMY)).toBeGreaterThan(0);
    // video does not match story format kinds
    expect(scoreCreativeMatch(slot, video, EMPTY_TAXONOMY)).toBeLessThan(
      scoreCreativeMatch(slot, hero, EMPTY_TAXONOMY),
    );
  });

  it("reel format rewards video asset kind", () => {
    const slot = makeSlot({ format: "reel" });
    const video = makeAsset({ kind: "video" });
    const image = makeAsset({ kind: "hero_image" });
    expect(scoreCreativeMatch(slot, video, EMPTY_TAXONOMY)).toBeGreaterThan(
      scoreCreativeMatch(slot, image, EMPTY_TAXONOMY),
    );
  });
});
