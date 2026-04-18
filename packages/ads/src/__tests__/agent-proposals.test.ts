import { describe, it, expect, vi } from "vitest";
import {
  agentProposalInputSchema,
  classifyProposalApproval,
} from "../agent-proposals";
import type { AgentProposalKind } from "../agent-proposals";

// ─── Schema validation tests ──────────────────────────────────────────────────

describe("agentProposalInputSchema", () => {
  it("accepts valid pause_ad", () => {
    const result = agentProposalInputSchema.safeParse({ kind: "pause_ad", payload: { adId: "ad_123" } });
    expect(result.success).toBe(true);
  });

  it("rejects pause_ad with extra fields (strict)", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "pause_ad",
      payload: { adId: "ad_123", extra: "field" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid scale_budget for adset", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "scale_budget",
      payload: { entity: "adset", entityId: "adset_999", newDailyBudgetCents: 1000 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects scale_budget with invalid entity", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "scale_budget",
      payload: { entity: "pixel", entityId: "x", newDailyBudgetCents: 500 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid flag_risk with all fields", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "flag_risk",
      payload: { severity: "high", observation: "Something bad", suggested_action: "pause it" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid report_insight without supporting_metrics", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "report_insight",
      payload: { observation: "CTR is dropping" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "explode_everything",
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts request_creative", () => {
    const result = agentProposalInputSchema.safeParse({
      kind: "request_creative",
      payload: { brief: "A coloring page of a puppy" },
    });
    expect(result.success).toBe(true);
  });
});

// ─── Auto-approval matrix tests ───────────────────────────────────────────────

function makeLookups(adsetBudget: number | null = 500, campaignBudget: number | null = null) {
  return {
    getAdSet: vi.fn().mockResolvedValue(
      adsetBudget !== null ? { daily_budget: String(adsetBudget) } : null,
    ),
    getCampaign: vi.fn().mockResolvedValue(
      campaignBudget !== null ? { daily_budget: String(campaignBudget) } : null,
    ),
  };
}

describe("classifyProposalApproval", () => {
  it("auto-approves pause_ad", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "pause_ad",
      { adId: "ad_123" },
      makeLookups(),
    );
    expect(autoApproved).toBe(true);
  });

  it("auto-approves request_creative", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "request_creative",
      { brief: "puppy" },
      makeLookups(),
    );
    expect(autoApproved).toBe(true);
  });

  it("auto-approves report_insight", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "report_insight",
      { observation: "CTR declining" },
      makeLookups(),
    );
    expect(autoApproved).toBe(true);
  });

  it("auto-approves flag_risk", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "flag_risk",
      { severity: "medium", observation: "spend spike" },
      makeLookups(),
    );
    expect(autoApproved).toBe(true);
  });

  it("auto-approves scale_budget within 2× current and ≤$30/day", async () => {
    // current=500 cents, new=800 cents (1.6× and well under $30)
    const { autoApproved } = await classifyProposalApproval(
      "scale_budget",
      { entity: "adset", entityId: "adset_1", newDailyBudgetCents: 800 },
      makeLookups(500),
    );
    expect(autoApproved).toBe(true);
  });

  it("rejects scale_budget above 2× current", async () => {
    // current=500, new=1100 (2.2×)
    const { autoApproved, reason } = await classifyProposalApproval(
      "scale_budget",
      { entity: "adset", entityId: "adset_1", newDailyBudgetCents: 1100 },
      makeLookups(500),
    );
    expect(autoApproved).toBe(false);
    expect(reason).toMatch(/2×/);
  });

  it("rejects scale_budget above $30/day absolute ceiling", async () => {
    // current=5000, new=3001 (within 2× but over ceiling)
    const { autoApproved, reason } = await classifyProposalApproval(
      "scale_budget",
      { entity: "adset", entityId: "adset_1", newDailyBudgetCents: 3001 },
      makeLookups(5000),
    );
    expect(autoApproved).toBe(false);
    expect(reason).toMatch(/ceiling/);
  });

  it("rejects scale_budget targeting an ad entity", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "scale_budget",
      { entity: "ad", entityId: "ad_999", newDailyBudgetCents: 100 },
      makeLookups(),
    );
    expect(autoApproved).toBe(false);
  });

  it("requires human approval for duplicate_to_scaling_campaign", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "duplicate_to_scaling_campaign",
      { adId: "ad_1", scalingCampaignId: "camp_1", newDailyBudgetCents: 500 },
      makeLookups(),
    );
    expect(autoApproved).toBe(false);
  });

  it("requires human approval for update_targeting", async () => {
    const { autoApproved } = await classifyProposalApproval(
      "update_targeting",
      { adSetId: "adset_1", targetingPatch: { age_min: 25 } },
      makeLookups(),
    );
    expect(autoApproved).toBe(false);
  });

  it("requires human approval when adset budget lookup returns null", async () => {
    const { autoApproved, reason } = await classifyProposalApproval(
      "scale_budget",
      { entity: "adset", entityId: "adset_unknown", newDailyBudgetCents: 500 },
      makeLookups(null),
    );
    expect(autoApproved).toBe(false);
    expect(reason).toMatch(/could not determine/);
  });
});
