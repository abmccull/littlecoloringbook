import { createHmac, timingSafeEqual } from "node:crypto";
import { DmWindowExpiredError } from "./types";
import type { SendDmResult, IncomingDmEvent, IncomingDmAttachment } from "./types";

export { DmWindowExpiredError };
export type { SendDmResult, IncomingDmEvent, IncomingDmAttachment };

const GRAPH_API_BASE = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v22.0";

// Error codes that mean the 24-hour window has expired.
const WINDOW_EXPIRED_CODE = 10;
const WINDOW_EXPIRED_SUBCODE = 2018278;

// Codes that indicate a rate limit worth retrying.
const RATE_LIMIT_CODES = new Set([613, 17]);
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GraphErrorEnvelope = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

// ─── Send FB Messenger Text ───────────────────────────────────────────────────

export type SendFbMessengerTextInput = {
  pageAccessToken: string;
  /** The FB Page ID (used to build the endpoint). */
  pageId: string;
  /** The recipient's PSID. */
  recipientPsid: string;
  text: string;
  /**
   * Optional tag. Pass 'HUMAN_AGENT' when replying outside the 24-hour window
   * where a verified human agent is responding to a prior customer message.
   * This is the only compliant tag remaining after April 27, 2026.
   */
  tag?: "HUMAN_AGENT";
  apiVersion?: string;
};

/**
 * Sends a text message via the Messenger Send API.
 *
 * Messaging type is determined automatically:
 *  - Within the 24-hour window (no tag): RESPONSE
 *  - With HUMAN_AGENT tag: MESSAGE_TAG (for human-agent replies outside window)
 *
 * Throws DmWindowExpiredError when Meta signals the window has expired
 * (Graph error code 10, subcode 2018278). This lets callers decide whether
 * to prompt for a HUMAN_AGENT tag or surface a "cannot reply" message.
 *
 * Rate-limit errors (code 613 / 17 / HTTP 429) are automatically retried
 * with exponential backoff up to MAX_RETRIES times.
 */
export async function sendFbMessengerText(
  input: SendFbMessengerTextInput,
): Promise<SendDmResult> {
  const version = input.apiVersion ?? DEFAULT_API_VERSION;
  const url = `${GRAPH_API_BASE}/${version}/${input.pageId}/messages`;

  const body: Record<string, unknown> = {
    recipient: { id: input.recipientPsid },
    message: { text: input.text },
  };

  if (input.tag) {
    body.messaging_type = "MESSAGE_TAG";
    body.tag = input.tag;
  } else {
    body.messaging_type = "RESPONSE";
  }

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const response = await fetch(`${url}?access_token=${input.pageAccessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Non-JSON response from Messenger Send API: ${rawText.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      const errBody = parsed as GraphErrorEnvelope;
      const code = errBody?.error?.code ?? response.status;
      const subcode = errBody?.error?.error_subcode ?? null;
      const message =
        errBody?.error?.message ?? `Messenger Send API HTTP ${response.status}`;

      // 24-hour window expiry — not retryable.
      if (code === WINDOW_EXPIRED_CODE && subcode === WINDOW_EXPIRED_SUBCODE) {
        throw new DmWindowExpiredError(input.recipientPsid, message);
      }

      const isRateLimit = response.status === 429 || RATE_LIMIT_CODES.has(code);
      if (isRateLimit && attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS[attempt] ?? 4000);
        attempt++;
        continue;
      }

      throw new Error(`Messenger Send API error [${code}/${subcode ?? "—"}]: ${message}`);
    }

    const result = parsed as { message_id?: string; recipient_id?: string };
    return {
      message_id: result.message_id ?? "",
      recipient_id: result.recipient_id ?? input.recipientPsid,
    };
  }

  throw new Error("Messenger Send API: max retry attempts exceeded");
}

// ─── Send IG Direct Text (STUB) ───────────────────────────────────────────────

export type SendIgDirectTextInput = {
  igUserId: string;
  accessToken: string;
  recipientIgsid: string;
  text: string;
};

/**
 * STUB — Instagram Direct send is not yet available.
 *
 * IG DM send requires the `instagram_manage_messages` scope (and optionally
 * `instagram_content_publish`). The current system token does not have these
 * scopes. Once the token is updated, implement:
 *
 *   POST /{ig-user-id}/messages
 *   {
 *     "recipient": { "id": "<IGSID>" },
 *     "message": { "text": "<text>" }
 *   }
 *   Authorization: Bearer <access_token>
 *
 * Reference: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 *
 * TODO: Enable once instagram_manage_messages scope is added to the system user token.
 */
export async function sendIgDirectText(
  _input: SendIgDirectTextInput,
): Promise<SendDmResult> {
  throw new Error(
    "IG DM send requires instagram_manage_messages scope — not yet configured. " +
      "Update the Meta system user token and implement this function.",
  );
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

/**
 * Verifies the X-Hub-Signature-256 header sent by Meta on webhook deliveries.
 *
 * The header format is: "sha256=<hex-digest>"
 * The HMAC key is your app secret (META_WEBHOOK_APP_SECRET).
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @returns true if the signature is valid, false otherwise.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;

  const receivedHex = signatureHeader.slice(prefix.length);
  if (!receivedHex) return false;

  const expectedHex = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Both buffers must be the same length for timingSafeEqual.
  // Pad the received buffer to match — mismatched length leaks length info
  // but the comparison itself is still safe.
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(receivedHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Messenger Event Parsing ──────────────────────────────────────────────────

type RawMessengerEntry = {
  id?: string;
  messaging?: RawMessagingItem[];
};

type RawMessagingItem = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: Array<{ type?: string; payload?: { url?: string; sticker_id?: number } }>;
    is_echo?: boolean;
  };
  delivery?: unknown;
  read?: unknown;
  postback?: unknown;
};

type RawWebhookBody = {
  object?: string;
  entry?: RawMessengerEntry[];
};

/**
 * Parses a raw Facebook Messenger webhook POST body and returns a flat list
 * of incoming message events.
 *
 * Filtered out:
 *   - Echo messages (sent by the page itself)
 *   - Delivery receipts
 *   - Read receipts
 *   - Postbacks (not DM text)
 *   - Items with no message.mid
 */
export function parseIncomingMessengerEvent(
  body: unknown,
): Array<IncomingDmEvent> {
  const wb = body as RawWebhookBody;
  if (!wb || wb.object !== "page" || !Array.isArray(wb.entry)) {
    return [];
  }

  const events: IncomingDmEvent[] = [];

  for (const entry of wb.entry) {
    if (!Array.isArray(entry.messaging)) continue;

    const pageId = entry.id ?? "";

    for (const item of entry.messaging) {
      // Skip non-message events
      if (!item.message) continue;
      // Skip echoes (messages sent by the page)
      if (item.message.is_echo) continue;
      // Skip delivery and read receipts
      if (item.delivery || item.read) continue;

      const mid = item.message.mid;
      if (!mid) continue;

      const senderPsid = item.sender?.id ?? "";
      const timestamp = item.timestamp ?? Date.now();
      const text = item.message.text ?? "";

      const attachments: IncomingDmAttachment[] = (
        item.message.attachments ?? []
      )
        .filter((a) => Boolean(a?.payload?.url))
        .map((a) => ({
          type: a.type ?? "unknown",
          url: a.payload?.url ?? "",
        }));

      events.push({
        platform: "fb_messenger",
        platformUserId: senderPsid,
        metaMessageId: mid,
        text,
        attachments,
        sentAt: new Date(timestamp),
        pageId,
      });
    }
  }

  return events;
}

// ─── Instagram Direct Event Parsing ──────────────────────────────────────────

type RawIgEntry = {
  id?: string;
  messaging?: RawIgMessagingItem[];
};

type RawIgMessagingItem = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
    is_echo?: boolean;
  };
  delivery?: unknown;
  read?: unknown;
};

type RawIgWebhookBody = {
  object?: string;
  entry?: RawIgEntry[];
};

/**
 * Parses a raw Instagram Direct webhook POST body (object: 'instagram').
 *
 * IG Direct uses the same messaging envelope shape as Messenger.
 * Filtered out: echoes, delivery receipts, read receipts, items with no mid.
 */
export function parseIncomingIgEvent(body: unknown): Array<IncomingDmEvent> {
  const wb = body as RawIgWebhookBody;
  if (!wb || wb.object !== "instagram" || !Array.isArray(wb.entry)) {
    return [];
  }

  const events: IncomingDmEvent[] = [];

  for (const entry of wb.entry) {
    if (!Array.isArray(entry.messaging)) continue;

    const igUserId = entry.id ?? "";

    for (const item of entry.messaging) {
      if (!item.message) continue;
      if (item.message.is_echo) continue;
      if (item.delivery || item.read) continue;

      const mid = item.message.mid;
      if (!mid) continue;

      const senderIgsid = item.sender?.id ?? "";
      const timestamp = item.timestamp ?? Date.now();
      const text = item.message.text ?? "";

      const attachments: IncomingDmAttachment[] = (
        item.message.attachments ?? []
      )
        .filter((a) => Boolean(a?.payload?.url))
        .map((a) => ({
          type: a.type ?? "unknown",
          url: a.payload?.url ?? "",
        }));

      events.push({
        platform: "ig_direct",
        platformUserId: senderIgsid,
        metaMessageId: mid,
        text,
        attachments,
        sentAt: new Date(timestamp),
        pageId: igUserId,
      });
    }
  }

  return events;
}
