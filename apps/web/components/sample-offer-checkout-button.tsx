"use client";

import { useState } from "react";
import { trackEvent } from "./analytics-provider";

type SampleOfferCheckoutButtonProps = {
  offerCode: string;
  deliveryMode: "pdf" | "print";
  sampleOrderId: string;
  customerEmail: string | null;
  acquisitionPath?: string;
  entrySource?: string;
  className?: string;
  children: React.ReactNode;
};

type CreateOrderResponse = {
  id: string;
  portalToken: string;
  error?: string;
};

type CheckoutResponse = {
  checkoutUrl: string;
  error?: string;
};

export function SampleOfferCheckoutButton({
  offerCode,
  deliveryMode,
  sampleOrderId,
  customerEmail,
  acquisitionPath,
  entrySource,
  className,
  children,
}: SampleOfferCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setErrorMessage(null);

    trackEvent("sample_offer_checkout_clicked", {
      offerCode,
      deliveryMode,
      sampleOrderId,
    });

    try {
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmail ?? undefined,
          orderType: deliveryMode,
          deliveryMode,
          selectedOffer: offerCode,
          acquisitionPath: acquisitionPath ?? "sample_first",
          entrySource: entrySource ?? "sample-ready-page",
          sampleOrderId,
        }),
      });

      const orderPayload = (await orderResponse.json()) as CreateOrderResponse;

      if (!orderResponse.ok || !orderPayload.id) {
        throw new Error(orderPayload.error ?? "We could not start your order. Please try again.");
      }

      const checkoutResponse = await fetch(`/api/orders/${orderPayload.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const checkoutPayload = (await checkoutResponse.json()) as CheckoutResponse;

      if (!checkoutResponse.ok || !checkoutPayload.checkoutUrl) {
        throw new Error(checkoutPayload.error ?? "We could not open checkout. Please try again.");
      }

      window.location.href = checkoutPayload.checkoutUrl;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="offer-checkout-action">
      <button
        className={className ?? "button button-primary"}
        disabled={isLoading}
        type="button"
        onClick={handleClick}
      >
        {isLoading ? "Opening checkout..." : children}
      </button>
      {errorMessage ? (
        <div className="status-banner status-banner-warning" role="alert">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
