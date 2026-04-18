import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FbPublishError } from "../types";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function importPublisher() {
  const mod = await import("../fb-page");
  return mod.publishFbPagePhoto;
}

const BASE_INPUT = {
  pageId: "123456789",
  accessToken: "EAAtest",
  imagePath: "/tmp/test.jpg",
  caption: "Hello world",
};

describe("publishFbPagePhoto", () => {
  it("returns { id, post_id } on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "photo_abc", post_id: "page_xyz_post" }),
    });

    const publishFbPagePhoto = await importPublisher();
    const result = await publishFbPagePhoto(BASE_INPUT);

    expect(result.id).toBe("photo_abc");
    expect(result.post_id).toBe("page_xyz_post");
  });

  it("includes caption, published, and access_token in FormData payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "photo_abc", post_id: "post_abc" }),
    });

    const publishFbPagePhoto = await importPublisher();
    await publishFbPagePhoto(BASE_INPUT);

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/123456789/photos");
    expect(calledInit.method).toBe("POST");

    const body = calledInit.body as FormData;
    expect(body.get("message")).toBe("Hello world");
    expect(body.get("published")).toBe("true");
    expect(body.get("access_token")).toBe("EAAtest");
  });

  it("sets published=false and scheduled_publish_time when scheduledUnix is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "photo_abc", post_id: "post_abc" }),
    });

    const publishFbPagePhoto = await importPublisher();
    await publishFbPagePhoto({ ...BASE_INPUT, scheduledUnix: 1800000000 });

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = calledInit.body as FormData;
    expect(body.get("published")).toBe("false");
    expect(body.get("scheduled_publish_time")).toBe("1800000000");
  });

  it("retries on HTTP 429 and eventually succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "Rate limited", code: 429, error_subcode: null } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "photo_retry", post_id: "post_retry" }),
      });

    vi.useFakeTimers();

    const publishFbPagePhoto = await importPublisher();
    const promise = publishFbPagePhoto(BASE_INPUT);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.id).toBe("photo_retry");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("retries on Graph error code 613 (rate limit)", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: "User request limit reached", code: 613, error_subcode: 1487742 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "photo_613", post_id: "post_613" }),
      });

    vi.useFakeTimers();

    const publishFbPagePhoto = await importPublisher();
    const promise = publishFbPagePhoto(BASE_INPUT);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.id).toBe("photo_613");

    vi.useRealTimers();
  });

  it("throws FbPublishError with code and subcode on non-retryable error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "Invalid access token", code: 190, error_subcode: 460 } }),
    });

    const publishFbPagePhoto = await importPublisher();

    await expect(publishFbPagePhoto(BASE_INPUT)).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof FbPublishError)) return false;
      return err.code === 190 && err.subcode === 460 && err.message === "Invalid access token";
    });
  });
});
