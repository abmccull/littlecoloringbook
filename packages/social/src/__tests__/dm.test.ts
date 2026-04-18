import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyMetaWebhookSignature,
  parseIncomingMessengerEvent,
  parseIncomingIgEvent,
  sendFbMessengerText,
  sendIgDirectText,
  DmWindowExpiredError,
} from "../dm";
import { createHmac } from "node:crypto";

// ── helpers ──────────────────────────────────────────────────────────────────

const APP_SECRET = "test_app_secret_1234567890";

function makeSignature(body: string, secret = APP_SECRET): string {
  const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${hex}`;
}

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── Signature Verification ───────────────────────────────────────────────────

describe("verifyMetaWebhookSignature", () => {
  it("returns true for a valid signature", () => {
    const body = '{"object":"page","entry":[]}';
    const sig = makeSignature(body);
    expect(verifyMetaWebhookSignature(body, sig, APP_SECRET)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = '{"object":"page","entry":[]}';
    expect(
      verifyMetaWebhookSignature(body, "sha256=deadbeef", APP_SECRET),
    ).toBe(false);
  });

  it("returns false when signatureHeader is null", () => {
    const body = '{"object":"page","entry":[]}';
    expect(verifyMetaWebhookSignature(body, null, APP_SECRET)).toBe(false);
  });

  it("returns false when header lacks sha256= prefix", () => {
    const body = '{"object":"page","entry":[]}';
    const hex = createHmac("sha256", APP_SECRET).update(body).digest("hex");
    expect(verifyMetaWebhookSignature(body, hex, APP_SECRET)).toBe(false);
  });

  it("returns false when body has been tampered with", () => {
    const body = '{"object":"page","entry":[]}';
    const sig = makeSignature(body);
    const tampered = '{"object":"page","entry":[],"injected":true}';
    expect(verifyMetaWebhookSignature(tampered, sig, APP_SECRET)).toBe(false);
  });
});

// ─── Messenger Event Parsing ──────────────────────────────────────────────────

const MESSENGER_PAYLOAD = {
  object: "page",
  entry: [
    {
      id: "PAGE_ID_1",
      messaging: [
        {
          sender: { id: "PSID_123" },
          recipient: { id: "PAGE_ID_1" },
          timestamp: 1700000000000,
          message: {
            mid: "mid.MSG_001",
            text: "Hello, I need help!",
          },
        },
      ],
    },
  ],
};

describe("parseIncomingMessengerEvent", () => {
  it("parses a realistic Messenger payload correctly", () => {
    const events = parseIncomingMessengerEvent(MESSENGER_PAYLOAD);
    expect(events).toHaveLength(1);
    const [e] = events;
    expect(e!.platform).toBe("fb_messenger");
    expect(e!.platformUserId).toBe("PSID_123");
    expect(e!.metaMessageId).toBe("mid.MSG_001");
    expect(e!.text).toBe("Hello, I need help!");
    expect(e!.pageId).toBe("PAGE_ID_1");
    expect(e!.sentAt).toEqual(new Date(1700000000000));
    expect(e!.attachments).toHaveLength(0);
  });

  it("filters out echo messages (is_echo=true)", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "PAGE_ID_1",
          messaging: [
            {
              sender: { id: "PAGE_ID_1" },
              recipient: { id: "PSID_123" },
              timestamp: 1700000001000,
              message: { mid: "mid.ECHO_001", text: "Echoed reply", is_echo: true },
            },
          ],
        },
      ],
    };
    expect(parseIncomingMessengerEvent(payload)).toHaveLength(0);
  });

  it("filters out delivery receipts", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "PAGE_ID_1",
          messaging: [
            {
              sender: { id: "PSID_123" },
              recipient: { id: "PAGE_ID_1" },
              timestamp: 1700000002000,
              delivery: { mids: ["mid.MSG_001"], watermark: 1700000001000 },
            },
          ],
        },
      ],
    };
    expect(parseIncomingMessengerEvent(payload)).toHaveLength(0);
  });

  it("handles multiple messages in one envelope", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "PAGE_ID_1",
          messaging: [
            {
              sender: { id: "PSID_A" },
              recipient: { id: "PAGE_ID_1" },
              timestamp: 1700000010000,
              message: { mid: "mid.A1", text: "First message" },
            },
            {
              sender: { id: "PSID_B" },
              recipient: { id: "PAGE_ID_1" },
              timestamp: 1700000020000,
              message: { mid: "mid.B1", text: "Second message" },
            },
          ],
        },
      ],
    };
    const events = parseIncomingMessengerEvent(payload);
    expect(events).toHaveLength(2);
    expect(events[0]!.platformUserId).toBe("PSID_A");
    expect(events[1]!.platformUserId).toBe("PSID_B");
  });

  it("returns empty array for non-page object", () => {
    expect(
      parseIncomingMessengerEvent({ object: "instagram", entry: [] }),
    ).toHaveLength(0);
  });

  it("extracts attachment URL when present", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "PAGE_ID_1",
          messaging: [
            {
              sender: { id: "PSID_X" },
              recipient: { id: "PAGE_ID_1" },
              timestamp: 1700000030000,
              message: {
                mid: "mid.ATT_001",
                text: "",
                attachments: [
                  { type: "image", payload: { url: "https://example.com/img.jpg" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseIncomingMessengerEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0]!.attachments).toHaveLength(1);
    expect(events[0]!.attachments[0]!.url).toBe("https://example.com/img.jpg");
    expect(events[0]!.attachments[0]!.type).toBe("image");
  });
});

// ─── IG Direct Event Parsing ──────────────────────────────────────────────────

describe("parseIncomingIgEvent", () => {
  it("parses an IG Direct payload correctly", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "IG_USER_ID",
          messaging: [
            {
              sender: { id: "IGSID_456" },
              recipient: { id: "IG_USER_ID" },
              timestamp: 1700001000000,
              message: { mid: "mid.IG_001", text: "Hey there!" },
            },
          ],
        },
      ],
    };
    const events = parseIncomingIgEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0]!.platform).toBe("ig_direct");
    expect(events[0]!.platformUserId).toBe("IGSID_456");
    expect(events[0]!.metaMessageId).toBe("mid.IG_001");
    expect(events[0]!.pageId).toBe("IG_USER_ID");
  });

  it("returns empty array for non-instagram object", () => {
    expect(parseIncomingIgEvent({ object: "page", entry: [] })).toHaveLength(0);
  });
});

// ─── sendFbMessengerText ──────────────────────────────────────────────────────

const SEND_INPUT = {
  pageAccessToken: "EAA_test_token",
  pageId: "PAGE123",
  recipientPsid: "PSID_999",
  text: "Hello from little color book!",
};

describe("sendFbMessengerText", () => {
  it("sends with messaging_type=RESPONSE and no tag within window", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ message_id: "mid.SENT_001", recipient_id: "PSID_999" }),
    });

    const result = await sendFbMessengerText(SEND_INPUT);
    expect(result.message_id).toBe("mid.SENT_001");
    expect(result.recipient_id).toBe("PSID_999");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.messaging_type).toBe("RESPONSE");
    expect(sentBody.tag).toBeUndefined();
  });

  it("sends with messaging_type=MESSAGE_TAG and tag=HUMAN_AGENT when tag is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ message_id: "mid.HA_001", recipient_id: "PSID_999" }),
    });

    await sendFbMessengerText({ ...SEND_INPUT, tag: "HUMAN_AGENT" });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.messaging_type).toBe("MESSAGE_TAG");
    expect(sentBody.tag).toBe("HUMAN_AGENT");
  });

  it("throws DmWindowExpiredError on code 10 / subcode 2018278", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({
          error: {
            message: "This message is sent outside of allowed window.",
            code: 10,
            error_subcode: 2018278,
            type: "OAuthException",
          },
        }),
    });

    await expect(sendFbMessengerText(SEND_INPUT)).rejects.toBeInstanceOf(
      DmWindowExpiredError,
    );
  });

  it("retries on rate-limit error code 613 and eventually succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: { message: "Rate limit", code: 613, error_subcode: null },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ message_id: "mid.RETRY_001", recipient_id: "PSID_999" }),
      });

    vi.useFakeTimers();
    const promise = sendFbMessengerText(SEND_INPUT);
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result.message_id).toBe("mid.RETRY_001");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 429 and eventually succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "Too many requests", code: 429 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ message_id: "mid.RETRY_429", recipient_id: "PSID_999" }),
      });

    vi.useFakeTimers();
    const promise = sendFbMessengerText(SEND_INPUT);
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result.message_id).toBe("mid.RETRY_429");
  });
});

// ─── sendIgDirectText (stub) ──────────────────────────────────────────────────

describe("sendIgDirectText", () => {
  it("throws an error explaining scope is missing", async () => {
    await expect(
      sendIgDirectText({
        igUserId: "IG123",
        accessToken: "token",
        recipientIgsid: "IGSID_ABC",
        text: "hello",
      }),
    ).rejects.toThrow(/instagram_manage_messages/);
  });
});
