import { NextRequest, NextResponse } from "next/server";
import { getBrandedFromAddress, getSupportEmailAddress } from "@littlecolorbook/shared/env";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  hasRecentBroadcast,
  nextUtcWeekdayAt,
  recordBroadcastDraft,
  selectSundayFamily,
} from "../../../../lib/newsletter-curator";
import { renderSundayShowOff } from "../../../../lib/newsletter-render";
import { createBroadcast } from "../../../../lib/resend-broadcasts";
import { isResendAudiencesConfigured } from "../../../../lib/resend-audiences";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getAppUrl() {
  return process.env.APP_URL ?? "https://www.littlecolorbook.com";
}

function sundayBroadcastAt(): Date {
  // Target Sunday 22:00 UTC (~6pm Eastern). Cron fires Saturday, so we
  // have a ~24-32h admin review window to approve or cancel.
  return nextUtcWeekdayAt({ dayOfWeek: 0, hourUtc: 22, minLeadHours: 20 });
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
  let scheduledFor = sundayBroadcastAt();

  if (isResendAudiencesConfigured()) {
    try {
      const broadcast = await createBroadcast({
        audienceId: process.env.RESEND_MARKETING_AUDIENCE_ID!,
        from: getBrandedFromAddress(),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: getSupportEmailAddress(),
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
