import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphClient } from "@littlecolorbook/meta";

function makeClient(overrides: Partial<{ post: GraphClient["post"]; get: GraphClient["get"] }> = {}): GraphClient {
  return {
    post: vi.fn().mockResolvedValue({ id: "ad_123" }),
    get: vi.fn().mockResolvedValue({ id: "ad_123", name: "Test Ad", status: "PAUSED" }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    rateLimitHeaders: { appUsage: null, adAccountUsage: null, bucUsage: null },
    ...overrides,
  } as unknown as GraphClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAd", () => {
  it("POSTs to act_{adAccountId}/ads with creative reference", async () => {
    const client = makeClient();
    const { createAd } = await import("../ads");

    const result = await createAd({
      client,
      adAccountId: "1023080546186668",
      adSetId: "adset_abc",
      name: "LCB Ad 001",
      adCreativeId: "creative_xyz",
    });

    expect(result.id).toBe("ad_123");
    expect(client.post).toHaveBeenCalledWith(
      "act_1023080546186668/ads",
      expect.objectContaining({
        adset_id: "adset_abc",
        name: "LCB Ad 001",
        creative: { creative_id: "creative_xyz" },
        status: "PAUSED",
      }),
    );
  });

  it("always creates as PAUSED by default", async () => {
    const client = makeClient();
    const { createAd } = await import("../ads");

    await createAd({
      client,
      adAccountId: "123",
      adSetId: "adset_abc",
      name: "Test",
      adCreativeId: "creative_abc",
    });

    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "PAUSED" }),
    );
  });

  it("accepts explicit ACTIVE status", async () => {
    const client = makeClient();
    const { createAd } = await import("../ads");

    await createAd({
      client,
      adAccountId: "123",
      adSetId: "adset_abc",
      name: "Test",
      adCreativeId: "creative_abc",
      status: "ACTIVE",
    });

    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "ACTIVE" }),
    );
  });
});

describe("updateAd", () => {
  it("POSTs patch to adId endpoint", async () => {
    const client = makeClient({ post: vi.fn().mockResolvedValue({ success: true }) });
    const { updateAd } = await import("../ads");

    await updateAd({ client, adId: "ad_abc", patch: { status: "ACTIVE" } });

    expect(client.post).toHaveBeenCalledWith("ad_abc", { status: "ACTIVE" });
  });
});

describe("pauseAd", () => {
  it("posts status=PAUSED to adId", async () => {
    const postSpy = vi.fn().mockResolvedValue({ success: true });
    const client = makeClient({ post: postSpy });
    const { pauseAd } = await import("../ads");

    await pauseAd({ client, adId: "ad_xyz" });

    expect(postSpy).toHaveBeenCalledWith("ad_xyz", { status: "PAUSED" });
  });
});

describe("getAd", () => {
  it("GETs adId with default fields", async () => {
    const client = makeClient();
    const { getAd } = await import("../ads");

    await getAd({ client, adId: "ad_abc" });

    expect(client.get).toHaveBeenCalledWith(
      "ad_abc",
      expect.objectContaining({ fields: expect.stringContaining("id") }),
    );
  });

  it("GETs with custom fields", async () => {
    const client = makeClient();
    const { getAd } = await import("../ads");

    await getAd({ client, adId: "ad_abc", fields: ["id", "effective_status"] });

    expect(client.get).toHaveBeenCalledWith("ad_abc", { fields: "id,effective_status" });
  });
});
