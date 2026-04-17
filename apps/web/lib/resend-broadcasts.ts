import "server-only";

const RESEND_API_BASE = "https://api.resend.com";

function getApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return key;
}

export type CreateBroadcastInput = {
  audienceId: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /**
   * Optional schedule time. Omit to create as draft, then call
   * scheduleBroadcast to send later. Resend accepts ISO-8601 UTC
   * ("2026-04-20T18:00:00Z") or relative like "in 1 hour".
   */
  scheduledAt?: string;
  name?: string;
};

export type ResendBroadcast = {
  id: string;
  status: "draft" | "scheduled" | "sent" | "failed";
  created_at: string;
  scheduled_at?: string | null;
};

async function resendFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? (body as { message?: string }).message
        : response.statusText;
    throw new Error(`Resend ${response.status}: ${message ?? "unknown"}`);
  }

  return body as Record<string, unknown> | null;
}

export async function createBroadcast(input: CreateBroadcastInput): Promise<ResendBroadcast> {
  const result = (await resendFetch("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      audience_id: input.audienceId,
      from: input.from,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
      name: input.name,
      scheduled_at: input.scheduledAt,
    }),
  })) as ResendBroadcast | null;

  if (!result?.id) {
    throw new Error("Resend createBroadcast returned no id");
  }
  return result;
}

export async function scheduleBroadcast(input: { broadcastId: string; scheduledAt: string }): Promise<ResendBroadcast> {
  const result = (await resendFetch(`/broadcasts/${input.broadcastId}`, {
    method: "PATCH",
    body: JSON.stringify({ scheduled_at: input.scheduledAt }),
  })) as ResendBroadcast | null;

  if (!result?.id) {
    throw new Error("Resend scheduleBroadcast returned no id");
  }
  return result;
}

export async function sendBroadcastNow(broadcastId: string): Promise<ResendBroadcast> {
  const result = (await resendFetch(`/broadcasts/${broadcastId}/send`, {
    method: "POST",
  })) as ResendBroadcast | null;

  if (!result?.id) {
    throw new Error("Resend sendBroadcastNow returned no id");
  }
  return result;
}

export async function cancelBroadcast(broadcastId: string): Promise<ResendBroadcast> {
  const result = (await resendFetch(`/broadcasts/${broadcastId}/cancel`, {
    method: "POST",
  })) as ResendBroadcast | null;

  if (!result?.id) {
    throw new Error("Resend cancelBroadcast returned no id");
  }
  return result;
}
