import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GraphClient } from "@littlecolorbook/meta";

function makeClient(overrides: Partial<{ post: GraphClient["post"]; get: GraphClient["get"] }> = {}): GraphClient {
  return {
    post: vi.fn().mockResolvedValue({ report_run_id: "report_run_999" }),
    get: vi.fn(),
    delete: vi.fn(),
    rateLimitHeaders: { appUsage: null, adAccountUsage: null, bucUsage: null },
    ...overrides,
  } as unknown as GraphClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchAdsInsights", () => {
  it("starts async job, polls until completed, fetches results", async () => {
    const getSpy = vi.fn()
      .mockResolvedValueOnce({ id: "report_run_999", async_status: "Job Running", async_percent_completion: 30 })
      .mockResolvedValueOnce({ id: "report_run_999", async_status: "Job Completed", async_percent_completion: 100 })
      .mockResolvedValueOnce({
        data: [
          { impressions: "10000", clicks: "300", spend: "25.00" },
        ],
      });

    const client = makeClient({ get: getSpy });
    const { fetchAdsInsights } = await import("../insights");

    const promise = fetchAdsInsights({
      client,
      entityId: "campaign_abc",
      level: "campaign",
      datePreset: "last_7d",
      fields: ["impressions", "clicks", "spend"],
    });

    // Advance past the first 3s poll interval
    await vi.advanceTimersByTimeAsync(3_000);
    // Advance past second poll
    await vi.advanceTimersByTimeAsync(3_000);

    const result = await promise;

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ impressions: "10000", clicks: "300" });

    // Verify: post to start job, then gets for poll + data
    expect(client.post).toHaveBeenCalledWith(
      "campaign_abc/insights",
      expect.objectContaining({ async: true, level: "campaign", date_preset: "last_7d" }),
    );
    expect(getSpy).toHaveBeenCalledWith("report_run_999");
    expect(getSpy).toHaveBeenCalledWith("report_run_999/insights", expect.objectContaining({ fields: "impressions,clicks,spend" }));
  });

  it("throws when async_status is Job Failed", async () => {
    const getSpy = vi.fn().mockResolvedValue({ id: "report_run_999", async_status: "Job Failed", async_percent_completion: 0 });
    const client = makeClient({ get: getSpy });
    const { fetchAdsInsights } = await import("../insights");

    // Capture rejection immediately to prevent unhandledRejection
    let caughtError: Error | null = null;
    const p = fetchAdsInsights({
      client,
      entityId: "adset_abc",
      level: "adset",
      datePreset: "last_30d",
      fields: ["impressions", "spend"],
    }).catch((e: Error) => { caughtError = e; });

    await vi.advanceTimersByTimeAsync(3_100);
    await p;

    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toContain("failed");
  });

  it("throws when max poll time exceeded", async () => {
    const getSpy = vi.fn().mockResolvedValue({ id: "report_run_999", async_status: "Job Running", async_percent_completion: 10 });
    const client = makeClient({ get: getSpy });
    const { fetchAdsInsights } = await import("../insights");

    // Capture rejection immediately to prevent unhandledRejection
    let caughtError: Error | null = null;
    const p = fetchAdsInsights({
      client,
      entityId: "ad_abc",
      level: "ad",
      datePreset: "last_7d",
      fields: ["spend"],
    }).catch((e: Error) => { caughtError = e; });

    // Advance enough poll cycles to exhaust the 60s timeout
    await vi.advanceTimersByTimeAsync(3_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await p;

    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toContain("did not complete within");
  });

  it("passes breakdowns and filtering in start body", async () => {
    const getSpy = vi.fn()
      .mockResolvedValueOnce({ id: "report_run_999", async_status: "Job Completed", async_percent_completion: 100 })
      .mockResolvedValueOnce({ data: [] });

    const client = makeClient({ get: getSpy });
    const { fetchAdsInsights } = await import("../insights");

    const promise = fetchAdsInsights({
      client,
      entityId: "account_abc",
      level: "account",
      datePreset: "today",
      fields: ["impressions"],
      breakdowns: ["age", "gender"],
      filtering: [{ field: "ad.effective_status", operator: "IN", value: ["ACTIVE"] }],
    });

    await vi.advanceTimersByTimeAsync(3_000);
    await promise;

    expect(client.post).toHaveBeenCalledWith(
      "account_abc/insights",
      expect.objectContaining({
        breakdowns: "age,gender",
        filtering: expect.stringContaining("ad.effective_status"),
      }),
    );
  });
});
