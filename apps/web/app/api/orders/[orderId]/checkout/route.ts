import { NextRequest, NextResponse } from "next/server";
import {
  applyPaidOrderUpgrade,
  attachStripeCheckoutSessionToOrder,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
  updateOrderClientIp,
} from "@littlecolorbook/db";
import { getNormalizedOrderQuantity, getOfferByCode, getOfferSubtotalForQuantity } from "@littlecolorbook/shared";
import { getAppUrl, getStripe, getVerifiedStripeAccountId, isStripeConfigured } from "../../../../../lib/stripe";
import { extractClientIp, extractClientUserAgent } from "../../../../../lib/request-ip";
import { z } from "zod";

const checkoutRequestSchema = z.object({
  selectedQuote: z.string().trim().optional(),
  selectedOffer: z.string().trim().optional(),
  quantity: z.number().int().positive().optional(),
  bundleSelection: z.string().trim().optional(),
  shippingCents: z.number().int().nonnegative().optional(),
  shippingLabel: z.string().trim().optional(),
  // Meta click cookies — client pixel reads `_fbc` / `_fbp` and posts
  // them so we can store them alongside the Stripe session. Webhook uses
  // them to build a high-EMQ CAPI Purchase event.
  fbc: z.string().trim().max(200).optional(),
  fbp: z.string().trim().max(200).optional(),
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
  const deliveryMode = selectedOffer.format === "print" ? "print" : "pdf";
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
  const targetTotalCents = subtotalCents + shippingCents;
  const isPaidUpgrade =
    order?.status === "paid" &&
    (order.selectedOfferCode !== selectedOffer.code ||
      order.quantity !== quantity ||
      (order.bundleSelection ?? null) !== (bundleSelection ?? null) ||
      order.shippingCents !== shippingCents ||
      order.deliveryMode !== deliveryMode);

  if (!isStripeConfigured()) {
    if (!allowDevCheckoutFallback()) {
      return NextResponse.json({ error: "Stripe is not configured for checkout." }, { status: 503 });
    }

    if (isPaidUpgrade && order) {
      await applyPaidOrderUpgrade({
        orderId,
        selectedOfferCode: selectedOffer.code,
        quantity,
        bundleSelection,
        shippingQuoteId: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
        shippingCents,
      });
    }

    return NextResponse.json({
      orderId,
      status: "checkout_session_created",
      quantity,
      selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
      checkoutUrl: order ? `/order/confirmation?orderId=${orderId}` : `/order/confirmation?orderId=${orderId}`,
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

  const clientIp = extractClientIp(request);
  const clientUserAgent = extractClientUserAgent(request);
  if (isDatabaseConfigured() && clientIp && clientIp !== "unknown") {
    try {
      await updateOrderClientIp(orderId, clientIp);
    } catch (error) {
      console.error("checkout: failed to persist client IP on order", error);
    }
  }

  // Meta click identifiers captured on the client and forwarded here.
  // Stored in Stripe metadata so the post-payment webhook can include
  // them in the CAPI Purchase event for high-EMQ match.
  const fbc = parsed.data.fbc ?? "";
  const fbp = parsed.data.fbp ?? "";

  if (isPaidUpgrade && order) {
    const deltaCents = targetTotalCents - order.totalCents;

    if (deltaCents <= 0) {
      return NextResponse.json({ error: "This upgrade does not increase the order total." }, { status: 400 });
    }

    const upgradePortalAccess = isDatabaseConfigured()
      ? await (await import("@littlecolorbook/db")).createPortalAccessForOrder(orderId)
      : null;
    const upgradeReturnUrl = upgradePortalAccess?.portalHref
      ? `${appUrl}${upgradePortalAccess.portalHref}/setup`
      : `${appUrl}/order/confirmation?orderId=${orderId}`;

    const upgradeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: orderId,
      customer_email: customerEmail,
      success_url: upgradeReturnUrl,
      cancel_url: upgradeReturnUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: deltaCents,
            product_data: {
              name: `littlecolorbook.com Order Upgrade`,
              description:
                deliveryMode === "print"
                  ? `${selectedOffer.title} upgrade${shippingCents > 0 ? " plus updated shipping" : ""}`
                  : `${selectedOffer.title} page upgrade`,
            },
          },
        },
      ],
      metadata: {
        orderId,
        checkoutKind: "order_upgrade",
        selectedOfferCode: selectedOffer.code,
        quantity: String(quantity),
        bundleSelection: bundleSelection ?? "",
        selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? "",
        shippingCents: String(shippingCents),
        targetTotalCents: String(targetTotalCents),
        ...(fbc ? { fbc: fbc.slice(0, 500) } : {}),
        ...(fbp ? { fbp: fbp.slice(0, 500) } : {}),
        ...(clientUserAgent ? { clientUserAgent: clientUserAgent.slice(0, 500) } : {}),
      },
      payment_intent_data: {
        metadata: {
          orderId,
          checkoutKind: "order_upgrade",
          selectedOfferCode: selectedOffer.code,
          deliveryMode,
          quantity: String(quantity),
          bundleSelection: bundleSelection ?? "",
          selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? "",
          shippingCents: String(shippingCents),
          targetTotalCents: String(targetTotalCents),
        },
      },
    });

    return NextResponse.json({
      orderId,
      status: "checkout_session_created",
      quantity,
      selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? null,
      checkoutUrl: upgradeSession.url,
      sessionId: upgradeSession.id,
      subtotalCents,
      shippingCents,
      deltaCents,
      stripeConfigured: true,
      databaseConfigured: isDatabaseConfigured(),
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: orderId,
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: portalAccess?.portalHref
      ? `${appUrl}${portalAccess.portalHref}`
      : `${appUrl}/create?offer=${selectedOffer.code}`,
    line_items: lineItems,
    metadata: {
      orderId,
      selectedOfferCode: selectedOffer.code,
      quantity: String(quantity),
      bundleSelection: bundleSelection ?? "",
      selectedQuote: selectedQuote?.id ?? parsed.data.selectedQuote ?? "",
      shippingLabel: selectedQuote?.label ?? parsed.data.shippingLabel ?? "",
      shippingCents: String(shippingCents),
      // Truncate to Stripe's 500-char metadata-value limit (fbc/fbp are
      // well under, but defensive) and omit empty strings to keep the
      // metadata object tidy. User agent is captured here because the
      // post-payment webhook no longer has access to the original browser
      // request headers.
      ...(fbc ? { fbc: fbc.slice(0, 500) } : {}),
      ...(fbp ? { fbp: fbp.slice(0, 500) } : {}),
      ...(clientUserAgent ? { clientUserAgent: clientUserAgent.slice(0, 500) } : {}),
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
