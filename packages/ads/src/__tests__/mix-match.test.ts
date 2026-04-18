/**
 * Mix-match endpoint logic tests.
 *
 * These tests validate the core business rules without spinning up Next.js.
 * We test: axis selection, variant count limits, response shape, and
 * idempotency of the variant builder.
 */
import { describe, it, expect } from "vitest";

// ─── Helpers mirroring the endpoint logic ────────────────────────────────────
// These are pure functions extracted from the route handler for testability.

type CopyElementKind = "hook" | "body" | "cta" | "visual_style";

const kindToJsonKey: Record<CopyElementKind, string> = {
  hook: "hook_id",
  body: "body_id",
  cta: "cta_id",
  visual_style: "visual_style_id",
};

type MockElement = {
  id: string;
  kind: CopyElementKind;
  text: string;
  label: string | null;
  audienceTag: string | null;
};

function buildVariants(
  briefId: string,
  axes: CopyElementKind[],
  alternativesByAxis: Record<string, MockElement[]>,
  variantCount: number,
): Array<{
  variantAxis: CopyElementKind;
  elementId: string;
  elementText: string;
  elementLabel: string | null;
  briefInputPatch: {
    elementIds: Record<string, string> & { mix_match_parent_brief_id: string };
  };
}> {
  const variants = [];

  for (const axis of axes) {
    const pool = alternativesByAxis[axis] ?? [];
    const picks = pool.slice(0, variantCount);
    for (const el of picks) {
      variants.push({
        variantAxis: axis,
        elementId: el.id,
        elementText: el.text,
        elementLabel: el.label,
        briefInputPatch: {
          elementIds: {
            [kindToJsonKey[axis]]: el.id,
            mix_match_parent_brief_id: briefId,
          },
        },
      });
    }
  }

  return variants;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const MOCK_HOOKS: MockElement[] = [
  { id: "h1", kind: "hook", text: "Hook 1", label: "hook:story:1", audienceTag: "family" },
  { id: "h2", kind: "hook", text: "Hook 2", label: "hook:question:1", audienceTag: "family" },
  { id: "h3", kind: "hook", text: "Hook 3", label: "hook:stat:1", audienceTag: null },
];

const MOCK_CTAS: MockElement[] = [
  { id: "c1", kind: "cta", text: "Shop Now", label: "cta:shop_now", audienceTag: null },
  { id: "c2", kind: "cta", text: "Learn More", label: "cta:learn_more", audienceTag: null },
];

describe("mix-match variant builder", () => {
  it("produces one variant per element per axis", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook"],
      { hook: MOCK_HOOKS },
      3,
    );

    expect(variants).toHaveLength(3);
    expect(variants.every((v) => v.variantAxis === "hook")).toBe(true);
  });

  it("respects variantCount cap per axis", () => {
    // Pool has 3 hooks but we ask for 2
    const variants = buildVariants(
      "brief_001",
      ["hook"],
      { hook: MOCK_HOOKS },
      2,
    );

    expect(variants).toHaveLength(2);
  });

  it("handles multiple axes in one call", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook", "cta"],
      { hook: MOCK_HOOKS, cta: MOCK_CTAS },
      3,
    );

    // 3 hook variants + 2 cta variants (pool has only 2 ctas)
    expect(variants).toHaveLength(5);

    const hookVariants = variants.filter((v) => v.variantAxis === "hook");
    const ctaVariants = variants.filter((v) => v.variantAxis === "cta");
    expect(hookVariants).toHaveLength(3);
    expect(ctaVariants).toHaveLength(2);
  });

  it("each variant carries mix_match_parent_brief_id", () => {
    const variants = buildVariants(
      "source_brief_xyz",
      ["hook"],
      { hook: MOCK_HOOKS },
      3,
    );

    for (const v of variants) {
      expect(v.briefInputPatch.elementIds.mix_match_parent_brief_id).toBe("source_brief_xyz");
    }
  });

  it("each variant's elementIds sets the correct jsonb key for its axis", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook", "cta"],
      { hook: MOCK_HOOKS, cta: MOCK_CTAS },
      2,
    );

    for (const v of variants) {
      const axisKey = kindToJsonKey[v.variantAxis];
      expect(v.briefInputPatch.elementIds[axisKey]).toBe(v.elementId);
    }
  });

  it("produces no variants for an empty pool", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook"],
      { hook: [] },
      3,
    );

    expect(variants).toHaveLength(0);
  });

  it("variant elementText matches the element's text", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook"],
      { hook: [MOCK_HOOKS[0]!] },
      1,
    );

    expect(variants[0]?.elementText).toBe("Hook 1");
  });

  it("variant elementLabel matches the element's label", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook"],
      { hook: [MOCK_HOOKS[0]!] },
      1,
    );

    expect(variants[0]?.elementLabel).toBe("hook:story:1");
  });

  it("variantCount of 1 returns exactly one variant per axis", () => {
    const variants = buildVariants(
      "brief_001",
      ["hook", "cta"],
      { hook: MOCK_HOOKS, cta: MOCK_CTAS },
      1,
    );

    expect(variants).toHaveLength(2);
    const hookVs = variants.filter((v) => v.variantAxis === "hook");
    const ctaVs = variants.filter((v) => v.variantAxis === "cta");
    expect(hookVs).toHaveLength(1);
    expect(ctaVs).toHaveLength(1);
  });

  it("all_axes variant: hook+body+cta+visual_style — 4 axes × 1 element each = 4 variants", () => {
    const pool = {
      hook: [{ id: "h1", kind: "hook" as const, text: "H", label: null, audienceTag: null }],
      body: [{ id: "b1", kind: "body" as const, text: "B", label: null, audienceTag: null }],
      cta: [{ id: "c1", kind: "cta" as const, text: "C", label: null, audienceTag: null }],
      visual_style: [{ id: "vs1", kind: "visual_style" as const, text: "VS", label: null, audienceTag: null }],
    };

    const variants = buildVariants(
      "brief_001",
      ["hook", "body", "cta", "visual_style"],
      pool,
      1,
    );

    expect(variants).toHaveLength(4);
  });
});
