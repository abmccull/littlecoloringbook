import { NextRequest, NextResponse } from "next/server";
import {
  advanceSequenceState,
  listDueSequenceSteps,
  recordSequenceSendAttempt,
  stopSequenceForCustomer,
} from "@littlecolorbook/db";
import {
  computeNextSendAt,
  getLastStep,
  getSequenceStep,
  renderSequenceEmail,
  sendSequenceEmail,
  type SequenceKey,
  type SequenceVariables,
} from "@littlecolorbook/email";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { getAppUrl } from "../../../../lib/stripe";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL ?? "support@littlecolorbook.com";
}

function buildVars(input: {
  email: string;
  firstName: string | null;
  metadata: Record<string, unknown> | null;
}): SequenceVariables {
  const meta = input.metadata ?? {};
  const appUrl = getAppUrl();
  const accountUrl = typeof meta.accountUrl === "string" ? meta.accountUrl : `${appUrl}/account`;
  const orderUrl = typeof meta.orderUrl === "string" ? meta.orderUrl : null;
  const resumeUrl = typeof meta.checkoutResumeUrl === "string" ? meta.checkoutResumeUrl : null;
  const offerCode = typeof meta.offerCode === "string" ? meta.offerCode : null;

  return {
    firstName: input.firstName,
    childFirstName: typeof meta.childFirstName === "string" ? meta.childFirstName : null,
    email: input.email,
    sampleUrl: typeof meta.sampleUrl === "string" ? meta.sampleUrl : null,
    sampleUrlNew: typeof meta.sampleUrlNew === "string" ? meta.sampleUrlNew : `${appUrl}/sample`,
    accountUrl,
    shopUrl: typeof meta.shopUrl === "string" ? meta.shopUrl : `${appUrl}/create?source=sequence`,
    orderUrl,
    offerCode,
    offerLabel: typeof meta.offerLabel === "string" ? meta.offerLabel : null,
    offerExpiresLabel: typeof meta.offerExpiresLabel === "string" ? meta.offerExpiresLabel : null,
    checkoutResumeUrl: resumeUrl,
    supportEmail: getSupportEmail(),
  };
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const batchSize = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const due = await listDueSequenceSteps(Number.isFinite(batchSize) ? batchSize : 25);
  const results: Array<{ stateId: string; action: string; error?: string }> = [];

  for (const row of due) {
    const sequence = row.sequence as SequenceKey;
    const nextStep = row.currentStep + 1;

    // Bail early if the customer opted out of marketing — sequences are
    // marketing-ish. We still send abandonment/welcome step 1 regardless
    // because those are triggered by the customer's own action and feel
    // transactional. Guard on the subsequent steps only.
    if (!row.marketingOptIn && nextStep > 1 && sequence !== "abandonment") {
      await stopSequenceForCustomer({
        customerId: row.customerId,
        sequence,
        reason: "unsubscribed",
      });
      results.push({ stateId: row.stateId, action: "stopped_unsub" });
      continue;
    }

    const step = getSequenceStep(sequence, nextStep);
    if (!step) {
      await advanceSequenceState({ stateId: row.stateId, nextStep: row.currentStep, nextSendAt: null });
      results.push({ stateId: row.stateId, action: "completed_no_step" });
      continue;
    }

    const vars = buildVars({
      email: row.customerEmail,
      firstName: row.customerFirstName,
      metadata: row.metadata,
    });

    const rendered = renderSequenceEmail(sequence, nextStep, vars);
    if (!rendered) {
      results.push({ stateId: row.stateId, action: "render_failed" });
      continue;
    }

    try {
      const dispatch = await sendSequenceEmail({
        to: row.customerEmail,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        replyTo: getSupportEmail(),
      });

      await recordSequenceSendAttempt({
        customerId: row.customerId,
        orderId: typeof row.metadata?.orderId === "string" ? row.metadata.orderId : null,
        sequence,
        step: nextStep,
        template: step.key,
        toEmail: row.customerEmail,
        subject: rendered.subject,
        providerMessageId: dispatch.messageId,
        status: dispatch.status === "sent" ? "sent" : "skipped",
      });

      const isLast = nextStep >= getLastStep(sequence);
      const nextSendAt = isLast
        ? null
        : computeNextSendAt(sequence, nextStep + 1, new Date());

      await advanceSequenceState({ stateId: row.stateId, nextStep, nextSendAt });
      results.push({ stateId: row.stateId, action: dispatch.status === "sent" ? "sent" : "skipped" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      console.error("email-sequences cron: send failed", { stateId: row.stateId, error: message });
      await recordSequenceSendAttempt({
        customerId: row.customerId,
        orderId: typeof row.metadata?.orderId === "string" ? row.metadata.orderId : null,
        sequence,
        step: nextStep,
        template: step.key,
        toEmail: row.customerEmail,
        subject: rendered.subject,
        providerMessageId: null,
        status: "failed",
        error: message,
      });
      results.push({ stateId: row.stateId, action: "failed", error: message });
    }
  }

  return NextResponse.json({
    accepted: true,
    processed: results.length,
    results,
  });
}
