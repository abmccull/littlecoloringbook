import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GraphClient } from "@littlecolorbook/meta";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeClient(overrides: Partial<{ post: GraphClient["post"] }> = {}): GraphClient {
  return {
    post: vi.fn().mockResolvedValue({ id: "creative_123" }),
    get: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({ success: true }),
    rateLimitHeaders: { appUsage: null, adAccountUsage: null, bucUsage: null },
    ...overrides,
  } as unknown as GraphClient;
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadAdImageRaw", () => {
  it("POSTs multipart FormData to adimages endpoint and returns hash", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          images: {
            "44-pets-VzG64C5T7p4.png": { hash: "abc123def456", url: "https://cdn.facebook.com/fake" },
          },
        }),
    });

    const { uploadAdImageRaw } = await import("../creatives");

    const result = await uploadAdImageRaw({
      accessToken: "EAAtest",
      version: "v22.0",
      adAccountId: "1023080546186668",
      imagePath: "/fake/path/44-pets-VzG64C5T7p4.png",
    });

    expect(result.hash).toBe("abc123def456");

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("act_1023080546186668/adimages");
    expect(calledUrl).toContain("v22.0");
    expect(calledInit.method).toBe("POST");

    const body = calledInit.body as FormData;
    expect(body.get("access_token")).toBe("EAAtest");
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: { message: "Invalid image format", code: 100 } }),
    });

    const { uploadAdImageRaw } = await import("../creatives");

    await expect(
      uploadAdImageRaw({
        accessToken: "EAAtest",
        version: "v22.0",
        adAccountId: "123",
        imagePath: "/fake/test.png",
      }),
    ).rejects.toThrow("Invalid image format");
  });

  it("throws when images key is missing in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ images: {} }),
    });

    const { uploadAdImageRaw } = await import("../creatives");

    await expect(
      uploadAdImageRaw({
        accessToken: "EAAtest",
        version: "v22.0",
        adAccountId: "123",
        imagePath: "/fake/test.png",
      }),
    ).rejects.toThrow("could not extract hash");
  });
});

describe("createAdCreative", () => {
  it("POSTs to act_{adAccountId}/adcreatives with correct object_story_spec", async () => {
    const client = makeClient();
    const { createAdCreative } = await import("../creatives");

    const result = await createAdCreative({
      client,
      adAccountId: "1023080546186668",
      name: "LCB Creative 001",
      pageId: "page_123",
      linkUrl: "https://littlecoloringbook.com/free-sample",
      message: "Turn your photos into a coloring book!",
      imageHash: "abc123def456",
      cta: "SHOP_NOW",
    });

    expect(result.id).toBe("creative_123");
    expect(client.post).toHaveBeenCalledWith(
      "act_1023080546186668/adcreatives",
      expect.objectContaining({
        name: "LCB Creative 001",
        object_story_spec: expect.objectContaining({
          page_id: "page_123",
          link_data: expect.objectContaining({
            link: "https://littlecoloringbook.com/free-sample",
            image_hash: "abc123def456",
            call_to_action: expect.objectContaining({ type: "SHOP_NOW" }),
          }),
        }),
      }),
    );
  });

  it("includes instagram_actor_id in object_story_spec when provided", async () => {
    const client = makeClient();
    const { createAdCreative } = await import("../creatives");

    await createAdCreative({
      client,
      adAccountId: "123",
      name: "IG Creative",
      pageId: "page_123",
      linkUrl: "https://example.com",
      message: "Hello",
      imageHash: "hash_abc",
      cta: "LEARN_MORE",
      instagramActorId: "ig_actor_456",
    });

    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        object_story_spec: expect.objectContaining({
          instagram_actor_id: "ig_actor_456",
        }),
      }),
    );
  });
});

describe("createAdCreativeFromPost", () => {
  it("POSTs object_story_id to adcreatives endpoint", async () => {
    const client = makeClient();
    const { createAdCreativeFromPost } = await import("../creatives");

    const result = await createAdCreativeFromPost({
      client,
      adAccountId: "123",
      name: "Post Boost Creative",
      objectStoryId: "page_123_post_456",
    });

    expect(result.id).toBe("creative_123");
    expect(client.post).toHaveBeenCalledWith(
      "act_123/adcreatives",
      expect.objectContaining({
        name: "Post Boost Creative",
        object_story_id: "page_123_post_456",
      }),
    );
  });
});
