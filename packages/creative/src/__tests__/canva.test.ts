import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock, MockInstance } from "vitest";
import sharp from "sharp";

// ─── Module-level mocks (set up BEFORE importing the modules under test) ───────

// Mock node:fs so orchestrator can be imported without a real file
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original, readFileSync: vi.fn() };
});

vi.mock("@littlecolorbook/pipeline", () => ({
  buildColoringPrompt: vi.fn(() => "mocked-coloring-prompt"),
}));

vi.mock("@littlecolorbook/shared/storage", () => ({
  uploadObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@littlecolorbook/db/repositories", () => ({
  insertCreativeBrief: vi.fn().mockResolvedValue({ id: "brief-id-mock" }),
  insertCreativeAsset: vi.fn().mockResolvedValue({ id: "asset-id-mock" }),
  updateCreativeAssetCompliance: vi.fn().mockResolvedValue(null),
}));

vi.mock("../gemini.js", () => ({
  renderColoringPageImage: vi.fn(),
}));

// ─── Imports after mocks ───────────────────────────────────────────────────────

import {
  getCanvaAccessToken,
  clearCanvaTokenCache,
  setCanvaTokenCache,
} from "../canva/oauth.js";
import { CanvaClient } from "../canva/client.js";
import { CanvaError } from "../canva/types.js";
import { produceCreative } from "../orchestrator.js";
import { renderColoringPageImage } from "../gemini.js";
import { readFileSync } from "node:fs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeTinyPngBuffer(width = 100, height = 133): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();
}

// Helper to cast a vi.fn() mock as both the real fetch type and a Mock for assertions
type FetchMock = Mock & typeof fetch;

function makeTokenResponse(token = "access-token-xyz", expiresIn = 14400) {
  return new Response(
    JSON.stringify({ access_token: token, expires_in: expiresIn }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeJobResponse(
  status: "queued" | "in_progress" | "success" | "failed",
  extra: Record<string, unknown> = {},
) {
  return new Response(
    JSON.stringify({ job: { id: "job-001", status, ...extra } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Suite: getCanvaAccessToken ────────────────────────────────────────────────

describe("getCanvaAccessToken", () => {
  beforeEach(() => {
    clearCanvaTokenCache();
  });

  it("fetches and returns a fresh access token", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeTokenResponse("token-abc")) as unknown as FetchMock;

    const token = await getCanvaAccessToken({
      clientId: "cid",
      clientSecret: "csec",
      refreshToken: "rtoken",
      fetchFn: mockFetch,
    });

    expect(token).toBe("token-abc");
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = (mockFetch as FetchMock).mock.calls[0];
    expect(url).toContain("/oauth/token");
    expect(opts?.headers as Record<string, string>).toMatchObject({
      Authorization: expect.stringMatching(/^Basic /),
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });

  it("returns cached token without re-fetching when called again within TTL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeTokenResponse("cached-token")) as unknown as FetchMock;

    await getCanvaAccessToken({
      clientId: "cid",
      clientSecret: "csec",
      refreshToken: "rtoken",
      fetchFn: mockFetch,
    });

    // Second call — same TTL window
    const token2 = await getCanvaAccessToken({
      clientId: "cid",
      clientSecret: "csec",
      refreshToken: "rtoken",
      fetchFn: mockFetch,
    });

    expect(token2).toBe("cached-token");
    expect(mockFetch).toHaveBeenCalledOnce(); // only once
  });

  it("re-fetches after the cache has expired", async () => {
    // Seed a cache entry that is already expired
    setCanvaTokenCache("old-token", Date.now() - 1);

    const mockFetch = vi.fn().mockResolvedValue(makeTokenResponse("new-token")) as unknown as FetchMock;

    const token = await getCanvaAccessToken({
      clientId: "cid",
      clientSecret: "csec",
      refreshToken: "rtoken",
      fetchFn: mockFetch,
    });

    expect(token).toBe("new-token");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("throws CanvaError with code CANVA_AUTH_FAILED on HTTP 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    ) as unknown as FetchMock;

    await expect(
      getCanvaAccessToken({
        clientId: "cid",
        clientSecret: "csec",
        refreshToken: "bad-token",
        fetchFn: mockFetch,
      }),
    ).rejects.toMatchObject({
      name: "CanvaError",
      code: "CANVA_AUTH_FAILED",
    });
  });

  it("throws CanvaError with CANVA_CREDENTIALS_MISSING when env vars absent", async () => {
    clearCanvaTokenCache();
    await expect(
      getCanvaAccessToken({ clientId: "", clientSecret: "", refreshToken: "" }),
    ).rejects.toMatchObject({
      code: "CANVA_CREDENTIALS_MISSING",
    });
  });
});

// ─── Suite: CanvaClient.uploadAsset ───────────────────────────────────────────

describe("CanvaClient.uploadAsset", () => {
  it("sends the image buffer as body with Asset-Upload-Metadata header and returns asset_id", async () => {
    const successResponse = makeJobResponse("success", { asset: { id: "asset-123" } });

    const mockFetch = vi.fn().mockResolvedValue(successResponse) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const fakeBuffer = await makeTinyPngBuffer();
    const result = await client.uploadAsset({ buffer: fakeBuffer, mimeType: "image/png" });

    expect(result.asset_id).toBe("asset-123");
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = (mockFetch as FetchMock).mock.calls[0];
    const headers = opts?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers["Asset-Upload-Metadata"]).toContain("image/png");
  });

  it("polls until success when initial response is queued", async () => {
    const mockFetch = vi.fn()
      // First call — POST returns queued
      .mockResolvedValueOnce(makeJobResponse("queued"))
      // Second call — GET poll returns in_progress
      .mockResolvedValueOnce(makeJobResponse("in_progress"))
      // Third call — GET poll returns success
      .mockResolvedValueOnce(makeJobResponse("success", { asset: { id: "polled-asset" } })) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const fakeBuffer = await makeTinyPngBuffer();
    const result = await client.uploadAsset({ buffer: fakeBuffer, mimeType: "image/png" });

    expect(result.asset_id).toBe("polled-asset");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws CanvaError when job fails", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeJobResponse("queued"))
      .mockResolvedValueOnce(
        makeJobResponse("failed", { error: { code: "UPLOAD_FAILED", message: "bad file" } }),
      ) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const fakeBuffer = await makeTinyPngBuffer();
    await expect(
      client.uploadAsset({ buffer: fakeBuffer, mimeType: "image/png" }),
    ).rejects.toMatchObject({ name: "CanvaError", code: "UPLOAD_FAILED" });
  });
});

// ─── Suite: CanvaClient.autofillBrandTemplate ─────────────────────────────────

describe("CanvaClient.autofillBrandTemplate", () => {
  it("POSTs with correct payload and returns designId on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJobResponse("success", { result: { design: { id: "design-999" } } }),
    ) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const { designId } = await client.autofillBrandTemplate({
      brandTemplateId: "tpl-abc",
      data: {
        hero_image: { type: "image", asset_id: "asset-123" },
        hook_text: { type: "text", text: "Turn your photo into a coloring page" },
      },
    });

    expect(designId).toBe("design-999");
    const [, opts] = (mockFetch as FetchMock).mock.calls[0];
    const sentBody = JSON.parse(opts?.body as string) as {
      brand_template_id: string;
      data: Record<string, unknown>;
    };
    expect(sentBody.brand_template_id).toBe("tpl-abc");
    expect(sentBody.data.hero_image).toMatchObject({ type: "image", asset_id: "asset-123" });
  });

  it("polls until the autofill job reaches success", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeJobResponse("queued"))
      .mockResolvedValueOnce(
        makeJobResponse("success", { result: { design: { id: "polled-design" } } }),
      ) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const { designId } = await client.autofillBrandTemplate({
      brandTemplateId: "tpl-abc",
      data: {},
    });

    expect(designId).toBe("polled-design");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─── Suite: CanvaClient.exportDesign ─────────────────────────────────────────

describe("CanvaClient.exportDesign", () => {
  it("POSTs with design_id and format, returns downloadUrl on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJobResponse("success", { urls: ["https://cdn.canva.com/export/image.png"] }),
    ) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const { downloadUrl } = await client.exportDesign({ designId: "design-999" });

    expect(downloadUrl).toBe("https://cdn.canva.com/export/image.png");
    const [, opts] = (mockFetch as FetchMock).mock.calls[0];
    const sentBody = JSON.parse(opts?.body as string) as {
      design_id: string;
      format: { type: string };
    };
    expect(sentBody.design_id).toBe("design-999");
    expect(sentBody.format.type).toBe("png");
  });

  it("polls until export job succeeds", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeJobResponse("in_progress"))
      .mockResolvedValueOnce(
        makeJobResponse("success", { urls: ["https://cdn.canva.com/export/done.png"] }),
      ) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const { downloadUrl } = await client.exportDesign({ designId: "design-x" });
    expect(downloadUrl).toBe("https://cdn.canva.com/export/done.png");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 429 before succeeding", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        makeJobResponse("success", { urls: ["https://cdn.canva.com/export/retried.png"] }),
      ) as unknown as FetchMock;

    const client = new CanvaClient({
      fetchFn: mockFetch,
      getAccessToken: async () => "test-token",
    });

    const { downloadUrl } = await client.exportDesign({ designId: "design-y" });
    expect(downloadUrl).toBe("https://cdn.canva.com/export/retried.png");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─── Suite: orchestrator — Canva integration ──────────────────────────────────

describe("produceCreative — Canva integration", () => {
  const validBrief = {
    kind: "static_image" as const,
    concept: "family-portrait",
    format: "before_after",
    hook: "Turn your family photos into coloring pages",
    body: "A personalized coloring book they will treasure forever.",
    cta: "Try a free sample",
    visualPrompt: "Family photo in the park",
    persona: "warm_millennial_mom",
    occasion: "evergreen",
    offerCode: "free_sample",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED;
  });

  afterEach(() => {
    delete process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED;
  });

  it("does NOT call CanvaClient when feature flag is off (default)", async () => {
    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    const mockCanvaClient = {
      uploadAsset: vi.fn(),
      autofillBrandTemplate: vi.fn(),
      exportDesign: vi.fn(),
      fetchDesignAsBuffer: vi.fn(),
    } as unknown as CanvaClient;

    const result = await produceCreative(
      { ...validBrief, canvaTemplateId: "tpl-123" },
      { sourceImagePath: "/fake/source.png", canvaClient: mockCanvaClient },
    );

    expect(mockCanvaClient.uploadAsset).not.toHaveBeenCalled();
    expect(result.metadata).toBeUndefined();
  });

  it("does NOT call CanvaClient when canvaTemplateId is absent even if flag is on", async () => {
    process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED = "true";

    const fakeBuffer = await makeTinyPngBuffer();
    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    const mockCanvaClient = {
      uploadAsset: vi.fn(),
      autofillBrandTemplate: vi.fn(),
      exportDesign: vi.fn(),
      fetchDesignAsBuffer: vi.fn(),
    } as unknown as CanvaClient;

    const result = await produceCreative(
      { ...validBrief }, // no canvaTemplateId
      { sourceImagePath: "/fake/source.png", canvaClient: mockCanvaClient },
    );

    expect(mockCanvaClient.uploadAsset).not.toHaveBeenCalled();
    expect(result.metadata).toBeUndefined();
  });

  it("runs the full Canva pipeline and stores canvaDesignId in metadata when flag + templateId set", async () => {
    process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED = "true";

    const fakeBuffer = await makeTinyPngBuffer();
    const canvaFinishedBuffer = await makeTinyPngBuffer(200, 200);

    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    const mockCanvaClient = {
      uploadAsset: vi.fn().mockResolvedValue({ asset_id: "asset-abc" }),
      autofillBrandTemplate: vi.fn().mockResolvedValue({ designId: "design-xyz" }),
      exportDesign: vi.fn().mockResolvedValue({ downloadUrl: "https://cdn.canva.com/img.png" }),
      fetchDesignAsBuffer: vi.fn().mockResolvedValue(canvaFinishedBuffer),
    } as unknown as CanvaClient;

    const result = await produceCreative(
      { ...validBrief, canvaTemplateId: "tpl-123" },
      { sourceImagePath: "/fake/source.png", canvaClient: mockCanvaClient },
    );

    expect(mockCanvaClient.uploadAsset).toHaveBeenCalledOnce();
    expect(mockCanvaClient.autofillBrandTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ brandTemplateId: "tpl-123" }),
    );
    expect(mockCanvaClient.exportDesign).toHaveBeenCalledWith(
      expect.objectContaining({ designId: "design-xyz" }),
    );
    expect(mockCanvaClient.fetchDesignAsBuffer).toHaveBeenCalledOnce();
    expect(result.metadata).toMatchObject({ canvaDesignId: "design-xyz" });
  });

  it("falls back to raw Gemini hero and annotates canvaFailed on Canva error", async () => {
    process.env.CANVA_TEMPLATE_AUTOFILL_ENABLED = "true";

    const fakeBuffer = await makeTinyPngBuffer();

    (readFileSync as unknown as MockInstance<() => Buffer>).mockReturnValue(fakeBuffer);
    (renderColoringPageImage as unknown as MockInstance<() => Promise<unknown>>).mockResolvedValue({
      buffer: fakeBuffer,
      mimeType: "image/png",
    });

    const mockCanvaClient = {
      uploadAsset: vi.fn().mockRejectedValue(new CanvaError("CANVA_HTTP_500", "Server error", 500)),
      autofillBrandTemplate: vi.fn(),
      exportDesign: vi.fn(),
      fetchDesignAsBuffer: vi.fn(),
    } as unknown as CanvaClient;

    const result = await produceCreative(
      { ...validBrief, canvaTemplateId: "tpl-123" },
      { sourceImagePath: "/fake/source.png", canvaClient: mockCanvaClient },
    );

    // Must still succeed (no throw)
    expect(result.briefId).toBeTruthy();
    expect(result.metadata).toMatchObject({
      canvaFailed: true,
      canvaError: expect.stringContaining("Server error"),
    });
    // autofill should NOT have been called after uploadAsset failed
    expect(mockCanvaClient.autofillBrandTemplate).not.toHaveBeenCalled();
  });
});
