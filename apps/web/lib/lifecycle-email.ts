import "server-only";

import {
  createPortalAccessForOrder,
  getOrderPortalSummaryByOrderId,
  hasLifecycleEmailBeenSent,
  recordLifecycleEmailEvent,
} from "@littlecolorbook/db";
import { sendLifecycleEmail, type LifecycleEmailTemplate } from "@littlecolorbook/email";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getIntegrationStatus, isEmailConfigured } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";
import { getAppUrl } from "./stripe";

export async function deliverLifecycleEmail(input: {
  orderId: string;
  template: LifecycleEmailTemplate;
  force?: boolean;
}) {
  const summary = await getOrderPortalSummaryByOrderId(input.orderId);

  if (!summary) {
    throw new Error("Order not found for lifecycle email.");
  }

  if (!summary.customer?.email) {
    return {
      orderId: summary.order.id,
      template: input.template,
      status: "skipped" as const,
      reason: "missing_customer_email",
    };
  }

  if (!input.force && (await hasLifecycleEmailBeenSent(summary.order.id, input.template))) {
    return {
      orderId: summary.order.id,
      template: input.template,
      status: "skipped" as const,
      reason: "already_sent",
    };
  }

  const offer = getOfferByCode(summary.order.selectedOfferCode);
  const portalAccess = await createPortalAccessForOrder(summary.order.id);

  if (!portalAccess) {
    throw new Error("Could not create a secure portal link for this order.");
  }

  const portalUrl = `${getAppUrl()}${portalAccess.portalHref}`;
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@littlecolorbook.com";
  const emailProvider = isEmailConfigured() ? "resend" : "stub";
  let downloadUrl: string | null = null;

  if (input.template === "pdf-ready" && summary.assets.downloadPdfPath && getIntegrationStatus().gcsConfigured) {
    downloadUrl = (
      await createSignedDownloadUrl({
        bucket: "exports",
        objectPath: summary.assets.downloadPdfPath,
        expiresInMinutes: 90,
      })
    ).url;
  }

  await recordLifecycleEmailEvent({
    orderId: summary.order.id,
    template: input.template,
    status: "queued",
    provider: emailProvider,
    payload: {
      portalUrl,
      downloadUrl,
      trackingUrl: summary.fulfillment?.trackingUrl ?? null,
    },
  });

  try {
    const result = await sendLifecycleEmail({
      template: input.template,
      to: summary.customer.email,
      portalUrl,
      orderId: summary.order.id,
      offerTitle: offer.title,
      designCount: summary.order.designCount,
      deliveryMode: summary.order.deliveryMode,
      customerFirstName: summary.customer.firstName,
      childFirstName: summary.order.childFirstName,
      downloadUrl,
      trackingUrl: summary.fulfillment?.trackingUrl ?? null,
      supportEmail,
    });

    await recordLifecycleEmailEvent({
      orderId: summary.order.id,
      template: input.template,
      status: result.status === "sent" ? "sent" : "skipped",
      provider: result.provider,
      providerMessageId: result.messageId,
      subject: result.subject,
      payload: {
        portalUrl,
        downloadUrl,
        trackingUrl: summary.fulfillment?.trackingUrl ?? null,
      },
      sentAt: result.status === "sent" ? new Date() : null,
    });

    return {
      orderId: summary.order.id,
      template: input.template,
      status: result.status,
      provider: result.provider,
      messageId: result.messageId,
      portalUrl,
      downloadUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lifecycle email error";

    await recordLifecycleEmailEvent({
      orderId: summary.order.id,
      template: input.template,
      status: "failed",
      provider: emailProvider,
      payload: {
        error: message,
        portalUrl,
      },
    });

    throw error;
  }
}
