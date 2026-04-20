import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getMetaEnv } from "@littlecolorbook/shared/env";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import {
  getDmThreadById,
  insertDmMessage,
  touchDmThreadLastAgentMessage,
} from "@littlecolorbook/db";
import { sendFbMessengerText, DmWindowExpiredError } from "@littlecolorbook/social";

const replySchema = z.object({
  text: z.string().min(1).max(2000),
  tag: z.literal("HUMAN_AGENT").optional(),
  /** Optional email of the admin sending the reply; stored in sent_by. */
  sentBy: z.string().email().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const thread = await getDmThreadById(id);
  if (!thread) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `DM thread ${id} not found` } },
      { status: 404 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const { text, tag, sentBy } = parsed.data;

  // Check if the 24-hour window is still open.
  const now = new Date();
  const windowOpen =
    thread.windowExpiresAt !== null && thread.windowExpiresAt > now;

  if (!windowOpen && !tag) {
    return NextResponse.json(
      {
        error: {
          code: "WINDOW_EXPIRED",
          message:
            "The 24-hour messaging window has expired for this thread. " +
            "You cannot send a message without a HUMAN_AGENT tag.",
          hint: "Pass tag='HUMAN_AGENT' if you are a live agent responding to a prior customer message.",
        },
      },
      { status: 400 },
    );
  }

  // Only FB Messenger is currently supported for send.
  if (thread.platform !== "fb_messenger") {
    return NextResponse.json(
      {
        error: {
          code: "PLATFORM_NOT_SUPPORTED",
          message:
            "IG Direct send requires instagram_manage_messages scope — not yet configured.",
        },
      },
      { status: 422 },
    );
  }

  const metaEnv = getMetaEnv();
  const pageAccessToken = metaEnv.pageAccessToken;
  const pageId = metaEnv.pageId;

  if (!pageAccessToken || !pageId) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIG_ERROR",
          message: "META_PAGE_ACCESS_TOKEN or META_PAGE_ID is not configured.",
        },
      },
      { status: 503 },
    );
  }

  // Send via Messenger API.
  let metaResult: { message_id: string; recipient_id: string };
  try {
    metaResult = await sendFbMessengerText({
      pageAccessToken,
      pageId,
      recipientPsid: thread.platformUserId,
      text,
      tag: tag as "HUMAN_AGENT" | undefined,
    });
  } catch (err) {
    if (err instanceof DmWindowExpiredError) {
      return NextResponse.json(
        {
          error: {
            code: "WINDOW_EXPIRED",
            message: "Meta confirmed the 24-hour window has expired for this recipient.",
            hint: "Pass tag='HUMAN_AGENT' if you are a live agent responding to a prior customer message.",
          },
        },
        { status: 400 },
      );
    }

    const message = err instanceof Error ? err.message : "Failed to send message";
    console.error("dm reply: Messenger send failed", err);
    return NextResponse.json(
      { error: { code: "SEND_FAILED", message } },
      { status: 502 },
    );
  }

  const sentAt = new Date();

  // Persist the outbound message.
  const message = await insertDmMessage({
    id: `dmmsg_${randomUUID().replace(/-/g, "")}`,
    threadId: thread.id,
    direction: "outbound",
    metaMessageId: metaResult.message_id,
    body: text,
    sentBy: sentBy ?? "agent",
    tag: tag ?? null,
    sentAt,
  });

  // Update thread's last agent message timestamp.
  await touchDmThreadLastAgentMessage({
    threadId: thread.id,
    sentAt,
    assignedTo: sentBy ?? thread.assignedTo,
  });

  return NextResponse.json({ ok: true, message }, { status: 200 });
}
