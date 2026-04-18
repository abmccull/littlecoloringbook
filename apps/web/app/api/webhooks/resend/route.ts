import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  customers,
  getDatabase,
  isDatabaseConfigured,
  stopAllMarketingSequencesForCustomer,
  updateEmailSendStatusByProviderId,
  updateMarketingConsent,
} from "@littlecolorbook/db";
import { removeContactFromAudience } from "../../../../lib/resend-audiences";

export const dynamic = "force-dynamic";

type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked";

type ResendEvent = {
  type: ResendEventType;
  data?: {
    to?: string | string[];
    email_id?: string;
    from?: string;
  };
};

function getWebhookSecret() {
  return process.env.RESEND_WEBHOOK_SECRET ?? null;
}

function verifySignature(request: NextRequest, raw: string) {
  const secret = getWebhookSecret();
  if (!secret) return { ok: false as const, reason: "no_secret" };

  // Resend uses Svix headers for webhook signing.
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false as const, reason: "missing_headers" };
  }

  const signedPayload = `${svixId}.${svixTimestamp}.${raw}`;
  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const expected = createHmac("sha256", Buffer.from(key, "base64")).update(signedPayload).digest("base64");

  // svix-signature is a comma-separated list of `v1,<sig>`. Match any.
  const candidates = svixSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((v): v is string => Boolean(v));

  for (const candidate of candidates) {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true as const };
    }
  }
  return { ok: false as const, reason: "signature_mismatch" };
}

async function findCustomerByEmail(email: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const row = await db.query.customers.findFirst({
    where: eq(customers.email, email.trim().toLowerCase()),
  });
  return row ?? null;
}

async function handleEvent(event: ResendEvent) {
  const to = Array.isArray(event.data?.to) ? event.data!.to![0] : event.data?.to;
  const emailId = event.data?.email_id ?? null;

  // Per-event email_sends status updates via provider message id.
  if (emailId) {
    try {
      switch (event.type) {
        case "email.sent":
          await updateEmailSendStatusByProviderId({ providerMessageId: emailId, status: "sent" });
          break;
        case "email.bounced":
          await updateEmailSendStatusByProviderId({
            providerMessageId: emailId,
            status: "bounced",
            error: "recipient_bounced",
          });
          break;
        case "email.complained":
          await updateEmailSendStatusByProviderId({
            providerMessageId: emailId,
            status: "complained",
            error: "marked_as_spam",
          });
          break;
        default:
          // delivered / opened / clicked / delivery_delayed are tracked
          // only at the aggregate (provider webhook log) level for now.
          break;
      }
    } catch (error) {
      console.error("resend webhook: email_sends update failed", error);
    }
  }

  if (!to) return { handled: false, reason: "no_recipient" };

  switch (event.type) {
    case "email.bounced":
    case "email.complained": {
      const customer = await findCustomerByEmail(to);
      if (!customer) return { handled: true, action: "no_customer_match" };

      await updateMarketingConsent({
        customerId: customer.id,
        marketingOptIn: false,
      });
      await stopAllMarketingSequencesForCustomer(customer.id);
      await removeContactFromAudience(to).catch(() => null);

      return {
        handled: true,
        action: event.type === "email.bounced" ? "suppressed_bounced" : "suppressed_complained",
        customerId: customer.id,
      };
    }
    case "email.delivered":
    case "email.sent":
    case "email.opened":
    case "email.clicked":
    case "email.delivery_delayed":
    default:
      return { handled: true, action: "logged_only", type: event.type };
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  const verification = verifySignature(request, raw);
  if (!verification.ok) {
    // If secret not configured, accept but no-op in dev; reject in prod.
    if (verification.reason === "no_secret" && process.env.NODE_ENV !== "production") {
      // Soft-accept dev pings so Resend dashboard test sends succeed.
    } else {
      return NextResponse.json({ received: false, error: verification.reason }, { status: 400 });
    }
  }

  let parsed: ResendEvent;
  try {
    parsed = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ received: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await handleEvent(parsed);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("resend webhook: handler failed", error);
    return NextResponse.json(
      { received: true, error: error instanceof Error ? error.message : "handler_error" },
      { status: 200 }, // return 200 so Resend doesn't replay forever
    );
  }
}
