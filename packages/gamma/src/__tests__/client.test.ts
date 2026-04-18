import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GammaClient } from "../client";
import { GammaError } from "../types";
import type { GammaGenerationResponse } from "../types";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeBinaryResponse(data: Uint8Array, status = 200): Response {
  return new Response(data as BodyInit, {
    status,
    headers: { "Content-Type": "image/png" },
  });
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PENDING_RESPONSE: GammaGenerationResponse = {
  id: "gen-123",
  status: "pending",
};

const COMPLETED_RESPONSE: GammaGenerationResponse = {
  id: "gen-123",
  status: "completed",
  credits: 5,
  gammaUrl: "https://gamma.app/docs/gen-123",
  exports: [
    { cardIndex: 1, url: "https://cdn.gamma.app/slide-1.png", contentType: "image/png" },
    { cardIndex: 2, url: "https://cdn.gamma.app/slide-2.png", contentType: "image/png" },
  ],
};

const FAILED_RESPONSE: GammaGenerationResponse = {
  id: "gen-123",
  status: "failed",
  errorMessage: "Prompt was rejected by content policy",
};

const DEFAULT_OPTS = {
  apiKey: "test-key",
  baseUrl: "https://public-api.gamma.app/v1.0",
  // Zero backoff so retry tests complete instantly
  backoffDelaysMs: [0, 0] as [number, number],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GammaClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // generate()
  // -------------------------------------------------------------------------

  describe("generate()", () => {
    it("POSTs to /generations with correct shape and X-API-KEY header", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: "gen-abc" }));

      const client = new GammaClient(DEFAULT_OPTS);
      const result = await client.generate({
        inputText: "10 slides about coloring books",
        format: "presentation",
        numCards: 10,
        exportAs: "png",
      });

      expect(result).toEqual({ generationId: "gen-abc" });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(url).toBe("https://public-api.gamma.app/v1.0/generations");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

      const parsedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(parsedBody.inputText).toBe("10 slides about coloring books");
      expect(parsedBody.format).toBe("presentation");
      expect(parsedBody.numCards).toBe(10);
      expect(parsedBody.exportAs).toBe("png");
    });

    it("throws GammaError when response is missing `id`", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ notId: "oops" }));

      const client = new GammaClient(DEFAULT_OPTS);
      await expect(
        client.generate({ inputText: "test" }),
      ).rejects.toThrow(GammaError);
    });
  });

  // -------------------------------------------------------------------------
  // getStatus()
  // -------------------------------------------------------------------------

  describe("getStatus()", () => {
    it("GETs /generations/{id} and parses the response", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse(COMPLETED_RESPONSE));

      const client = new GammaClient(DEFAULT_OPTS);
      const result = await client.getStatus("gen-123");

      expect(result.id).toBe("gen-123");
      expect(result.status).toBe("completed");
      expect(result.exports).toHaveLength(2);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://public-api.gamma.app/v1.0/generations/gen-123");
      expect(init.method).toBe("GET");
      expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
    });

    it("throws GammaError for an invalid response shape", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ garbage: true }));

      const client = new GammaClient(DEFAULT_OPTS);
      await expect(client.getStatus("gen-123")).rejects.toThrow(GammaError);
    });
  });

  // -------------------------------------------------------------------------
  // generateAndWait()
  // -------------------------------------------------------------------------

  describe("generateAndWait()", () => {
    it("polls until status=completed and returns the final response", async () => {
      // generate() call
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: "gen-123" }));
      // First poll: pending
      fetchMock.mockResolvedValueOnce(makeJsonResponse(PENDING_RESPONSE));
      // Second poll: pending
      fetchMock.mockResolvedValueOnce(makeJsonResponse(PENDING_RESPONSE));
      // Third poll: completed
      fetchMock.mockResolvedValueOnce(makeJsonResponse(COMPLETED_RESPONSE));

      const client = new GammaClient(DEFAULT_OPTS);
      const result = await client.generateAndWait(
        { inputText: "test" },
        { timeoutMs: 30_000, pollIntervalMs: 1 }, // 1 ms poll so test is fast
      );

      expect(result.status).toBe("completed");
      expect(result.id).toBe("gen-123");
      // generate + 3 polls = 4 fetch calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("throws GammaError with GENERATION_FAILED code when status=failed", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: "gen-123" }));
      fetchMock.mockResolvedValueOnce(makeJsonResponse(FAILED_RESPONSE));

      const client = new GammaClient(DEFAULT_OPTS);
      const err = await client
        .generateAndWait({ inputText: "test" }, { timeoutMs: 30_000, pollIntervalMs: 1 })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(GammaError);
      expect((err as GammaError).code).toBe("GENERATION_FAILED");
      expect((err as GammaError).message).toContain("Prompt was rejected by content policy");
    });

    it("throws GammaError with TIMEOUT code when deadline is exceeded", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: "gen-123" }));
      // All polls return pending
      fetchMock.mockResolvedValue(makeJsonResponse(PENDING_RESPONSE));

      const client = new GammaClient(DEFAULT_OPTS);
      // timeoutMs=5 so the very next poll would exceed the deadline
      const err = await client
        .generateAndWait({ inputText: "test" }, { timeoutMs: 5, pollIntervalMs: 100 })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(GammaError);
      expect((err as GammaError).code).toBe("TIMEOUT");
    });
  });

  // -------------------------------------------------------------------------
  // downloadSlidePngs()
  // -------------------------------------------------------------------------

  describe("downloadSlidePngs()", () => {
    it("downloads each PNG URL and returns a Buffer per slide in order", async () => {
      const slide1Data = new Uint8Array([1, 2, 3]);
      const slide2Data = new Uint8Array([4, 5, 6]);

      fetchMock
        .mockResolvedValueOnce(makeBinaryResponse(slide1Data))
        .mockResolvedValueOnce(makeBinaryResponse(slide2Data));

      const client = new GammaClient(DEFAULT_OPTS);
      const buffers = await client.downloadSlidePngs(COMPLETED_RESPONSE);

      expect(buffers).toHaveLength(2);
      expect(buffers[0]).toBeInstanceOf(Buffer);
      expect(buffers[0]).toEqual(Buffer.from(slide1Data));
      expect(buffers[1]).toEqual(Buffer.from(slide2Data));

      // Ensure URLs were fetched
      const urls = fetchMock.mock.calls.map((c) => c[0] as string);
      expect(urls).toContain("https://cdn.gamma.app/slide-1.png");
      expect(urls).toContain("https://cdn.gamma.app/slide-2.png");
    });

    it("throws GammaError with NO_PNG_EXPORTS when no per-slide exports exist", async () => {
      const pdfOnlyResponse: GammaGenerationResponse = {
        id: "gen-456",
        status: "completed",
        exports: [
          // PDF export — no cardIndex
          { url: "https://cdn.gamma.app/deck.pdf", contentType: "application/pdf" },
        ],
      };

      const client = new GammaClient(DEFAULT_OPTS);
      const err = await client
        .downloadSlidePngs(pdfOnlyResponse)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(GammaError);
      expect((err as GammaError).code).toBe("NO_PNG_EXPORTS");
      expect((err as GammaError).message).toMatch(/exportAs:"png"/);
    });

    it("throws GammaError with NO_PNG_EXPORTS when exports array is absent", async () => {
      const noExportsResponse: GammaGenerationResponse = {
        id: "gen-789",
        status: "completed",
      };

      const client = new GammaClient(DEFAULT_OPTS);
      const err = await client
        .downloadSlidePngs(noExportsResponse)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(GammaError);
      expect((err as GammaError).code).toBe("NO_PNG_EXPORTS");
    });
  });

  // -------------------------------------------------------------------------
  // Retry on 429
  // -------------------------------------------------------------------------

  describe("retry behaviour", () => {
    it("retries generate() once on 429 and succeeds on the second attempt", async () => {
      // First attempt: 429
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }),
      );
      // Second attempt: success
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: "gen-retry" }));

      const client = new GammaClient(DEFAULT_OPTS);
      // Override sleep to avoid real delays in tests
      const result = await client.generate({ inputText: "test" });

      expect(result.generationId).toBe("gen-retry");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting all retry attempts on repeated 429", async () => {
      // All three attempts: 429
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ message: "still rate limited" }), { status: 429 }),
      );

      const client = new GammaClient(DEFAULT_OPTS);
      const err = await client
        .generate({ inputText: "test" })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(GammaError);
      expect((err as GammaError).statusCode).toBe(429);
      // 1 original + 2 retries = 3 calls total
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
