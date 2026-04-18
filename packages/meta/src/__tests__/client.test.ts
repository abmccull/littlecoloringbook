import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Stub the DB record call so tests don't need a database.
vi.mock("@littlecolorbook/db/repositories", () => ({
  recordMetaApiCall: vi.fn().mockResolvedValue(undefined),
}));

import { GraphClient, CapiSendError } from "../client";

const originalFetch = globalThis.fetch;

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
}

describe("GraphClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("calls GET with access_token in querystring", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockImplementationOnce(makeJsonResponse({ data: [] }));

    const client = new GraphClient({ accessToken: "tok_test", version: "v22.0" });
    const p = client.get<{ data: unknown[] }>("me/campaigns");
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.data).toEqual([]);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("access_token=tok_test");
    expect(url).toContain("graph.facebook.com/v22.0/me/campaigns");
  });

  it("calls POST with access_token in body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockImplementationOnce(makeJsonResponse({ id: "camp_123" }));

    const client = new GraphClient({ accessToken: "tok_test", version: "v22.0" });
    const p = client.post("act_123/campaigns", { name: "Test", objective: "OUTCOME_SALES" });
    await vi.runAllTimersAsync();
    await p;

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.access_token).toBe("tok_test");
    expect(body.name).toBe("Test");
  });

  it("exposes BUC usage from response header", async () => {
    const mockFetch = vi.mocked(fetch);
    const bucHeader = JSON.stringify([{ call_count: 42, type: "ads_management" }]);
    mockFetch.mockImplementationOnce(
      makeJsonResponse({ data: [] }, 200, { "X-Business-Use-Case-Usage": bucHeader }),
    );

    const client = new GraphClient({ accessToken: "tok", version: "v22.0" });
    const p = client.get("me");
    await vi.runAllTimersAsync();
    await p;
    expect(client.rateLimitHeaders.bucUsage).toBe(42);
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockImplementationOnce(
        makeJsonResponse({ error: { message: "rate limit", code: 613 } }, 429),
      )
      .mockImplementationOnce(makeJsonResponse({ id: "ok" }));

    const client = new GraphClient({ accessToken: "tok", version: "v22.0" });
    const p = client.get<{ id: string }>("me");
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result.id).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws CapiSendError after exhausting retries on 429", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockImplementation(
      makeJsonResponse({ error: { message: "rate limit", code: 613 } }, 429),
    );

    const client = new GraphClient({ accessToken: "tok", version: "v22.0" });
    // Attach rejection handler before awaiting timers to avoid unhandled rejection warning.
    const p = client.get("me").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toBeInstanceOf(CapiSendError);
  });

  it("throws CapiSendError on non-retryable 400", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockImplementationOnce(
      makeJsonResponse({ error: { message: "invalid param", code: 100 } }, 400),
    );

    const client = new GraphClient({ accessToken: "tok", version: "v22.0" });
    const p = client.get("me").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toBeInstanceOf(CapiSendError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
