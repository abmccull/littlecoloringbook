"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "./analytics-provider";

type SampleOfferCheckoutButtonProps = {
  offerCode: string;
  deliveryMode: "pdf" | "print";
  sampleOrderId: string;
  customerEmail: string | null;
  childFirstName?: string | null;
  acquisitionPath?: string;
  entrySource?: string;
  className?: string;
  children: React.ReactNode;
};

export function SampleOfferCheckoutButton({
  offerCode,
  deliveryMode,
  sampleOrderId,
  customerEmail,
  childFirstName,
  acquisitionPath,
  entrySource,
  className,
  children,
}: SampleOfferCheckoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  function handleClick() {
    setIsLoading(true);

    const params = new URLSearchParams({
      offer: offerCode,
      source: entrySource ?? "sample-ready-page",
      acquisitionPath: acquisitionPath ?? "sample_first",
    });

    if (customerEmail) {
      params.set("email", customerEmail);
    }

    if (childFirstName) {
      params.set("childFirstName", childFirstName);
    }

    if (sampleOrderId) {
      params.set("sampleOrderId", sampleOrderId);
    }

    trackEvent("sample_offer_builder_clicked", {
      offerCode,
      deliveryMode,
      sampleOrderId,
      source: entrySource ?? "sample-ready-page",
    });

    router.push(`/create?${params.toString()}`);
  }

  return (
    <div className="offer-checkout-action">
      <button
        className={className ?? "button button-primary"}
        disabled={isLoading}
        type="button"
        onClick={handleClick}
      >
        {isLoading ? "Opening builder..." : children}
      </button>
    </div>
  );
}
