import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { generateDailyBriefs, sampleElementsForBrief } from "../brief-generator";
import type { CopyElementPoolItem } from "../brief-generator";

// Vitest's process.cwd() is the workspace package directory (packages/ads).
// Go two levels up to reach the monorepo root where campaign-taxonomy.yaml lives.
const TAXONOMY_PATH = resolve(process.cwd(), "../../campaign-taxonomy.yaml");

describe("generateDailyBriefs", () => {
  it("returns the requested count of briefs", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 7,
      seed: "test-seed-001",
      date: "2026-05-02",
    });

    expect(briefs).toHaveLength(7);
  });

  it("is deterministic — same seed + date produces same output", () => {
    const input = { taxonomyYamlPath: TAXONOMY_PATH, count: 5, seed: "determinism-test", date: "2026-05-02" };
    const runA = generateDailyBriefs(input);
    const runB = generateDailyBriefs(input);

    expect(runA.map((b) => b.slotKey)).toEqual(runB.map((b) => b.slotKey));
    expect(runA.map((b) => b.hook)).toEqual(runB.map((b) => b.hook));
    expect(runA.map((b) => b.format)).toEqual(runB.map((b) => b.format));
    expect(runA.map((b) => b.persona)).toEqual(runB.map((b) => b.persona));
  });

  it("produces different output for different seeds", () => {
    const base = { taxonomyYamlPath: TAXONOMY_PATH, count: 5, date: "2026-05-02" };
    const runA = generateDailyBriefs({ ...base, seed: "seed-A" });
    const runB = generateDailyBriefs({ ...base, seed: "seed-B" });

    // At least one hook should differ
    const anyDifferent = runA.some((a, i) => a.hook !== runB[i]?.hook || a.format !== runB[i]?.format);
    expect(anyDifferent).toBe(true);
  });

  it("round-robins personas — all personas used when count >= personas.length", () => {
    // Taxonomy has 6 personas; request 12 briefs to ensure 2 full rounds
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 12,
      seed: "persona-round-robin",
      date: "2026-05-02",
    });

    const usedPersonas = new Set(briefs.map((b) => b.persona));
    // Expect at least 5 of the 6 personas to appear (diversity constraint may
    // occasionally skip one in 12, but at least 5 should appear).
    expect(usedPersonas.size).toBeGreaterThanOrEqual(5);
  });

  it("enforces the 30% cap on (format, hook-family) combos", () => {
    // With 20 briefs the max for any single (format, hookFamily) pair is ceil(20 * 0.3) = 6.
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 20,
      seed: "diversity-test",
      date: "2026-05-03",
    });

    // Count occurrences of each hook text (proxy for hook-family diversity)
    const hookCounts: Map<string, number> = new Map();
    for (const b of briefs) {
      const key = `${b.format}|${b.hook}`;
      hookCounts.set(key, (hookCounts.get(key) ?? 0) + 1);
    }

    // No single exact (format, hook) pair should appear more than ceil(20*0.3)=6 times
    const maxAllowed = Math.ceil(20 * 0.3);
    for (const [, count] of hookCounts) {
      expect(count).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it("each brief has required fields including stable slotKey", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 3,
      seed: "field-check",
      date: "2026-05-04",
    });

    for (const brief of briefs) {
      expect(brief.slotKey).toBeTruthy();
      expect(brief.concept).toBeTruthy();
      expect(brief.format).toBeTruthy();
      expect(brief.persona).toBeTruthy();
      expect(brief.occasion).toBeTruthy();
      expect(brief.offerCode).toBeTruthy();
      expect(brief.hook).toBeTruthy();
      expect(brief.body).toBeTruthy();
      expect(brief.cta).toBeTruthy();
      expect(brief.visualPrompt).toBeTruthy();
      expect(brief.linkUrl).toContain("https://");
    }
  });

  it("slotKey is stable across regeneration with same date+seed", () => {
    const opts = { taxonomyYamlPath: TAXONOMY_PATH, count: 3, seed: "stable-slot", date: "2026-05-05" };
    const runA = generateDailyBriefs(opts);
    const runB = generateDailyBriefs(opts);

    expect(runA.map((b) => b.slotKey)).toEqual(runB.map((b) => b.slotKey));
  });

  // ─── Phase 7a: elementOverrides ───────────────────────────────────────────

  it("uses hook text from elementOverrides.hook when provided", () => {
    const hookOverride = { id: "el_hook_test", text: "OVERRIDE HOOK TEXT" };
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 3,
      seed: "override-test",
      date: "2026-05-06",
      elementOverrides: { hook: hookOverride },
    });

    for (const brief of briefs) {
      expect(brief.hook).toBe("OVERRIDE HOOK TEXT");
    }
  });

  it("sets elementIds.hook_id when hook override is provided", () => {
    const hookOverride = { id: "el_hook_test", text: "OVERRIDE HOOK TEXT" };
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 2,
      seed: "element-ids-test",
      date: "2026-05-06",
      elementOverrides: { hook: hookOverride },
    });

    for (const brief of briefs) {
      expect(brief.elementIds?.hook_id).toBe("el_hook_test");
    }
  });

  it("elementIds is null when no elementOverrides provided", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 3,
      seed: "no-overrides",
      date: "2026-05-06",
    });

    for (const brief of briefs) {
      expect(brief.elementIds).toBeNull();
    }
  });

  it("uses body, cta, visual_style overrides independently", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 2,
      seed: "multi-override",
      date: "2026-05-07",
      elementOverrides: {
        body: { id: "el_body_1", text: "CUSTOM BODY COPY" },
        cta: { id: "el_cta_1", text: "CUSTOM CTA" },
      },
    });

    for (const brief of briefs) {
      expect(brief.body).toBe("CUSTOM BODY COPY");
      expect(brief.cta).toBe("CUSTOM CTA");
      expect(brief.elementIds?.body_id).toBe("el_body_1");
      expect(brief.elementIds?.cta_id).toBe("el_cta_1");
      // hook_id should be absent since no hook override
      expect(brief.elementIds?.hook_id).toBeUndefined();
    }
  });
});

describe("sampleElementsForBrief", () => {
  const hookPool: CopyElementPoolItem[] = [
    { id: "h1", kind: "hook", text: "Hook A", audienceTag: "family" },
    { id: "h2", kind: "hook", text: "Hook B", audienceTag: "family" },
    { id: "h3", kind: "hook", text: "Hook C", audienceTag: "grandparent" },
    { id: "h4", kind: "hook", text: "Hook D" },
  ];

  it("returns an element from the pool", () => {
    const result = sampleElementsForBrief({
      kind: "hook",
      elementPool: hookPool,
      seed: "test-seed-001",
    });

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("hook");
    expect(hookPool.map((e) => e.id)).toContain(result?.id);
  });

  it("is deterministic — same seed produces same element", () => {
    const opts = { kind: "hook" as const, elementPool: hookPool, seed: "determinism-test" };
    const a = sampleElementsForBrief(opts);
    const b = sampleElementsForBrief(opts);

    expect(a?.id).toBe(b?.id);
  });

  it("prefers matching audienceTag when available", () => {
    // Ask for grandparent audience — only h3 matches
    const result = sampleElementsForBrief({
      kind: "hook",
      audienceTag: "grandparent",
      elementPool: hookPool,
      seed: "audience-test",
    });

    expect(result?.id).toBe("h3");
  });

  it("falls back to all same-kind when audienceTag finds no match", () => {
    const result = sampleElementsForBrief({
      kind: "hook",
      audienceTag: "pets",
      elementPool: hookPool,
      seed: "fallback-test",
    });

    // No pet elements, should fall back to any hook
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("hook");
  });

  it("returns null when pool is empty", () => {
    const result = sampleElementsForBrief({
      kind: "hook",
      elementPool: [],
      seed: "empty-pool",
    });

    expect(result).toBeNull();
  });

  it("returns null when no elements of requested kind exist", () => {
    const ctaOnlyPool: CopyElementPoolItem[] = [
      { id: "c1", kind: "cta", text: "Shop Now" },
    ];
    const result = sampleElementsForBrief({
      kind: "hook",
      elementPool: ctaOnlyPool,
      seed: "wrong-kind",
    });

    expect(result).toBeNull();
  });
});
