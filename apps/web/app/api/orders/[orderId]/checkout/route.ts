import { NextRequest, NextResponse } from "next/server";
import {
  attachStripeCheckoutSessionToOrder,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import { getNormalizedOrderQuantity, getOfferByCode, getOfferSubtotalForQuantity } from "@littlecolorbook/shared";
import { getAppUrl, getStripe, getVerifiedStripeAccountId, isStripeConfigured } from "../../../../../lib/stripe";
import { z } from "zod";

const checkoutRequestSchema = z.object({
  selectedQuote: z.string().trim().optional(),
  selectedOffer: z.string().trim().optional(),
  quantity: z.number().int().positive().optional(),
  bundleSelection: z.string().trim().optional(),
  shippingCents: z.number().int().nonnegative().optional(),
  shippingLabel: z.string().trim().optional(),
});

function allowDevCheckoutFallback() {
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = checkoutRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid checkout request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const summary = await getOrderPortalSummaryByOrderId(orderId);

  if (isDatabaseConfigured() && !summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = summary?.order;
  const selectedOffer = getOfferByCode(parsed.data.selectedOffer ?? order?.selectedOfferCode ?? "pdf-30");
  const deliveryMode = order?.deliveryMode ?? (selectedOffer.format === "print" ? "print" : "pdf");
  const customerEmail = summary?.customer?.email ?? undefined;
  const quantity = getNormalizedOrderQuantity({
    format: selectedOffer.format,
    quantity: parsed.data.quantity ?? order?.quantity ?? 1,
    bundleSelection: parsed.data.bundleSelection ?? order?.bundleSelection ?? null,
  });
  const bundleSelection = parsed.data.bundleSelection ?? order?.bundleSelection ?? null;
  const selectedQuote =
    deliveryMode === "print"
      ? (summary?.quotes.find((quote) => quote.id === parsed.data.selectedQuote) ??
        summary?.quotes.find((quote) => quote.isSelected) ??
        null)
      : null;

  if (deliveryMode === "print" && isDatabaseConfigured() && !selectedQuote) {
    return NextResponse.json({ error: "Select a shipping option before checkout." }, { status: 400 });
  }

  if (deliveryMode === "print" && selectedQuote && selectedQuote.quantity !== quantity) {
    return NextResponse.json({ error: "Shipping quote is stale for the selected print quantity. Requote shipping and try again." }, { status: 400 });
  }

  const shippingCents = selectedQuote?.shippingCents ?? parsed.data.shippingCents ?? 0;
  const subtotalCents = getOfferSubtotalForQuantity(selectedOffer, {
    quantity,
    bundleSelection,
  });

  if (!isStripeConfigured()) {
    if (!allowDevCheckoutFallback()) {
      return NextResponse.json({ error: "Stripe is not configured for checkout." }, { status: 503 });
    }

    return NextResponse.json({
      orderId,
      status: "checkout_session_created",
      quantity,
      selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
      checkoutUrl: `/order/confirmation?orderId=${orderId}`,
      note: "Using local development checkout fallback because Stripe is not configured.",
      stripeConfigured: false,
      databaseConfigured: isDatabaseConfigured(),
    });
  }

  const stripe = getStripe();
  await getVerifiedStripeAccountId();
  const appUrl = getAppUrl();
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: subtotalCents,
        product_data: {
          name:
            deliveryMode === "print"
              ? `littlecolorbook.com ${selectedOffer.title} (${quantity} printed ${quantity === 1 ? "copy" : "copies"})`
              : `littlecolorbook.com ${selectedOffer.title}`,
          description:
            deliveryMode === "print"
              ? `${selectedOffer.designs} personalized pages, ${quantity} printed ${quantity === 1 ? "copy" : "copies"}, plus the PDF download`
              : `${selectedOffer.designs} personalized pages as a PDF download`,
        },
      },
    },
  ];

  if (shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: shippingCents,
        product_data: {
          name: "littlecolorbook.com Shipping",
          description: selectedQuote?.label ?? parsed.data.shippingLabel ?? "Print shipping",
        },
      },
    });
  }

  const portalAccess = isDatabaseConfigured()
    ? await (await import("@littlecolorbook/db")).createPortalAccessForOrder(orderId)
    : null;
  const successUrl = portalAccess?.portalHref
    ? `${appUrl}${portalAccess.portalHref}/setup`
    : `${appUrl}/order/confirmation?orderId=${orderId}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: orderId,
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: `${appUrl}/create/uploads?orderId=${orderId}&deliveryMode=${deliveryMode}&selectedOffer=${selectedOffer.code}`,
    line_items: lineItems,
    metadata: {
      orderId,
      selectedOfferCode: selectedOffer.code,
      quantity: String(quantity),
      bundleSelection: bundleSelection ?? "",
      selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? "",
      shippingLabel: selectedQuote?.label ?? parsed.data.shippingLabel ?? "",
      shippingCents: String(shippingCents),
    },
    payment_intent_data: {
      metadata: {
        orderId,
        selectedOfferCode: selectedOffer.code,
        deliveryMode,
        quantity: String(quantity),
        bundleSelection: bundleSelection ?? "",
      },
    },
  });

  if (isDatabaseConfigured()) {
    await attachStripeCheckoutSessionToOrder({
      orderId,
      stripeCheckoutSessionId: session.id,
      selectedOfferCode: selectedOffer.code,
      quantity,
      bundleSelection,
      shippingQuoteId: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
    });
  }

  return NextResponse.json({
    orderId,
    status: "checkout_session_created",
    quantity,
    selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
    checkoutUrl: session.url,
    sessionId: session.id,
    subtotalCents,
    shippingCents,
    stripeConfigured: true,
    databaseConfigured: isDatabaseConfigured(),
  });
}
