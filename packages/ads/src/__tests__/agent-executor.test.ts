import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphClient } from "@littlecolorbook/meta";

// Mock the DB creative request insertion
vi.mock("@littlecolorbook/db/repositories", () => ({
  insertCreativeRequest: vi.fn().mockResolvedValue({ id: "creq_test123" }),
}));

function makeClient(overrides: Partial<Record<"post" | "get" | "delete", unknown>> = {}): GraphClient {
  return {
    post: vi.fn().mockResolvedValue({ id: "meta_new_123", success: true }),
    get: vi.fn().mockResolvedValue({
      id: "ad_src",
      name: "Source Ad",
      adset_id: "adset_src",
      status: "ACTIVE",
      creative: { id: "creative_src", object_story_id: "123456_789" },
      optimization_goal: "OFFSITE_CONVERSIONS",
      billing_event: "IMPRESSIONS",
      targeting: { geo_locations: { countries: ["US"] } },
      daily_budget: "500",
    }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    rateLimitHeaders: { appUsage: null, adAccountUsage: null, bucUsage: null },
    ...overrides,
  } as unknown as GraphClient;
}

const ctx = {
  client: null as unknown as GraphClient,
  adAccountId: "1234567890",
  pageId: "page_abc",
};

beforeEach(() => {
  vi.clearAllMocks();
  ctx.client = makeClient();
});

describe("executeProposal — pause_ad", () => {
  it("calls pauseAd with the targetMetaId and returns metricsBaselineNeeded=true", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "pause_ad",
        payloadJson: { adId: "ad_from_payload" },
        targetMetaId: "ad_target_123",
        targetEntityType: "ad",
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(true);
    expect(ctx.client.post).toHaveBeenCalledWith(
      "ad_target_123",
      expect.objectContaining({ status: "PAUSED" }),
    );
  });

  it("falls back to payload adId when targetMetaId is null", async () => {
    const { executeProposal } = await import("../agent-executor");
    await executeProposal(
      {
        kind: "pause_ad",
        payloadJson: { adId: "ad_payload_fallback" },
        targetMetaId: null,
        targetEntityType: "ad",
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledWith(
      "ad_payload_fallback",
      expect.objectContaining({ status: "PAUSED" }),
    );
  });

  it("throws on invalid payload", async () => {
    const { executeProposal } = await import("../agent-executor");
    await expect(
      executeProposal(
        { kind: "pause_ad", payloadJson: {}, targetMetaId: null, targetEntityType: null },
        ctx,
      ),
    ).rejects.toThrow("Invalid payload");
  });
});

describe("executeProposal — scale_budget", () => {
  it("calls updateAdSet for adset entity and returns metricsBaselineNeeded=true", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "scale_budget",
        payloadJson: { entity: "adset", entityId: "adset_999", newDailyBudgetCents: 1000 },
        targetMetaId: "adset_999",
        targetEntityType: "adset",
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(true);
    expect(ctx.client.post).toHaveBeenCalledWith(
      "adset_999",
      expect.objectContaining({ daily_budget: 1000 }),
    );
  });

  it("calls updateCampaign for campaign entity", async () => {
    const { executeProposal } = await import("../agent-executor");
    await executeProposal(
      {
        kind: "scale_budget",
        payloadJson: { entity: "campaign", entityId: "camp_123", newDailyBudgetCents: 2000 },
        targetMetaId: "camp_123",
        targetEntityType: "campaign",
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledWith("camp_123", expect.objectContaining({ daily_budget: 2000 }));
  });

  it("throws when entity is 'ad'", async () => {
    const { executeProposal } = await import("../agent-executor");
    await expect(
      executeProposal(
        {
          kind: "scale_budget",
          payloadJson: { entity: "ad", entityId: "ad_123", newDailyBudgetCents: 500 },
          targetMetaId: null,
          targetEntityType: "ad",
        },
        ctx,
      ),
    ).rejects.toThrow("ads do not own budgets");
  });
});

describe("executeProposal — request_creative", () => {
  it("inserts a creative request row and returns metricsBaselineNeeded=false", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "request_creative",
        payloadJson: { brief: "A fun coloring page of a dragon for a 5-year-old" },
        targetMetaId: null,
        targetEntityType: null,
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(false);
    expect(result.result).toHaveProperty("creative_request_id");
  });
});

describe("executeProposal — report_insight", () => {
  it("returns the payload and metricsBaselineNeeded=false with no Meta calls", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "report_insight",
        payloadJson: { observation: "ROAS is declining on persona_mom ads", supporting_metrics: { roas: 1.2 } },
        targetMetaId: null,
        targetEntityType: null,
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(false);
    expect(result.result).toMatchObject({ observation: "ROAS is declining on persona_mom ads" });
    expect(ctx.client.post).not.toHaveBeenCalled();
    expect(ctx.client.get).not.toHaveBeenCalled();
  });
});

describe("executeProposal — flag_risk", () => {
  it("returns the payload and metricsBaselineNeeded=false with no Meta calls", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "flag_risk",
        payloadJson: { severity: "high", observation: "Account spend ramp is too steep", suggested_action: "pause all new launches" },
        targetMetaId: null,
        targetEntityType: null,
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(false);
    expect(result.result).toMatchObject({ severity: "high" });
    expect(ctx.client.post).not.toHaveBeenCalled();
  });
});

describe("executeProposal — update_targeting", () => {
  it("fetches current targeting, merges patch, and calls updateAdSet", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "update_targeting",
        payloadJson: { adSetId: "adset_555", targetingPatch: { age_min: 30 } },
        targetMetaId: "adset_555",
        targetEntityType: "adset",
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(true);
    // First call is getAdSet (GET), second is updateAdSet (POST)
    expect(ctx.client.get).toHaveBeenCalledWith("adset_555", expect.anything());
    expect(ctx.client.post).toHaveBeenCalledWith(
      "adset_555",
      expect.objectContaining({ targeting: expect.objectContaining({ age_min: 30 }) }),
    );
  });
});

describe("executeProposal — update_audience", () => {
  it("merges custom audience into targeting and calls updateAdSet", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "update_audience",
        payloadJson: { adSetId: "adset_888", customAudiences: [{ id: "ca_abc" }] },
        targetMetaId: "adset_888",
        targetEntityType: "adset",
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(true);
    expect(ctx.client.post).toHaveBeenCalledWith(
      "adset_888",
      expect.objectContaining({
        targeting: expect.objectContaining({ custom_audiences: [{ id: "ca_abc" }] }),
      }),
    );
  });
});

describe("executeProposal — duplicate_to_scaling_campaign", () => {
  it("fetches source ad + adset, creates new adset + creative + ad, metricsBaselineNeeded=true", async () => {
    const { executeProposal } = await import("../agent-executor");
    const result = await executeProposal(
      {
        kind: "duplicate_to_scaling_campaign",
        payloadJson: { adId: "ad_src", scalingCampaignId: "camp_scaling", newDailyBudgetCents: 1000 },
        targetMetaId: "ad_src",
        targetEntityType: "ad",
      },
      ctx,
    );
    expect(result.metricsBaselineNeeded).toBe(true);
    expect(result.result).toHaveProperty("newAdSetId");
    expect(result.result).toHaveProperty("newCreativeId");
    expect(result.result).toHaveProperty("newAdId");
  });
});
