import { NextRequest, NextResponse } from "next/server";
import {
  attachStripeCheckoutSessionToOrder,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getAppUrl, getStripe, getVerifiedStripeAccountId, isStripeConfigured } from "../../../../../lib/stripe";
import { z } from "zod";

const checkoutRequestSchema = z.object({
  selectedQuote: z.string().trim().optional(),
  selectedOffer: z.string().trim().optional(),
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
  const fallbackOffer = getOfferByCode(parsed.data.selectedOffer ?? order?.selectedOfferCode ?? "pdf-30");
  const deliveryMode = order?.deliveryMode ?? (fallbackOffer.format === "print" ? "print" : "pdf");
  const customerEmail = summary?.customer?.email ?? undefined;
  const selectedQuote =
    deliveryMode === "print"
      ? (summary?.quotes.find((quote) => quote.id === parsed.data.selectedQuote) ??
        summary?.quotes.find((quote) => quote.isSelected) ??
        null)
      : null;

  if (deliveryMode === "print" && isDatabaseConfigured() && !selectedQuote) {
    return NextResponse.json({ error: "Select a shipping option before checkout." }, { status: 400 });
  }

  const subtotalCents = order?.subtotalCents ?? fallbackOffer.subtotalCents;
  const shippingCents = selectedQuote?.shippingCents ?? parsed.data.shippingCents ?? 0;
  const unitAmount = subtotalCents + shippingCents;

  if (!isStripeConfigured()) {
    if (!allowDevCheckoutFallback()) {
      return NextResponse.json({ error: "Stripe is not configured for checkout." }, { status: 503 });
    }

    return NextResponse.json({
      orderId,
      status: "checkout_session_created",
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
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: orderId,
    customer_email: customerEmail,
    success_url: `${appUrl}/order/confirmation?orderId=${orderId}`,
    cancel_url: `${appUrl}/create/uploads?orderId=${orderId}&deliveryMode=${deliveryMode}&selectedOffer=${fallbackOffer.code}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: `littlecolorbook.com ${fallbackOffer.title}`,
            description: `${fallbackOffer.designs} personalized designs${deliveryMode === "print" ? " with printed copy" : " as a PDF"}`,
          },
        },
      },
    ],
    metadata: {
      orderId,
      selectedOfferCode: fallbackOffer.code,
      selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? "",
      shippingLabel: selectedQuote?.label ?? parsed.data.shippingLabel ?? "",
      shippingCents: String(shippingCents),
    },
    payment_intent_data: {
      metadata: {
        orderId,
        selectedOfferCode: fallbackOffer.code,
        deliveryMode,
      },
    },
  });

  if (isDatabaseConfigured()) {
    await attachStripeCheckoutSessionToOrder({
      orderId,
      stripeCheckoutSessionId: session.id,
      shippingQuoteId: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
    });
  }

  return NextResponse.json({
    orderId,
    status: "checkout_session_created",
    selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
    checkoutUrl: session.url,
    sessionId: session.id,
    stripeConfigured: true,
    databaseConfigured: isDatabaseConfigured(),
  });
}
