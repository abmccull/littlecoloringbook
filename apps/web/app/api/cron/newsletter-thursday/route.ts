import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  hasRecentBroadcast,
  nextUtcWeekdayAt,
  recordBroadcastDraft,
  selectThursdayGallery,
} from "../../../../lib/newsletter-curator";
import { pickPromptOfTheWeek, renderThursdayGallery } from "../../../../lib/newsletter-render";
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

function thursdayBroadcastAt(): Date {
  // Target Thursday 13:00 UTC (~9am ET / 8am CT / 6am PT). Cron fires
  // Wednesday so we have a ~24h admin review window.
  return nextUtcWeekdayAt({ dayOfWeek: 4, hourUtc: 13, minLeadHours: 20 });
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  if (await hasRecentBroadcast({ archetype: "thursday_gallery", windowHours: 24 })) {
    return NextResponse.json({ accepted: false, reason: "already_scheduled_today" });
  }

  const candidates = await selectThursdayGallery();
  if (candidates.length === 0) {
    return NextResponse.json({ accepted: false, reason: "not_enough_qualifying_pages" });
  }

  const appUrl = getAppUrl();
  const accountUrl = `${appUrl}/account`;
  const shopUrl = `${appUrl}/create?source=newsletter-thursday`;
  const prompt = pickPromptOfTheWeek();

  const rendered = await renderThursdayGallery({
    candidates,
    accountUrl,
    shopUrl,
    promptOfTheWeek: prompt,
  });

  let resendBroadcastId: string | null = null;
  let scheduledFor = thursdayBroadcastAt();

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
        name: `thursday_gallery_${new Date().toISOString().slice(0, 10)}`,
      });
      resendBroadcastId = broadcast.id;
    } catch (error) {
      console.error("newsletter-thursday: createBroadcast failed", error);
    }
  }

  const id = await recordBroadcastDraft({
    archetype: "thursday_gallery",
    resendBroadcastId,
    resendAudienceId: process.env.RESEND_MARKETING_AUDIENCE_ID ?? null,
    subject: rendered.subject,
    preheader: rendered.preheader,
    scheduledFor,
    contactsCount: null,
    selection: {
      pageObjectPaths: candidates.map((c) => c.assetObjectPath),
      customerIds: candidates.map((c) => c.customerId),
    },
    payload: {
      subject: rendered.subject,
      preheader: rendered.preheader,
      prompt,
    },
  });

  return NextResponse.json({
    accepted: true,
    archetype: "thursday_gallery",
    broadcastSendId: id,
    resendBroadcastId,
    scheduledFor: scheduledFor.toISOString(),
    pageCount: candidates.length,
  });
}
