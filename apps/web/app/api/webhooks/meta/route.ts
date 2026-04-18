import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import {
  insertMetaWebhookEvent,
  markMetaWebhookEventProcessed,
  upsertDmThread,
  insertDmMessage,
  touchDmThreadLastUserMessage,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import {
  verifyMetaWebhookSignature,
  parseIncomingMessengerEvent,
  parseIncomingIgEvent,
} from "@littlecolorbook/social";

// ─── GET — Webhook challenge verification ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("META_WEBHOOK_VERIFY_TOKEN is not configured");
    return new NextResponse("Server configuration error", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — Inbound webhook events ───────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: Read raw body for signature verification.
  const rawBody = await request.text();

  // Step 2: Verify signature.
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;
  if (!appSecret) {
    console.error("META_WEBHOOK_APP_SECRET is not configured");
    // In production with no secret configured, fail closed.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
  } else {
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const valid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Step 3: Parse JSON body.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Step 4: Record raw event to meta_webhook_events (idempotent by content hash).
  // We use a SHA-256 hash of the raw body as a stable deduplication key because
  // Meta does not provide a top-level event ID for webhook deliveries.
  const objectType = (body.object as string | undefined) ?? "unknown";
  const contentHash = createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
  const webhookId = `mwh_${contentHash}`;

  if (!isDatabaseConfigured()) {
    // Dev/test: skip DB work, process events in-memory only
    console.warn("meta webhook: DATABASE_URL not configured, skipping DB recording");
    return NextResponse.json({ received: true, count: 0, mode: "no-db" });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256") ?? "";
  const receipt = await insertMetaWebhookEvent({
    id: webhookId,
    topic: objectType === "page" ? "messenger" : objectType === "instagram" ? "ig_messaging" : "meta_unknown",
    objectType,
    payloadJson: body,
    signatureHeader,
  });

  // Step 5: Deduplicate — if we've seen this payload before, ack and return.
  if (!receipt.firstSeen) {
    return NextResponse.json({ received: true, count: 0, duplicate: true });
  }

  // Step 6: Parse and process messages.
  let count = 0;
  const errors: string[] = [];

  try {
    const events =
      objectType === "page"
        ? parseIncomingMessengerEvent(body)
        : objectType === "instagram"
          ? parseIncomingIgEvent(body)
          : [];

    for (const event of events) {
      try {
        // Upsert the thread (create if new, update display fields if changed).
        const thread = await upsertDmThread({
          platform: event.platform,
          platformUserId: event.platformUserId,
        });

        if (!thread) continue;

        // Update 24-hour window tracking on the thread.
        await touchDmThreadLastUserMessage({
          threadId: thread.id,
          sentAt: event.sentAt,
        });

        // Insert the message (idempotent by metaMessageId).
        await insertDmMessage({
          id: `dmmsg_${randomUUID().replace(/-/g, "")}`,
          threadId: thread.id,
          direction: "inbound",
          metaMessageId: event.metaMessageId,
          body: event.text,
          attachmentsJson:
            event.attachments.length > 0 ? event.attachments : null,
          sentBy: "customer",
          tag: null,
          sentAt: event.sentAt,
        });

        count++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("meta webhook: failed to process message event", msg, err);
        errors.push(msg);
      }
    }

    // Step 7: Mark webhook event as processed (or failed if all errored).
    const status =
      errors.length > 0 && count === 0 ? "failed" : "processed";
    await markMetaWebhookEventProcessed({
      id: webhookId,
      status,
      errorMessage: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown processing error";
    console.error("meta webhook: top-level processing error", err);

    // Mark event failed but still return 200 — Meta retries on 5xx.
    await markMetaWebhookEventProcessed({
      id: webhookId,
      status: "failed",
      errorMessage: msg,
    }).catch(() => undefined);
  }

  // Step 8: Always return 200 to Meta — 5xx triggers retries.
  return NextResponse.json({ received: true, count });
}
