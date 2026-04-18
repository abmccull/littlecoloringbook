import "server-only";

import { PostHog } from "posthog-node";

let cachedClient: PostHog | null = null;

function getKey() {
  return process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null;
}

function getHost() {
  return (
    process.env.POSTHOG_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    "https://us.i.posthog.com"
  );
}

function getClient(): PostHog | null {
  const key = getKey();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new PostHog(key, {
    host: getHost(),
    flushAt: 1,
    flushInterval: 0,
  });
  return cachedClient;
}

export type ServerEventInput = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
};

/**
 * Fire-and-forget server event. Posts to PostHog if configured; no-op
 * otherwise. Never throws — analytics must not break user flows.
 */
export async function captureServerEvent(input: ServerEventInput): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
    });
    await client.flush();
  } catch (error) {
    console.error("[posthog-server] capture failed", error);
  }
}

export async function identifyServer(input: {
  distinctId: string;
  email?: string | null;
  firstName?: string | null;
  properties?: Record<string, unknown>;
}) {
  const client = getClient();
  if (!client) return;
  try {
    client.identify({
      distinctId: input.distinctId,
      properties: {
        email: input.email ?? undefined,
        first_name: input.firstName ?? undefined,
        ...(input.properties ?? {}),
      },
    });
    await client.flush();
  } catch (error) {
    console.error("[posthog-server] identify failed", error);
  }
}
