import { NextRequest, NextResponse } from "next/server";
import { getFulfillmentOrderContext, isDatabaseConfigured, markOrderSubmittedToLulu } from "@littlecolorbook/db";
import { APP_NAME } from "@littlecolorbook/shared";
import { createLuluPrintJob, isLuluShippingConfigured, mapQuoteServiceToLuluLevel } from "../../../../../lib/lulu";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

const submitLuluSchema = z.object({
  orderId: z.string().trim().min(1),
  interiorUrl: z.string().url(),
  coverUrl: z.string().url(),
  quantity: z.number().int().positive().default(1),
  title: z.string().trim().min(1).optional(),
  contactEmail: z.string().email().optional(),
  productionDelay: z.number().int().min(0).max(1440).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = submitLuluSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Lulu submission request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const context = await getFulfillmentOrderContext(parsed.data.orderId);

  if (isDatabaseConfigured() && !context) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!isLuluShippingConfigured()) {
    return NextResponse.json({ error: "Lulu pod package configuration is incomplete." }, { status: 503 });
  }

  if (!context?.shippingAddress || !context.selectedQuote) {
    return NextResponse.json({ error: "Shipping address and selected shipping quote are required before Lulu submission." }, { status: 400 });
  }

  const contactEmail = parsed.data.contactEmail ?? context.customerEmail;

  if (!contactEmail) {
    return NextResponse.json({ error: "A contact email is required for Lulu print jobs." }, { status: 400 });
  }

  if (!context.shippingAddress.phone || !context.shippingAddress.fullName) {
    return NextResponse.json({ error: "Lulu requires a full shipping name and phone number." }, { status: 400 });
  }

  const submission = await createLuluPrintJob({
    contactEmail,
    coverUrl: parsed.data.coverUrl,
    externalId: parsed.data.orderId,
    interiorUrl: parsed.data.interiorUrl,
    productionDelay: parsed.data.productionDelay,
    quantity: parsed.data.quantity,
    shippingAddress: {
      city: context.shippingAddress.city,
      country_code: context.shippingAddress.countryCode,
      email: context.customerEmail,
      name: context.shippingAddress.fullName,
      phone_number: context.shippingAddress.phone,
      postcode: context.shippingAddress.postalCode,
      state_code: context.shippingAddress.state,
      street1: context.shippingAddress.line1,
      street2: context.shippingAddress.line2,
    },
    shippingLevel: mapQuoteServiceToLuluLevel(context.selectedQuote.service),
    title: parsed.data.title ?? `${APP_NAME} ${context.order.id}`,
  });

  if (isDatabaseConfigured()) {
    await markOrderSubmittedToLulu({
      orderId: parsed.data.orderId,
      providerJobId: submission.providerJobId,
      shippingService: context.selectedQuote.service,
      rawPayload: submission.rawPayload,
    });

    try {
      await deliverLifecycleEmail({
        orderId: parsed.data.orderId,
        template: "print-submitted",
      });
    } catch (error) {
      console.error("Failed to send print-submitted email", error);
    }
  }

  return NextResponse.json({
    orderId: parsed.data.orderId,
    mode: "live",
    providerJobId: submission.providerJobId,
    status: "submitted_to_lulu",
  });
}
