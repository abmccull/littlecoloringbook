import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphClient } from "@littlecolorbook/meta";

function makeClient(overrides: Partial<{ post: GraphClient["post"]; get: GraphClient["get"] }> = {}): GraphClient {
  return {
    post: vi.fn().mockResolvedValue({ id: "adset_123" }),
    get: vi.fn().mockResolvedValue({ id: "adset_123", name: "Test Ad Set", status: "PAUSED" }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    rateLimitHeaders: { appUsage: null, adAccountUsage: null, bucUsage: null },
    ...overrides,
  } as unknown as GraphClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

const BASE_TARGETING = {
  geo_locations: { countries: ["US"] },
  age_min: 25,
  age_max: 55,
};

describe("createAdSet", () => {
  it("POSTs to act_{adAccountId}/adsets with correct body", async () => {
    const client = makeClient();
    const { createAdSet } = await import("../adsets");

    const result = await createAdSet({
      client,
      adAccountId: "1023080546186668",
      campaignId: "campaign_abc",
      name: "LCB Test Ad Set",
      dailyBudgetCents: 500,
      optimizationGoal: "OFFSITE_CONVERSIONS",
      billingEvent: "IMPRESSIONS",
      targeting: BASE_TARGETING,
    });

    expect(result.id).toBe("adset_123");
    expect(client.post).toHaveBeenCalledWith(
      "act_1023080546186668/adsets",
      expect.objectContaining({
        campaign_id: "campaign_abc",
        name: "LCB Test Ad Set",
        daily_budget: 500,
        optimization_goal: "OFFSITE_CONVERSIONS",
        billing_event: "IMPRESSIONS",
        status: "PAUSED",
        targeting: BASE_TARGETING,
      }),
    );
  });

  it("includes promoted_object with pixelId when pixelId provided", async () => {
    const client = makeClient();
    const { createAdSet } = await import("../adsets");

    await createAdSet({
      client,
      adAccountId: "123",
      campaignId: "cmp_abc",
      name: "With Pixel",
      dailyBudgetCents: 500,
      optimizationGoal: "OFFSITE_CONVERSIONS",
      billingEvent: "IMPRESSIONS",
      targeting: BASE_TARGETING,
      pixelId: "pixel_xyz",
    });

    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        promoted_object: { pixel_id: "pixel_xyz", custom_event_type: "PURCHASE" },
      }),
    );
  });

  it("includes start_time when provided", async () => {
    const client = makeClient();
    const { createAdSet } = await import("../adsets");

    await createAdSet({
      client,
      adAccountId: "123",
      campaignId: "cmp_abc",
      name: "Timed",
      dailyBudgetCents: 500,
      optimizationGoal: "LINK_CLICKS",
      billingEvent: "IMPRESSIONS",
      targeting: BASE_TARGETING,
      startTime: "2026-05-02T13:00:00Z",
    });

    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ start_time: "2026-05-02T13:00:00Z" }),
    );
  });
});

describe("updateAdSet", () => {
  it("POSTs patch to adSetId endpoint", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue({ success: true }) });
    const { updateAdSet } = await import("../adsets");

    await updateAdSet({ client, adSetId: "adset_abc", patch: { status: "ACTIVE", daily_budget: 1000 } });

    expect(client.post).toHaveBeenCalledWith("adset_abc", { status: "ACTIVE", daily_budget: 1000 });
  });
});

describe("pauseAdSet", () => {
  it("posts status=PAUSED to adSetId", async () => {
    const postSpy = vi.fn().mockResolvedValue({ success: true });
    const client = makeClient({ post: postSpy });
    const { pauseAdSet } = await import("../adsets");

    await pauseAdSet({ client, adSetId: "adset_xyz" });

    expect(postSpy).toHaveBeenCalledWith("adset_xyz", { status: "PAUSED" });
  });
});

describe("getAdSet", () => {
  it("GETs adSetId with default fields", async () => {
    const client = makeClient();
    const { getAdSet } = await import("../adsets");

    await getAdSet({ client, adSetId: "adset_abc" });

    expect(client.get).toHaveBeenCalledWith(
      "adset_abc",
      expect.objectContaining({ fields: expect.stringContaining("id") }),
    );
  });
});
