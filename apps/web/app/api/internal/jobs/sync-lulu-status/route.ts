import { NextRequest, NextResponse } from "next/server";
import { getFulfillmentOrderContext, isDatabaseConfigured, syncOrderWithLuluStatus } from "@littlecolorbook/db";
import { extractLuluStatusName, extractLuluTracking, getLuluPrintJob, isLuluShippingConfigured } from "../../../../../lib/lulu";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

const syncLuluStatusSchema = z
  .object({
    orderId: z.string().trim().min(1).optional(),
    providerJobId: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.orderId || value.providerJobId, {
    message: "orderId or providerJobId is required",
  });

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = syncLuluStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Lulu status sync request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  if (!isLuluShippingConfigured()) {
    return NextResponse.json({ error: "Lulu configuration is incomplete." }, { status: 503 });
  }

  const context = parsed.data.orderId ? await getFulfillmentOrderContext(parsed.data.orderId) : null;

  if (parsed.data.orderId && isDatabaseConfigured() && !context) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const providerJobId = parsed.data.providerJobId ?? context?.fulfillmentJob?.providerJobId ?? context?.order.luluPrintJobId;

  if (!providerJobId) {
    return NextResponse.json({ error: "No Lulu print job ID is available for synchronization." }, { status: 400 });
  }

  const payload = await getLuluPrintJob(providerJobId);
  const providerStatus = extractLuluStatusName(payload) ?? "CREATED";
  const tracking = extractLuluTracking(payload);

  if (parsed.data.orderId && isDatabaseConfigured()) {
    await syncOrderWithLuluStatus({
      orderId: parsed.data.orderId,
      providerJobId,
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
          orderId: parsed.data.orderId,
          template: lifecycleTemplate,
        });
      } catch (error) {
        console.error("Failed to send Lulu lifecycle email", error);
      }
    }
  }

  return NextResponse.json({
    orderId: parsed.data.orderId ?? null,
    providerJobId,
    providerStatus,
    trackingNumber: tracking.trackingNumber,
    trackingUrl: tracking.trackingUrl,
    mode: "live",
  });
}
