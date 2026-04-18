/**
 * llm-compliance.test.ts
 *
 * Tests for Phase 2c — Claude Haiku LLM compliance scanner integration.
 * The Anthropic SDK is mocked so no network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @anthropic-ai/sdk before any imports that use it ───────────────────

const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

// Mock the shared env so we can control API key presence
vi.mock("@littlecolorbook/shared/env", () => ({
  getAnthropicEnv: vi.fn(() => ({
    apiKey: "test-api-key",
    model: "claude-haiku-4-5-20251001",
    llmComplianceTimeoutMs: 15_000,
  })),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { scanWithLlm, _lruCacheForTests } from "../compliance";
import { scanComplianceWithLlm, LLM_POLICY_VERSION, _resetClientForTests } from "../llm-compliance";
import { getAnthropicEnv } from "@littlecolorbook/shared/env";
import type { MockInstance } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Anthropic-SDK-like response object */
function makeApiResponse(jsonPayload: object) {
  return {
    content: [{ type: "text", text: JSON.stringify(jsonPayload) }],
    usage: { input_tokens: 800, output_tokens: 300 },
  };
}

const CLEAN_INPUT = {
  hook: "Turn your family photos into coloring pages",
  body: "A keepsake your kids will love.",
  cta: "Try a free sample",
};

const REJECTED_INPUT = {
  hook: "We know your child is special. #1 best coloring book — 48 hours only!",
  body: "Guaranteed returns on every purchase.",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("scanComplianceWithLlm — direct LLM call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _lruCacheForTests.clear();
  });

  it("returns a passed report when the LLM returns passed", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({
        status: "passed",
        warnings: [],
        errors: [],
        reasoning: "Copy is clean and policy-compliant.",
      }),
    );

    const result = await scanComplianceWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("passed");
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.policyVersion).toBe(LLM_POLICY_VERSION);
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
  });

  it("returns a warned report when the LLM returns warned", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({
        status: "warned",
        warnings: [{ code: "LLM_SOFT_FLAG", message: "Soft issue", evidence: "free sample" }],
        errors: [],
        reasoning: "Minor soft flag detected.",
      }),
    );

    const result = await scanComplianceWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("warned");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe("LLM_SOFT_FLAG");
  });

  it("returns a rejected report when the LLM returns rejected", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({
        status: "rejected",
        warnings: [],
        errors: [{ code: "LLM_PERSONAL_ATTR", message: "Implied attribute", evidence: "your gifted child" }],
        reasoning: "Personal attribute language detected.",
      }),
    );

    const result = await scanComplianceWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("rejected");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("LLM_PERSONAL_ATTR");
  });

  it("returns llm_parse_error warning when LLM returns non-JSON", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Sorry, I cannot help with that." }],
    });

    const result = await scanComplianceWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "llm_parse_error")).toBe(true);
  });

  it("returns llm_parse_error warning when LLM returns JSON with wrong schema", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ verdict: "ok" }) }],
    });

    const result = await scanComplianceWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "llm_parse_error")).toBe(true);
  });

  it("strips markdown fences before parsing JSON response", async () => {
    const payload = { status: "passed", warnings: [], errors: [], reasoning: "Clean." };
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n" + JSON.stringify(payload) + "\n```" }],
    });

    const result = await scanComplianceWithLlm(CLEAN_INPUT);
    expect(result.status).toBe("passed");
  });

  it("throws when ANTHROPIC_API_KEY is not configured", async () => {
    // Reset the singleton so getClient() re-evaluates the env mock
    _resetClientForTests();

    (getAnthropicEnv as unknown as MockInstance).mockReturnValueOnce({
      apiKey: null,
      model: "claude-haiku-4-5-20251001",
      llmComplianceTimeoutMs: 15_000,
    });

    await expect(scanComplianceWithLlm(CLEAN_INPUT)).rejects.toThrow(
      "ANTHROPIC_API_KEY is not configured",
    );
  });
});

describe("scanWithLlm — integrated (regex + LLM + cache)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _lruCacheForTests.clear();
  });

  it("returns regex result immediately for rejected input — never calls LLM", async () => {
    const result = await scanWithLlm(REJECTED_INPUT);

    expect(result.status).toBe("rejected");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("calls the LLM when regex returns passed", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({ status: "passed", warnings: [], errors: [], reasoning: "Clean." }),
    );

    const result = await scanWithLlm(CLEAN_INPUT);

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(result.status).toBe("passed");
  });

  it("merges LLM warnings with clean regex result → status warned", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({
        status: "warned",
        warnings: [{ code: "LLM_WARN_1", message: "LLM soft flag", evidence: "sample" }],
        errors: [],
        reasoning: "Soft flag from LLM.",
      }),
    );

    const result = await scanWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "LLM_WARN_1")).toBe(true);
  });

  it("merges LLM rejected with clean regex → status rejected", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({
        status: "rejected",
        warnings: [],
        errors: [{ code: "LLM_ERR_1", message: "Hard LLM error", evidence: "bad phrase" }],
        reasoning: "Hard violation.",
      }),
    );

    const result = await scanWithLlm(CLEAN_INPUT);

    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "LLM_ERR_1")).toBe(true);
  });

  it("deduplicates issues with the same code from regex and LLM", async () => {
    // WARN_EXCESSIVE_EXCLAMATIONS is a regex warning
    const warnedInput = { hook: "Order now!!!", body: "Family coloring fun." };

    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({
        status: "warned",
        // LLM also flags the same code
        warnings: [{ code: "WARN_EXCESSIVE_EXCLAMATIONS", message: "LLM also sees this", evidence: "!!!" }],
        errors: [],
        reasoning: "Duplicate warning.",
      }),
    );

    const result = await scanWithLlm(warnedInput);

    const exclamationWarnings = result.warnings.filter(
      (w) => w.code === "WARN_EXCESSIVE_EXCLAMATIONS",
    );
    expect(exclamationWarnings).toHaveLength(1);
  });

  it("falls back to regex result with llm_unavailable warning on API error", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await scanWithLlm(CLEAN_INPUT);

    // Status from regex (passed for clean input)
    expect(result.status).toBe("passed");
    expect(result.warnings.some((w) => w.code === "llm_unavailable")).toBe(true);
    expect(result.warnings.find((w) => w.code === "llm_unavailable")?.message).toContain(
      "Network timeout",
    );
  });

  it("returns cached result on second call with same input — LLM called only once", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse({ status: "passed", warnings: [], errors: [], reasoning: "Clean." }),
    );

    const first = await scanWithLlm(CLEAN_INPUT);
    const second = await scanWithLlm({ ...CLEAN_INPUT }); // same content, different object ref

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(first.status).toBe(second.status);
  });

  it("skips LLM and returns regex result when skipLlm option is set", async () => {
    const result = await scanWithLlm(CLEAN_INPUT, { skipLlm: true });

    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(result.status).toBe("passed");
  });

  it("evicts oldest entries when cache exceeds 500 entries (LRU overflow)", async () => {
    // Pre-populate 500 entries directly so this is fast
    for (let i = 0; i < 500; i++) {
      _lruCacheForTests.set(`key-${i}`, {
        status: "passed",
        warnings: [],
        errors: [],
        policyVersion: "test",
      });
    }

    expect(_lruCacheForTests.size).toBe(500);

    // Insert entry 501 via a real scanWithLlm call
    mockMessagesCreate.mockResolvedValueOnce(
      makeApiResponse({ status: "passed", warnings: [], errors: [], reasoning: "Clean." }),
    );

    await scanWithLlm(CLEAN_INPUT);

    // Cache should still be at most 500 entries
    expect(_lruCacheForTests.size).toBeLessThanOrEqual(500);

    // The first entry (key-0) should have been evicted
    expect(_lruCacheForTests.has("key-0")).toBe(false);
  });
});
