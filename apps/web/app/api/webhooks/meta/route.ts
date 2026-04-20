import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { getMetaEnv } from "@littlecolorbook/shared/env";
import {
  insertMetaWebhookEvent,
  markMetaWebhookEventProcessed,
  upsertDmThread,
  insertDmMessage,
  touchDmThreadLastUserMessage,
  touchDmThreadLastAgentMessage,
  listDmKeywordResponses,
  incrementDmKeywordResponseMatch,
  getDmThreadWithMessages,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import {
  verifyMetaWebhookSignature,
  parseIncomingMessengerEvent,
  parseIncomingIgEvent,
  matchAutoReply,
  sendFbMessengerText,
} from "@littlecolorbook/social";
import type { AutoReplyKeywordResponse } from "@littlecolorbook/social";

// ─── GET — Webhook challenge verification ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = getMetaEnv().webhookVerifyToken;
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
    // Dev/test: acknowledge the webhook but skip processing because the
    // downstream idempotency and reply flow depends on the DB backing store.
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

        // ── Auto-reply engine ────────────────────────────────────────────────
        // Fire-and-forget: errors must never block the 200 response to Meta.
        void (async () => {
          try {
            if (!event.text) return;

            // Fetch enabled rules for this platform (null platform = both).
            const rawRules = await listDmKeywordResponses({
              enabledOnly: true,
              platform: event.platform,
            });

            // Map DB rows to the matcher's KeywordResponse shape.
            const rules: AutoReplyKeywordResponse[] = rawRules.map((r) => ({
              id: r.id,
              matchKind: r.matchKind,
              matchPattern: r.matchPattern,
              responseBody: r.responseBody,
              platform: r.platform ?? null,
            }));

            const matched = matchAutoReply(event.text, event.platform, rules);
            if (!matched) return;

            // Loop guard: skip if the most recent outbound message on this
            // thread was already sent by this auto-reply rule.
            const recent = await getDmThreadWithMessages(thread.id, { messageLimit: 5, messageOffset: 0 });
            const recentMessages = recent?.messages ?? [];

            const autoSentBy = `auto:${matched.id}`;
            const lastOutbound = [...recentMessages]
              .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
              .find((m) => m.direction === "outbound");
            if (lastOutbound?.sentBy === autoSentBy) return;

            // Send the reply — only Messenger is fully implemented; IG is stubbed.
            if (event.platform === "fb_messenger") {
              const metaEnv = getMetaEnv();
              const pageToken = metaEnv.pageAccessToken;
              const pageId = metaEnv.pageId ?? event.pageId;
              if (!pageToken || !pageId) {
                console.warn("meta webhook auto-reply: META_PAGE_ACCESS_TOKEN or META_PAGE_ID not configured");
                return;
              }
              await sendFbMessengerText({
                pageAccessToken: pageToken,
                pageId,
                recipientPsid: event.platformUserId,
                text: matched.responseBody,
              });
            } else {
              // IG DM send is not yet implemented — log and skip silently.
              console.info(
                `meta webhook auto-reply: IG DM send not yet implemented; skipping rule ${matched.id}`,
              );
              return;
            }

            const sentAt = new Date();

            // Persist the outbound message.
            await insertDmMessage({
              id: `dmmsg_${randomUUID().replace(/-/g, "")}`,
              threadId: thread.id,
              direction: "outbound",
              metaMessageId: `auto_${randomUUID().replace(/-/g, "")}`,
              body: matched.responseBody,
              attachmentsJson: null,
              sentBy: autoSentBy,
              tag: null,
              sentAt,
            });

            // Touch the thread's last-agent-message timestamp.
            await touchDmThreadLastAgentMessage({ threadId: thread.id, sentAt });

            // Increment the rule's match counter for observability.
            await incrementDmKeywordResponseMatch({ id: matched.id, matchedAt: sentAt });
          } catch (autoErr) {
            // Log but swallow — auto-reply failures must never affect the webhook response.
            console.error("meta webhook auto-reply: error", autoErr);
          }
        })();
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
