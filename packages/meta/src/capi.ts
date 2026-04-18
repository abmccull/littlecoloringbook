import { getMetaEnv } from "@littlecolorbook/shared/env";
import { CapiSendError } from "./client";
import type { CapiEventInput, CapiSendResult } from "./types";

type CApiResponseBody = {
  events_received?: number;
  fbtrace_id?: string;
  messages?: string[];
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
};

export async function sendCapiEvent(event: CapiEventInput): Promise<CapiSendResult> {
  const env = getMetaEnv();

  if (!env.systemUserToken) {
    throw new CapiSendError(0, null, "META_SYSTEM_USER_TOKEN is not configured.");
  }

  const datasetId = env.datasetId;
  if (!datasetId) {
    throw new CapiSendError(0, null, "META_DATASET_ID (or META_PIXEL_ID) is not configured.");
  }

  const url = `https://graph.facebook.com/${env.graphApiVersion}/${datasetId}/events`;

  const body: Record<string, unknown> = {
    data: [event],
    access_token: env.systemUserToken,
  };

  if (env.testEventCode) {
    body.test_event_code = env.testEventCode;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();

  let parsed: CApiResponseBody;
  try {
    parsed = JSON.parse(rawText) as CApiResponseBody;
  } catch {
    throw new CapiSendError(
      response.status,
      null,
      `CAPI returned non-JSON ${response.status}: ${rawText.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    const code = parsed.error?.code ?? response.status;
    const subcode = parsed.error?.error_subcode ?? null;
    const message = parsed.error?.message ?? `CAPI HTTP ${response.status}`;
    throw new CapiSendError(code, subcode, message);
  }

  return {
    events_received: parsed.events_received ?? 0,
    fbtrace_id: parsed.fbtrace_id ?? "",
    messages: parsed.messages,
  };
}
