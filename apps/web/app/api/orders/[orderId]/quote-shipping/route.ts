import { NextRequest, NextResponse } from "next/server";
import {
  getOrderById,
  isDatabaseConfigured,
  saveShippingQuotes,
  updateOrderCommerceSelection,
  upsertOrderAddress,
} from "@littlecolorbook/db";
import { estimateInteriorPageCount, getNormalizedOrderQuantity, getOfferByCode } from "@littlecolorbook/shared";
import { isLuluShippingConfigured, quoteLuluShippingOptions } from "../../../../../lib/lulu";
import { z } from "zod";

const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().trim().min(3),
  countryCode: z.string().trim().length(2).default("US"),
  phone: z.string().trim().optional(),
  quantity: z.number().int().positive().optional(),
  bundleSelection: z.string().trim().optional(),
});

function shouldAllowDevQuoteFallback() {
  return process.env.NODE_ENV !== "production";
}

function getDevQuotes(quantity: number) {
  const additionalCopies = Math.max(0, quantity - 1);

  return [
    {
      service: "ground",
      label: "Ground",
      quantity,
      shippingCents: 895 + additionalCopies * 250,
      window: "4-6 business days",
      isSelected: true,
      quotePayload: { carrier: "lulu-dev-fallback", quantity },
    },
    {
      service: "expedited",
      label: "Expedited",
      quantity,
      shippingCents: 1495 + additionalCopies * 350,
      window: "3-5 business days",
      quotePayload: { carrier: "lulu-dev-fallback", quantity },
    },
  ];
}

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid shipping address",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const existingOrder = isDatabaseConfigured() ? await getOrderById(orderId) : null;

  if (isDatabaseConfigured() && !existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const selectedOffer = getOfferByCode(existingOrder?.selectedOfferCode ?? "print-30");
  const quantity = getNormalizedOrderQuantity({
    format: selectedOffer.format,
    quantity: parsed.data.quantity ?? existingOrder?.quantity ?? 1,
    bundleSelection: parsed.data.bundleSelection ?? existingOrder?.bundleSelection ?? null,
  });
  const bundleSelection = parsed.data.bundleSelection ?? existingOrder?.bundleSelection ?? null;

  await upsertOrderAddress(orderId, {
    fullName: parsed.data.fullName ?? null,
    line1: parsed.data.line1,
    line2: parsed.data.line2 ?? null,
    city: parsed.data.city,
    state: parsed.data.state,
    postalCode: parsed.data.postalCode,
    countryCode: parsed.data.countryCode,
    phone: parsed.data.phone ?? null,
  });

  if (isDatabaseConfigured()) {
    await updateOrderCommerceSelection({
      orderId,
      selectedOfferCode: existingOrder?.selectedOfferCode ?? selectedOffer.code,
      quantity,
      bundleSelection,
      shippingCents: 0,
    });
  }

  if (!isLuluShippingConfigured()) {
    if (!shouldAllowDevQuoteFallback()) {
      return NextResponse.json({ error: "Lulu shipping is not configured." }, { status: 503 });
    }

    const quotes = await saveShippingQuotes(orderId, getDevQuotes(quantity));
    return NextResponse.json({
      orderId,
      quantity,
      bundleSelection,
      quotes: quotes.map((quote) => ({
        id: quote.id,
        service: quote.service,
        label: quote.label,
        quantity: quote.quantity,
        shippingCents: quote.shippingCents,
        window: quote.window,
        isSelected: quote.isSelected,
      })),
      databaseConfigured: quotes[0]?.databaseConfigured ?? isDatabaseConfigured(),
      mode: "dev-fallback",
      warning: "Using local development shipping quotes because Lulu is not configured.",
    });
  }

  if (!parsed.data.fullName || !parsed.data.phone) {
    return NextResponse.json({ error: "Full name and phone number are required for live Lulu quotes." }, { status: 400 });
  }

  try {
    const liveQuotes = await quoteLuluShippingOptions({
      pageCount: estimateInteriorPageCount(existingOrder?.designCount ?? selectedOffer.designs),
      quantity,
      shippingAddress: {
        city: parsed.data.city,
        country_code: parsed.data.countryCode,
        name: parsed.data.fullName,
        phone_number: parsed.data.phone,
        postcode: parsed.data.postalCode,
        state_code: parsed.data.state,
        street1: parsed.data.line1,
        street2: parsed.data.line2 ?? null,
      },
    });

    if (liveQuotes.length === 0) {
      throw new Error("Lulu did not return any shipping options for this order.");
    }

    const quotes = await saveShippingQuotes(
      orderId,
      liveQuotes.map((quote, index) => ({
        service: quote.service,
        label: quote.label,
        quantity: quote.quantity,
        shippingCents: quote.shippingCents,
        window: quote.window,
        isSelected: index === 0,
        // Persist the raw Lulu response + a flattened productionCostCents /
        // fulfillmentCostCents for cheap server-side reads (metrics,
        // refund-tier). These fields are INTERNAL cost-of-goods — never
        // returned to the customer.
        quotePayload: {
          ...quote.rawPayload,
          productionCostCents: quote.productionCostCents,
          fulfillmentCostCents: quote.fulfillmentCostCents,
        },
      })),
    );

    return NextResponse.json({
      orderId,
      quantity,
      bundleSelection,
      quotes: quotes.map((quote) => ({
        id: quote.id,
        service: quote.service,
        label: quote.label,
        quantity: quote.quantity,
        shippingCents: quote.shippingCents,
        window: quote.window,
        isSelected: quote.isSelected,
      })),
      databaseConfigured: quotes[0]?.databaseConfigured ?? isDatabaseConfigured(),
      mode: "live",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load live Lulu quotes.";

    if (!shouldAllowDevQuoteFallback()) {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const quotes = await saveShippingQuotes(orderId, getDevQuotes(quantity));
    return NextResponse.json({
      orderId,
      quantity,
      bundleSelection,
      quotes: quotes.map((quote) => ({
        id: quote.id,
        service: quote.service,
        label: quote.label,
        quantity: quote.quantity,
        shippingCents: quote.shippingCents,
        window: quote.window,
        isSelected: quote.isSelected,
      })),
      databaseConfigured: quotes[0]?.databaseConfigured ?? isDatabaseConfigured(),
      mode: "dev-fallback",
      warning: message,
    });
  }
}
