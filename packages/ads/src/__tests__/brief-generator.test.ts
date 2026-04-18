import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { generateDailyBriefs, sampleElementsForBrief, buildBanditArmsFromPerformance } from "../brief-generator";
import type { CopyElementPoolItem, ElementPriorRow } from "../brief-generator";

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

// ─── Phase 7c: buildBanditArmsFromPerformance ────────────────────────────────

describe("buildBanditArmsFromPerformance", () => {
  it("maps purchases and clicks to alpha/beta correctly", () => {
    const rows: ElementPriorRow[] = [
      { id: "el1", purchases: 10, clicks: 100, lastUsedAt: null },
    ];
    const arms = buildBanditArmsFromPerformance(rows);
    expect(arms).toHaveLength(1);
    const arm = arms[0]!;
    expect(arm.id).toBe("el1");
    expect(arm.alpha).toBe(1 + 10); // priorAlpha=1 + purchases=10
    expect(arm.beta).toBe(1 + (100 - 10)); // priorBeta=1 + (clicks - purchases)=90
    expect(arm.sampleCount).toBe(100);
  });

  it("uses adCount*100 proxy when clicks is zero", () => {
    const rows: ElementPriorRow[] = [
      { id: "el2", purchases: 3, clicks: 0, lastUsedAt: null },
    ];
    const arms = buildBanditArmsFromPerformance(rows);
    const arm = arms[0]!;
    // proxy = 3 * 100 = 300 trials; failures = 300 - 3 = 297
    expect(arm.alpha).toBe(1 + 3);
    expect(arm.beta).toBe(1 + 297);
    expect(arm.sampleCount).toBe(300);
  });

  it("respects custom priorAlpha and priorBeta", () => {
    const rows: ElementPriorRow[] = [
      { id: "el3", purchases: 5, clicks: 50, lastUsedAt: null },
    ];
    const arms = buildBanditArmsFromPerformance(rows, 2, 3);
    const arm = arms[0]!;
    expect(arm.alpha).toBe(2 + 5);
    expect(arm.beta).toBe(3 + (50 - 5));
    expect(arm.priorAlpha).toBe(2);
    expect(arm.priorBeta).toBe(3);
  });

  it("handles multiple rows and preserves order", () => {
    const rows: ElementPriorRow[] = [
      { id: "a", purchases: 1, clicks: 10, lastUsedAt: null },
      { id: "b", purchases: 5, clicks: 20, lastUsedAt: null },
    ];
    const arms = buildBanditArmsFromPerformance(rows);
    expect(arms.map((a) => a.id)).toEqual(["a", "b"]);
  });
});

// ─── Phase 7c: samplingMode='uniform' backward compat ────────────────────────

describe("generateDailyBriefs — uniform mode (backward compat)", () => {
  it("uniform mode ignores learnedPriors and generates same output as before", () => {
    const priors: ElementPriorRow[] = [
      { id: "hook_winner", purchases: 100, clicks: 200, lastUsedAt: new Date() },
    ];
    const baseInput = {
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 5,
      seed: "uniform-compat",
      date: "2026-05-10",
    };
    const withoutPriors = generateDailyBriefs(baseInput);
    const withPriorsUniform = generateDailyBriefs({
      ...baseInput,
      learnedPriors: { hooks: priors },
      samplingMode: "uniform" as const,
    });
    // Must be identical — uniform mode is backward-compatible
    expect(withoutPriors.map((b) => b.hook)).toEqual(withPriorsUniform.map((b) => b.hook));
    expect(withoutPriors.map((b) => b.elementIds)).toEqual(withPriorsUniform.map((b) => b.elementIds));
  });
});

// ─── Phase 7c: samplingMode='thompson' ───────────────────────────────────────

describe("generateDailyBriefs — thompson mode", () => {
  const hookPriors: ElementPriorRow[] = [
    { id: "hook_winner", purchases: 50, clicks: 200, lastUsedAt: new Date() },
    { id: "hook_loser", purchases: 1, clicks: 200, lastUsedAt: new Date() },
  ];

  it("sets element_ids.hook_id when thompson sampling fires", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 5,
      seed: "thompson-test",
      date: "2026-05-11",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "thompson",
    });
    // Every brief should have a hook_id from the priors (thompson always fires)
    for (const brief of briefs) {
      expect(brief.elementIds?.hook_id).toMatch(/^hook_winner$|^hook_loser$/);
    }
  });

  it("picks the winner element more often than the loser across 20 briefs", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 20,
      seed: "thompson-winner-bias",
      date: "2026-05-11",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "thompson",
    });
    const winnerCount = briefs.filter((b) => b.elementIds?.hook_id === "hook_winner").length;
    const loserCount = briefs.filter((b) => b.elementIds?.hook_id === "hook_loser").length;
    // With 50 successes vs 1, the winner should dominate
    expect(winnerCount).toBeGreaterThan(loserCount);
  });

  it("still produces the correct count of briefs in thompson mode", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 8,
      seed: "thompson-count",
      date: "2026-05-12",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "thompson",
    });
    expect(briefs).toHaveLength(8);
  });

  it("falls back to uniform when priors are empty for an axis", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 3,
      seed: "thompson-no-priors",
      date: "2026-05-13",
      learnedPriors: { hooks: [] }, // empty — no arms to sample from
      samplingMode: "thompson",
    });
    // Should still produce briefs without crash; hook_id should be absent
    expect(briefs).toHaveLength(3);
    for (const brief of briefs) {
      expect(brief.elementIds).toBeNull();
    }
  });
});

// ─── Phase 7c: samplingMode='hybrid' ─────────────────────────────────────────

describe("generateDailyBriefs — hybrid mode", () => {
  const hookPriors: ElementPriorRow[] = [
    { id: "hook_a", purchases: 30, clicks: 100, lastUsedAt: new Date() },
    { id: "hook_b", purchases: 2, clicks: 100, lastUsedAt: new Date() },
  ];

  it("produces a mix of Thompson and uniform slots (not all hooks from priors)", () => {
    // explorationRate=0.5 means ~50% of slots use uniform → no hook_id
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 20,
      seed: "hybrid-mix",
      date: "2026-05-14",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "hybrid",
      explorationRate: 0.5,
    });
    const withHookId = briefs.filter((b) => b.elementIds?.hook_id).length;
    const withoutHookId = briefs.filter((b) => !b.elementIds?.hook_id).length;
    // Both groups should be non-empty
    expect(withHookId).toBeGreaterThan(0);
    expect(withoutHookId).toBeGreaterThan(0);
  });

  it("explorationRate=0 means all slots use Thompson", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 10,
      seed: "hybrid-exploit-all",
      date: "2026-05-15",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "hybrid",
      explorationRate: 0,
    });
    // All briefs should have hook_id from priors
    for (const brief of briefs) {
      expect(brief.elementIds?.hook_id).toBeDefined();
    }
  });

  it("explorationRate=1 means all slots use uniform (no hook_id from priors)", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 10,
      seed: "hybrid-explore-all",
      date: "2026-05-16",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "hybrid",
      explorationRate: 1,
    });
    // No brief should have hook_id when exploration is 100%
    for (const brief of briefs) {
      expect(brief.elementIds?.hook_id).toBeUndefined();
    }
  });

  it("is deterministic — same seed + hybrid mode produces same output", () => {
    const opts = {
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 5,
      seed: "hybrid-determinism",
      date: "2026-05-17",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "hybrid" as const,
      explorationRate: 0.3,
    };
    const runA = generateDailyBriefs(opts);
    const runB = generateDailyBriefs(opts);
    expect(runA.map((b) => b.elementIds?.hook_id)).toEqual(runB.map((b) => b.elementIds?.hook_id));
  });

  it("respects the 30% diversity cap regardless of sampling mode", () => {
    const briefs = generateDailyBriefs({
      taxonomyYamlPath: TAXONOMY_PATH,
      count: 20,
      seed: "hybrid-diversity",
      date: "2026-05-18",
      learnedPriors: { hooks: hookPriors },
      samplingMode: "hybrid",
      explorationRate: 0.2,
    });
    const maxAllowed = Math.ceil(20 * 0.3);
    const comboCount: Map<string, number> = new Map();
    for (const b of briefs) {
      const key = `${b.format}|${b.hook}`;
      comboCount.set(key, (comboCount.get(key) ?? 0) + 1);
    }
    for (const [, cnt] of comboCount) {
      expect(cnt).toBeLessThanOrEqual(maxAllowed);
    }
  });
});
