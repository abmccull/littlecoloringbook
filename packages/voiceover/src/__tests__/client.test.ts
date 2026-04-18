import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ElevenLabsClient } from "../client";
import { VoiceoverError } from "../types";
import type { Voice } from "../types";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeAudioResponse(data: Uint8Array, status = 200): Response {
  return new Response(data as BodyInit, {
    status,
    headers: { "Content-Type": "audio/mpeg" },
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_OPTS = {
  apiKey: "test-xi-key",
  baseUrl: "https://api.elevenlabs.io",
  defaultModelId: "eleven_multilingual_v2",
  // Zero retry delay so retry tests complete instantly
  defaultRetryAfterMs: 0,
};

const VOICE_FIXTURES: Voice[] = [
  {
    voice_id: "voice-warm-female",
    name: "Rachel",
    labels: { gender: "female", age: "young", use_case: "conversational", description: "warm", accent: "american" },
  },
  {
    voice_id: "voice-upbeat-female",
    name: "Sarah",
    labels: { gender: "female", age: "young", use_case: "social media", description: "energetic", accent: "american" },
  },
  {
    voice_id: "voice-calm-female",
    name: "Dorothy",
    labels: { gender: "female", age: "middle aged", use_case: "narration", description: "calm", accent: "british" },
  },
  {
    voice_id: "voice-friendly-female",
    name: "Amy",
    labels: { gender: "female", age: "young", use_case: "conversational", description: "friendly", accent: "american" },
  },
  {
    voice_id: "voice-male",
    name: "Josh",
    labels: { gender: "male", age: "young", use_case: "narration", description: "deep", accent: "american" },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ElevenLabsClient", () => {
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
  // listVoices()
  // -------------------------------------------------------------------------

  describe("listVoices()", () => {
    it("GETs /v1/voices with xi-api-key header and returns parsed voices", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ voices: VOICE_FIXTURES }));

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voices = await client.listVoices();

      expect(voices).toHaveLength(VOICE_FIXTURES.length);
      expect(voices[0].voice_id).toBe("voice-warm-female");
      expect(voices[0].name).toBe("Rachel");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.elevenlabs.io/v1/voices");
      expect(init.method).toBe("GET");
      expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-xi-key");
    });

    it("throws VoiceoverError for invalid response shape", async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ notVoices: [] }));

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      await expect(client.listVoices()).rejects.toThrow(VoiceoverError);
    });
  });

  // -------------------------------------------------------------------------
  // synthesize()
  // -------------------------------------------------------------------------

  describe("synthesize()", () => {
    it("POSTs to /v1/text-to-speech/{voice_id} with voice_id in URL and text+model in body", async () => {
      const audioData = new Uint8Array([0xff, 0xfb, 0x90]);
      fetchMock.mockResolvedValueOnce(makeAudioResponse(audioData));

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const result = await client.synthesize({
        voiceId: "voice-warm-female",
        text: "Hello, little coloring book fans!",
        modelId: "eleven_multilingual_v2",
      });

      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.audioBuffer).toEqual(Buffer.from(audioData));
      expect(result.contentType).toContain("audio");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/v1\/text-to-speech\/voice-warm-female/);
      expect(url).toContain("output_format=mp3_44100_128");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-xi-key");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.text).toBe("Hello, little coloring book fans!");
      expect(body.model_id).toBe("eleven_multilingual_v2");
    });

    it("includes voice_settings in the POST body when provided", async () => {
      fetchMock.mockResolvedValueOnce(makeAudioResponse(new Uint8Array([1])));

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      await client.synthesize({
        voiceId: "voice-calm-female",
        text: "Serene narration.",
        voiceSettings: { stability: 0.7, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
      });

      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;

      expect(body.voice_settings).toEqual({
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true,
      });
    });

    it("uses defaultModelId when modelId is not specified in request", async () => {
      fetchMock.mockResolvedValueOnce(makeAudioResponse(new Uint8Array([1])));

      const client = new ElevenLabsClient({ ...DEFAULT_OPTS, defaultModelId: "eleven_turbo_v2" });
      await client.synthesize({ voiceId: "voice-1", text: "hi" });

      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;

      expect(body.model_id).toBe("eleven_turbo_v2");
    });

    it("returns audioBuffer as Buffer and contentType from response header", async () => {
      const audioData = new Uint8Array([10, 20, 30, 40]);
      fetchMock.mockResolvedValueOnce(makeAudioResponse(audioData));

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const { audioBuffer, contentType } = await client.synthesize({
        voiceId: "voice-1",
        text: "test audio",
      });

      expect(audioBuffer).toEqual(Buffer.from(audioData));
      expect(contentType).toBe("audio/mpeg");
    });
  });

  // -------------------------------------------------------------------------
  // resolveVoiceForFamily()
  // -------------------------------------------------------------------------

  describe("resolveVoiceForFamily()", () => {
    it("picks a warm conversational female voice", () => {
      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voice = client.resolveVoiceForFamily("warm_conversational_female", VOICE_FIXTURES);

      expect(voice).not.toBeNull();
      expect(voice!.labels?.gender).toBe("female");
      // Rachel has gender=female + conversational + warm — highest match
      expect(voice!.voice_id).toBe("voice-warm-female");
    });

    it("picks an upbeat female voice", () => {
      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voice = client.resolveVoiceForFamily("upbeat_female", VOICE_FIXTURES);

      expect(voice).not.toBeNull();
      expect(voice!.labels?.gender).toBe("female");
      expect(voice!.voice_id).toBe("voice-upbeat-female");
    });

    it("picks a calm premium female voice", () => {
      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voice = client.resolveVoiceForFamily("calm_premium_female", VOICE_FIXTURES);

      expect(voice).not.toBeNull();
      expect(voice!.labels?.gender).toBe("female");
      expect(voice!.voice_id).toBe("voice-calm-female");
    });

    it("picks a friendly gift guide voice", () => {
      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voice = client.resolveVoiceForFamily("friendly_gift_guide", VOICE_FIXTURES);

      expect(voice).not.toBeNull();
      expect(voice!.labels?.gender).toBe("female");
      // Amy has gender=female + conversational + friendly — highest match
      expect(voice!.voice_id).toBe("voice-friendly-female");
    });

    it("returns null when no voices match (empty list)", () => {
      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voice = client.resolveVoiceForFamily("warm_conversational_female", []);

      expect(voice).toBeNull();
    });

    it("returns null when only male voices are present for female-only families", () => {
      const maleVoices: Voice[] = [
        {
          voice_id: "voice-male-deep",
          name: "Adam",
          labels: { gender: "male", age: "young", use_case: "narration", description: "deep" },
        },
      ];

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voice = client.resolveVoiceForFamily("warm_conversational_female", maleVoices);

      expect(voice).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 429 retry with Retry-After
  // -------------------------------------------------------------------------

  describe("429 retry behaviour", () => {
    it("retries listVoices() after Retry-After delay on 429 and succeeds", async () => {
      // First call: 429 with Retry-After: 0 (so test doesn't actually sleep)
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "rate limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "0" },
        }),
      );
      // Second call: success
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ voices: VOICE_FIXTURES }));

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const voices = await client.listVoices();

      expect(voices).toHaveLength(VOICE_FIXTURES.length);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws VoiceoverError after exhausting all 3 attempts on repeated 429", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ detail: "still rate limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "0" },
        }),
      );

      const client = new ElevenLabsClient(DEFAULT_OPTS);
      const err = await client.listVoices().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(VoiceoverError);
      expect((err as VoiceoverError).statusCode).toBe(429);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
