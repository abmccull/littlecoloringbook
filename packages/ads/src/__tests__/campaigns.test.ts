import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphClient } from "@littlecolorbook/meta";

// Minimal GraphClient mock — only the methods we need
function makeClient(overrides: Partial<{ post: GraphClient["post"]; get: GraphClient["get"]; delete: GraphClient["delete"] }> = {}): GraphClient {
  return {
    post: vi.fn().mockResolvedValue({ id: "campaign_123" }),
    get: vi.fn().mockResolvedValue({ id: "campaign_123", name: "Test", objective: "OUTCOME_SALES", status: "PAUSED" }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    rateLimitHeaders: { appUsage: null, adAccountUsage: null, bucUsage: null },
    ...overrides,
  } as unknown as GraphClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCampaign", () => {
  it("POSTs to act_{adAccountId}/campaigns with correct body", async () => {
    const client = makeClient();
    const { createCampaign } = await import("../campaigns");

    const result = await createCampaign({
      client,
      adAccountId: "1023080546186668",
      name: "LCB Test Campaign",
      objective: "OUTCOME_SALES",
    });

    expect(result.id).toBe("campaign_123");
    expect(client.post).toHaveBeenCalledWith(
      "act_1023080546186668/campaigns",
      expect.objectContaining({
        name: "LCB Test Campaign",
        objective: "OUTCOME_SALES",
        status: "PAUSED",
        special_ad_categories: [],
      }),
    );
  });

  it("uses custom status and specialAdCategories when provided", async () => {
    const client = makeClient();
    const { createCampaign } = await import("../campaigns");

    await createCampaign({
      client,
      adAccountId: "act_123",
      name: "Housing Campaign",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      specialAdCategories: ["HOUSING"],
    });

    expect(client.post).toHaveBeenCalledWith(
      "act_act_123/campaigns",
      expect.objectContaining({
        status: "ACTIVE",
        special_ad_categories: ["HOUSING"],
      }),
    );
  });
});

describe("updateCampaign", () => {
  it("POSTs patch to campaignId endpoint", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue({ success: true }) });
    const { updateCampaign } = await import("../campaigns");

    await updateCampaign({ client, campaignId: "campaign_abc", patch: { status: "PAUSED", name: "Renamed" } });

    expect(client.post).toHaveBeenCalledWith("campaign_abc", { status: "PAUSED", name: "Renamed" });
  });
});

describe("pauseCampaign", () => {
  it("calls updateCampaign with status=PAUSED", async () => {
    const postSpy = vi.fn().mockResolvedValue({ success: true });
    const client = makeClient({ post: postSpy });
    const { pauseCampaign } = await import("../campaigns");

    await pauseCampaign({ client, campaignId: "campaign_xyz" });

    expect(postSpy).toHaveBeenCalledWith("campaign_xyz", { status: "PAUSED" });
  });
});

describe("getCampaign", () => {
  it("GETs campaignId with default fields", async () => {
    const client = makeClient();
    const { getCampaign } = await import("../campaigns");

    await getCampaign({ client, campaignId: "campaign_123" });

    expect(client.get).toHaveBeenCalledWith(
      "campaign_123",
      expect.objectContaining({ fields: expect.stringContaining("id") }),
    );
  });

  it("GETs with custom fields when provided", async () => {
    const client = makeClient();
    const { getCampaign } = await import("../campaigns");

    await getCampaign({ client, campaignId: "campaign_123", fields: ["id", "spend_cap"] });

    expect(client.get).toHaveBeenCalledWith("campaign_123", { fields: "id,spend_cap" });
  });
});
