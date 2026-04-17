import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { hasRecentBroadcast, recordBroadcastDraft, selectSundayFamily } from "../../../../lib/newsletter-curator";
import { renderSundayShowOff } from "../../../../lib/newsletter-render";
import { createBroadcast } from "../../../../lib/resend-broadcasts";
import { isResendAudiencesConfigured } from "../../../../lib/resend-audiences";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getAppUrl() {
  return process.env.APP_URL ?? "https://www.littlecolorbook.com";
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "hello@littlecolorbook.com";
}

function nextSundayEveningUtc(): Date {
  // Run at Sunday 6pm Eastern = 10pm / 11pm UTC. We'll target 22:00 UTC.
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(22, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target;
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  if (await hasRecentBroadcast({ archetype: "sunday_show_off", windowHours: 24 })) {
    return NextResponse.json({ accepted: false, reason: "already_scheduled_today" });
  }

  const candidate = await selectSundayFamily();
  if (!candidate) {
    return NextResponse.json({ accepted: false, reason: "no_qualifying_family" });
  }

  const appUrl = getAppUrl();
  const accountUrl = `${appUrl}/account`;
  const shopUrl = `${appUrl}/create?source=newsletter-sunday`;

  const rendered = await renderSundayShowOff({
    candidate,
    accountUrl,
    shopUrl,
  });

  let resendBroadcastId: string | null = null;
  let scheduledFor = nextSundayEveningUtc();

  if (isResendAudiencesConfigured()) {
    try {
      const broadcast = await createBroadcast({
        audienceId: process.env.RESEND_MARKETING_AUDIENCE_ID!,
        from: getFromAddress(),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: process.env.SUPPORT_EMAIL ?? undefined,
        scheduledAt: scheduledFor.toISOString(),
        name: `sunday_show_off_${new Date().toISOString().slice(0, 10)}`,
      });
      resendBroadcastId = broadcast.id;
    } catch (error) {
      console.error("newsletter-sunday: createBroadcast failed", error);
    }
  }

  const id = await recordBroadcastDraft({
    archetype: "sunday_show_off",
    resendBroadcastId,
    resendAudienceId: process.env.RESEND_MARKETING_AUDIENCE_ID ?? null,
    subject: rendered.subject,
    preheader: rendered.preheader,
    scheduledFor,
    contactsCount: null,
    selection: {
      familyCustomerId: candidate.customerId,
      orderId: candidate.orderId,
      pageObjectPaths: [candidate.assetObjectPath],
      qaScore: candidate.qaScore,
    },
    payload: {
      subject: rendered.subject,
      preheader: rendered.preheader,
      // html omitted from audit payload to keep row size reasonable
    },
  });

  return NextResponse.json({
    accepted: true,
    archetype: "sunday_show_off",
    broadcastSendId: id,
    resendBroadcastId,
    scheduledFor: scheduledFor.toISOString(),
    familyCustomerId: candidate.customerId,
  });
}
