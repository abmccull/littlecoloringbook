import "server-only";

import { getDatabase, isDatabaseConfigured } from "@littlecolorbook/db";
import { customers } from "@littlecolorbook/db";
import { eq } from "drizzle-orm";

const RESEND_API_BASE = "https://api.resend.com";

export function isResendAudiencesConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_MARKETING_AUDIENCE_ID);
}

function getAudienceId() {
  const id = process.env.RESEND_MARKETING_AUDIENCE_ID;
  if (!id) throw new Error("RESEND_MARKETING_AUDIENCE_ID is not set");
  return id;
}

function getApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return key;
}

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
    throw new Error(`Resend ${response.status}: ${message ?? "unknown error"}`);
  }

  return body as Record<string, unknown> | null;
}

type ResendContact = {
  id: string;
  email: string;
  first_name?: string | null;
  unsubscribed?: boolean;
};

/**
 * Upsert a contact into our primary marketing audience. Matches the
 * customer's current marketing_opt_in state — if false, marks the
 * contact as unsubscribed; if true, ensures they're subscribed.
 */
export async function syncCustomerToAudience(input: {
  customerId: string;
  email: string;
  firstName?: string | null;
  marketingOptIn: boolean;
}) {
  if (!isResendAudiencesConfigured()) {
    return { ok: false as const, reason: "not_configured" };
  }

  const audienceId = getAudienceId();
  const email = input.email.trim().toLowerCase();

  try {
    // Create is idempotent-ish — if the contact exists Resend returns 409,
    // which we handle by falling through to a PATCH update.
    const created = await resendFetch(`/audiences/${audienceId}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: input.firstName ?? undefined,
        unsubscribed: !input.marketingOptIn,
      }),
    });

    const contactId = (created as { id?: string } | null)?.id ?? null;

    if (contactId && isDatabaseConfigured()) {
      const db = getDatabase();
      await db
        .update(customers)
        .set({
          resendContactId: contactId,
          marketingSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, input.customerId));
    }

    return { ok: true as const, contactId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    // Already-exists: update instead of create.
    if (/already exists|409/i.test(message)) {
      try {
        const patched = (await resendFetch(`/audiences/${audienceId}/contacts/${email}`, {
          method: "PATCH",
          body: JSON.stringify({
            first_name: input.firstName ?? undefined,
            unsubscribed: !input.marketingOptIn,
          }),
        })) as ResendContact | null;

        if (patched?.id && isDatabaseConfigured()) {
          const db = getDatabase();
          await db
            .update(customers)
            .set({
              resendContactId: patched.id,
              marketingSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(customers.id, input.customerId));
        }

        return { ok: true as const, contactId: patched?.id ?? null };
      } catch (patchError) {
        console.error("syncCustomerToAudience: PATCH fallback failed", patchError);
        return { ok: false as const, reason: "patch_failed" };
      }
    }

    console.error("syncCustomerToAudience failed", error);
    return { ok: false as const, reason: message };
  }
}

/**
 * Remove the contact entirely (hard unsub). Prefer syncCustomerToAudience
 * with marketingOptIn=false for soft unsubs — leaves the record for
 * re-opt-in. Use this only when a customer requests GDPR-style deletion.
 */
export async function removeContactFromAudience(email: string) {
  if (!isResendAudiencesConfigured()) return { ok: false as const, reason: "not_configured" };

  const audienceId = getAudienceId();
  try {
    await resendFetch(`/audiences/${audienceId}/contacts/${email.trim().toLowerCase()}`, {
      method: "DELETE",
    });
    return { ok: true as const };
  } catch (error) {
    console.error("removeContactFromAudience failed", error);
    return { ok: false as const, reason: error instanceof Error ? error.message : "unknown" };
  }
}
