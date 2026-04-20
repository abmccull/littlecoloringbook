import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Stub env before importing the module under test.
vi.mock("@littlecolorbook/shared/env", () => ({
  getMetaEnv: vi.fn(() => ({
    systemUserToken: "test-token",
    datasetId: "dataset_123",
    graphApiVersion: "v22.0",
    testEventCode: null,
    appId: null,
    appSecret: null,
    businessId: null,
    adAccountId: null,
    pageId: null,
    pageAccessToken: null,
    igUserId: null,
    pixelId: null,
    catalogId: null,
    webhookVerifyToken: null,
    webhookAppSecret: null,
  })),
}));

import { sendCapiEvent } from "../capi";
import { CapiSendError } from "../client";
import { getMetaEnv } from "@littlecolorbook/shared/env";
import type { CapiEventInput } from "../types";

const sampleEvent: CapiEventInput = {
  event_name: "Purchase",
  event_time: Math.floor(Date.now() / 1000),
  event_id: "uuid-test-event-1",
  action_source: "website",
  user_data: {
    em: ["hashed-email"],
  },
  custom_data: {
    value: 29.99,
    currency: "USD",
    order_id: "ord_123",
  },
};

describe("sendCapiEvent", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Reset to default (no test event code).
    vi.mocked(getMetaEnv).mockReturnValue({
      systemUserToken: "test-token",
      datasetId: "dataset_123",
      graphApiVersion: "v22.0",
      testEventCode: null,
      appId: null,
      appSecret: null,
      businessId: null,
      adAccountId: null,
      pageId: null,
      pageAccessToken: null,
      igUserId: null,
      pixelId: null,
      catalogId: null,
      webhookVerifyToken: null,
      webhookAppSecret: null,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("posts to the correct CAPI endpoint with access_token in body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events_received: 1, fbtrace_id: "trace-abc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendCapiEvent(sampleEvent);

    expect(result.events_received).toBe(1);
    expect(result.fbtrace_id).toBe("trace-abc");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v22.0/dataset_123/events");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as { access_token: string; data: unknown[] };
    expect(body.access_token).toBe("test-token");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).not.toHaveProperty("test_event_code");
  });

  it("includes test_event_code when env var is set", async () => {
    vi.mocked(getMetaEnv).mockReturnValue({
      systemUserToken: "test-token",
      datasetId: "dataset_123",
      graphApiVersion: "v22.0",
      testEventCode: "TEST12345",
      appId: null,
      appSecret: null,
      businessId: null,
      adAccountId: null,
      pageId: null,
      pageAccessToken: null,
      igUserId: null,
      pixelId: null,
      catalogId: null,
      webhookVerifyToken: null,
      webhookAppSecret: null,
    });

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events_received: 1, fbtrace_id: "trace-xyz" }), {
        status: 200,
      }),
    );

    await sendCapiEvent(sampleEvent);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.test_event_code).toBe("TEST12345");
  });

  it("rejects test_event_code in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(getMetaEnv).mockReturnValue({
      systemUserToken: "test-token",
      datasetId: "dataset_123",
      graphApiVersion: "v22.0",
      testEventCode: "TEST12345",
      appId: null,
      appSecret: null,
      businessId: null,
      adAccountId: null,
      pageId: null,
      pageAccessToken: null,
      igUserId: null,
      pixelId: null,
      catalogId: null,
      webhookVerifyToken: null,
      webhookAppSecret: null,
    });

    const err = await sendCapiEvent(sampleEvent).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(CapiSendError);
    expect(fetch).not.toHaveBeenCalled();
    if (err instanceof CapiSendError) {
      expect(err.message).toContain("META_TEST_EVENT_CODE must not be set in production");
    }
  });

  it("throws CapiSendError on 400 with error body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { message: "Invalid parameter", code: 100, error_subcode: 2804003 },
        }),
        { status: 400 },
      ),
    );

    const err = await sendCapiEvent(sampleEvent).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CapiSendError);
    if (err instanceof CapiSendError) {
      expect(err.code).toBe(100);
    }
  });

  it("returns events_received and fbtrace_id on success", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ events_received: 2, fbtrace_id: "ft_001", messages: ["ok"] }),
        { status: 200 },
      ),
    );

    const result = await sendCapiEvent(sampleEvent);
    expect(result.events_received).toBe(2);
    expect(result.fbtrace_id).toBe("ft_001");
    expect(result.messages).toEqual(["ok"]);
  });
});
