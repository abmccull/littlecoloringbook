/**
 * auto-tagger.test.ts
 *
 * Phase 7b — Unit tests for the visual semantic auto-tagger.
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

// Mock the shared env so we control the API key and model (no .js extension — matches package exports)
vi.mock("@littlecolorbook/shared/env", () => ({
  getAnthropicEnv: vi.fn(() => ({
    apiKey: "test-api-key",
    model: "claude-haiku-4-5-20251001",
    visionModel: "claude-sonnet-4-5-20251022",
    llmComplianceTimeoutMs: 15_000,
  })),
}));

// Mock the storage module so we don't need real GCS credentials
vi.mock("@littlecolorbook/shared/storage", () => ({
  downloadObject: vi.fn(),
  downloadObjectStream: vi.fn(),
  uploadObject: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import {
  autoTagCreativeAsset,
  autoTagAndPersist,
  makeAutoTaggerSystemPrompt,
  _tagCacheForTests,
  _resetAutoTaggerClientForTests,
} from "../auto-tagger";
import { downloadObject } from "@littlecolorbook/shared/storage";
import { TAGGER_VERSION } from "../semantic-tags";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeApiResponse(jsonPayload: object) {
  return {
    content: [{ type: "text", text: JSON.stringify(jsonPayload) }],
    usage: { input_tokens: 1200, output_tokens: 300 },
  };
}

function makePngBuffer(): Buffer {
  // 4-byte fake PNG so SHA-256 is deterministic in tests
  return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
}

const VALID_TAG_PAYLOAD = {
  scene_type: "outdoor",
  setting: "park",
  subject_types: ["pet_dog"],
  subject_count: 1,
  props: ["none"],
  emotion: "joyful",
  pose: "candid",
  style: {
    line_weight: "medium",
    detail_level: "simple",
    background: "suggested",
    subject_framing: "medium",
  },
  complexity_score: 2,
  child_recognition_risk: "low",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("makeAutoTaggerSystemPrompt", () => {
  it("contains the brand name", () => {
    const prompt = makeAutoTaggerSystemPrompt();
    expect(prompt).toContain("little color book");
  });

  it("includes every expected tag field", () => {
    const prompt = makeAutoTaggerSystemPrompt();
    expect(prompt).toContain("scene_type");
    expect(prompt).toContain("subject_types");
    expect(prompt).toContain("child_recognition_risk");
    expect(prompt).toContain("complexity_score");
  });

  it("does NOT ask the model to include tagger_model or tagger_version", () => {
    const prompt = makeAutoTaggerSystemPrompt();
    expect(prompt).toContain("Do NOT include");
    expect(prompt).toContain("tagger_model");
  });
});

describe("autoTagCreativeAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAutoTaggerClientForTests();
  });

  it("makes a vision call with an image content block and system prompt with cache_control", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeApiResponse(VALID_TAG_PAYLOAD));

    const buffer = makePngBuffer();
    await autoTagCreativeAsset({ imageBuffer: buffer, mimeType: "image/png" });

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const call = mockMessagesCreate.mock.calls[0][0];

    // System prompt should have cache_control
    expect(call.system[0].cache_control).toEqual({ type: "ephemeral" });

    // User message should have an image block
    const imageBlock = call.messages[0].content[0];
    expect(imageBlock.type).toBe("image");
    expect(imageBlock.source.type).toBe("base64");
    expect(imageBlock.source.media_type).toBe("image/png");

    // Model should be the vision model
    expect(call.model).toBe("claude-sonnet-4-5-20251022");
  });

  it("parses a realistic structured response and returns SemanticTags", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeApiResponse(VALID_TAG_PAYLOAD));

    const result = await autoTagCreativeAsset({
      imageBuffer: makePngBuffer(),
      mimeType: "image/png",
    });

    expect(result.scene_type).toBe("outdoor");
    expect(result.setting).toBe("park");
    expect(result.subject_types).toEqual(["pet_dog"]);
    expect(result.emotion).toBe("joyful");
    expect(result.complexity_score).toBe(2);
    expect(result.tagger_version).toBe(TAGGER_VERSION);
    // tagger_model should be injected by the caller
    expect(result.tagger_model).toBe("claude-sonnet-4-5-20251022");
  });

  it("recovers from JSON wrapped in markdown fences", async () => {
    const raw = "```json\n" + JSON.stringify(VALID_TAG_PAYLOAD) + "\n```";
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: raw }],
    });

    const result = await autoTagCreativeAsset({
      imageBuffer: makePngBuffer(),
      mimeType: "image/png",
    });

    expect(result.scene_type).toBe("outdoor");
  });

  it("recovers from malformed JSON with a leading sentence", async () => {
    const raw = "Here are the tags: " + JSON.stringify(VALID_TAG_PAYLOAD);
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: raw }],
    });

    const result = await autoTagCreativeAsset({
      imageBuffer: makePngBuffer(),
      mimeType: "image/png",
    });

    expect(result.scene_type).toBe("outdoor");
  });

  it("returns safe default tags when API throws", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("Anthropic 500"));

    const result = await autoTagCreativeAsset({
      imageBuffer: makePngBuffer(),
      mimeType: "image/png",
    });

    expect(result.scene_type).toBe("unknown");
    expect(result.tagger_version).toBe(TAGGER_VERSION);
    // Never throws — safe defaults always returned
  });

  it("returns safe default tags when response is completely unparseable JSON", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "this is not json at all" }],
    });

    const result = await autoTagCreativeAsset({
      imageBuffer: makePngBuffer(),
      mimeType: "image/png",
    });

    expect(result.scene_type).toBe("unknown");
    expect(result.subject_types).toEqual([]);
  });

  it("returns safe default tags when ANTHROPIC_API_KEY is absent", async () => {
    // Override env to return null api key for ALL calls in this test
    const { getAnthropicEnv } = await import("@littlecolorbook/shared/env");
    vi.mocked(getAnthropicEnv).mockReturnValue({
      apiKey: null,
      model: "claude-haiku-4-5-20251001",
      visionModel: "claude-sonnet-4-5-20251022",
      llmComplianceTimeoutMs: 15_000,
    });
    // Force client reset so it re-checks apiKey
    _resetAutoTaggerClientForTests();

    const result = await autoTagCreativeAsset({
      // Use a unique buffer so there's no cache hit from previous tests
      imageBuffer: Buffer.from([0xDE, 0xAD, 0xBE, 0xEF, 0x00]),
      mimeType: "image/png",
    });

    // Restore default mock so subsequent tests aren't affected
    vi.mocked(getAnthropicEnv).mockReturnValue({
      apiKey: "test-api-key",
      model: "claude-haiku-4-5-20251001",
      visionModel: "claude-sonnet-4-5-20251022",
      llmComplianceTimeoutMs: 15_000,
    });

    expect(result.scene_type).toBe("unknown");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns cached tags on second call with same buffer (cache hit)", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeApiResponse(VALID_TAG_PAYLOAD));

    const buffer = makePngBuffer();

    const first = await autoTagCreativeAsset({ imageBuffer: buffer, mimeType: "image/png" });
    const second = await autoTagCreativeAsset({ imageBuffer: buffer, mimeType: "image/png" });

    // Only one API call even though we called twice
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("makes a new API call for different buffer (cache miss)", async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(VALID_TAG_PAYLOAD));

    const buf1 = Buffer.from([0x01, 0x02]);
    const buf2 = Buffer.from([0x03, 0x04]);

    await autoTagCreativeAsset({ imageBuffer: buf1, mimeType: "image/png" });
    await autoTagCreativeAsset({ imageBuffer: buf2, mimeType: "image/png" });

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  });

  it("passes hint tags in the user text message", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeApiResponse(VALID_TAG_PAYLOAD));

    await autoTagCreativeAsset({
      imageBuffer: makePngBuffer(),
      mimeType: "image/png",
      hintTags: { audience_tag: "pets" },
    });

    const call = mockMessagesCreate.mock.calls[0][0];
    const textBlock = call.messages[0].content[1];
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toContain("pets");
  });
});

describe("autoTagAndPersist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAutoTaggerClientForTests();
  });

  it("downloads GCS object, tags it, and persists result", async () => {
    const fakeBuffer = makePngBuffer();
    vi.mocked(downloadObject).mockResolvedValueOnce(fakeBuffer as Buffer);
    mockMessagesCreate.mockResolvedValueOnce(makeApiResponse(VALID_TAG_PAYLOAD));

    const updateFn = vi.fn().mockResolvedValue({ id: "asset-1" });
    const db = { updateCreativeAssetSemanticTags: updateFn };

    const result = await autoTagAndPersist({
      asset: {
        id: "asset-1",
        gcsBucket: "littlecolorbook-exports",
        gcsObject: "creative-library/hero/asset-1.png",
        mimeType: "image/png",
      },
      db,
    });

    expect(downloadObject).toHaveBeenCalledWith({
      bucket: "exports",
      objectPath: "creative-library/hero/asset-1.png",
    });

    expect(updateFn).toHaveBeenCalledOnce();
    const updateArg = updateFn.mock.calls[0][0];
    expect(updateArg.id).toBe("asset-1");
    expect(updateArg.taggedAt).toBeInstanceOf(Date);
    expect(updateArg.semanticTags.scene_type).toBe("outdoor");

    expect(result.assetId).toBe("asset-1");
    expect(result.tags.scene_type).toBe("outdoor");
  });
});
