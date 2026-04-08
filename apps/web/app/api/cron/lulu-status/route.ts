import { NextRequest, NextResponse } from "next/server";
import {
  getFulfillmentOrderContext,
  isDatabaseConfigured,
  listLuluSyncCandidates,
  syncOrderWithLuluStatus,
} from "@littlecolorbook/db";
import { deliverLifecycleEmail } from "../../../../lib/lifecycle-email";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { extractLuluStatusName, extractLuluTracking, getLuluPrintJob, isLuluShippingConfigured } from "../../../../lib/lulu";

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  if (!isDatabaseConfigured()) {
    if (!isDevelopmentMode()) {
      return NextResponse.json({ ok: false, error: "DATABASE_URL is not configured." }, { status: 503 });
    }

    return NextResponse.json({ ok: true, mode: "dev-skip", processed: 0, reason: "database_not_configured" });
  }

  if (!isLuluShippingConfigured()) {
    if (!isDevelopmentMode()) {
      return NextResponse.json({ ok: false, error: "Lulu configuration is incomplete." }, { status: 503 });
    }

    return NextResponse.json({ ok: true, mode: "dev-skip", processed: 0, reason: "lulu_not_configured" });
  }

  const candidates = await listLuluSyncCandidates();
  const updates: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    try {
      const context = await getFulfillmentOrderContext(candidate.orderId);
      const payload = await getLuluPrintJob(candidate.providerJobId);
      const providerStatus = extractLuluStatusName(payload) ?? "CREATED";
      const tracking = extractLuluTracking(payload);

      await syncOrderWithLuluStatus({
        orderId: candidate.orderId,
        providerJobId: candidate.providerJobId,
        providerStatus,
        shippingService: context?.selectedQuote?.service ?? null,
        trackingNumber: tracking.trackingNumber,
        trackingUrl: tracking.trackingUrl,
        rawPayload: payload,
      });

      const normalizedStatus = providerStatus.toUpperCase();
      const lifecycleTemplate =
        normalizedStatus === "SHIPPED"
          ? "order-shipped"
          : normalizedStatus === "DELIVERED"
            ? "order-delivered"
            : null;

      if (lifecycleTemplate) {
        try {
          await deliverLifecycleEmail({
            orderId: candidate.orderId,
            template: lifecycleTemplate,
          });
        } catch (error) {
          console.error("Failed to send cron lifecycle email", error);
        }
      }

      updates.push({
        orderId: candidate.orderId,
        providerJobId: candidate.providerJobId,
        providerStatus,
        trackingNumber: tracking.trackingNumber,
      });
    } catch (error) {
      failures.push({
        orderId: candidate.orderId,
        providerJobId: candidate.providerJobId,
        error: error instanceof Error ? error.message : "Lulu sync failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "live",
    processed: updates.length,
    failed: failures.length,
    updates,
    failures,
  });
}
