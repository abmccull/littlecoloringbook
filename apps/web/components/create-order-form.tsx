"use client";

import { offers, type Offer, type OfferCode } from "@littlecolorbook/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { trackEvent } from "./analytics-provider";

type DeliveryMode = "pdf" | "print";

type CreateOrderResponse = {
  id: string;
  selectedOffer: string;
};

const offerOptions: Record<DeliveryMode, Offer[]> = {
  pdf: offers.filter((offer) => offer.format === "pdf"),
  print: offers.filter((offer) => offer.format === "print"),
};

function findOfferForMode(mode: DeliveryMode, designs: number) {
  return offerOptions[mode].find((offer) => offer.designs === designs) ?? offerOptions[mode][0];
}

export function CreateOrderForm() {
  const router = useRouter();
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("pdf");
  const [selectedOfferCode, setSelectedOfferCode] = useState<OfferCode>("pdf-30");
  const [email, setEmail] = useState("parent@example.com");
  const [childFirstName, setChildFirstName] = useState("Mila");
  const [dedicationText, setDedicationText] = useState("Made for rainy afternoons, road trips, and grandma visits.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedOffer = useMemo(
    () => offerOptions[deliveryMode].find((offer) => offer.code === selectedOfferCode) ?? findOfferForMode(deliveryMode, 30),
    [deliveryMode, selectedOfferCode],
  );

  function handleModeChange(nextMode: DeliveryMode) {
    const mappedOffer = findOfferForMode(nextMode, selectedOffer.designs);
    setDeliveryMode(nextMode);
    setSelectedOfferCode(mappedOffer.code);
    trackEvent("builder_mode_selected", {
      deliveryMode: nextMode,
      selectedOffer: mappedOffer.code,
      designCount: mappedOffer.designs,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          orderType: deliveryMode,
          deliveryMode,
          selectedOffer: selectedOffer.code,
          designCount: selectedOffer.designs,
          childFirstName,
          dedicationText,
        }),
      });

      const payload = (await response.json()) as CreateOrderResponse & { error?: string };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Could not create the order draft.");
      }

      trackEvent("order_draft_created", {
        deliveryMode,
        selectedOffer: selectedOffer.code,
        designCount: selectedOffer.designs,
      });

      const nextUrl = new URL("/create/uploads", window.location.origin);
      nextUrl.searchParams.set("orderId", payload.id);
      nextUrl.searchParams.set("deliveryMode", deliveryMode);
      nextUrl.searchParams.set("selectedOffer", selectedOffer.code);
      router.push(nextUrl.pathname + "?" + nextUrl.searchParams.toString());
    } catch (error) {
      trackEvent("order_draft_failed", {
        deliveryMode,
        selectedOffer: selectedOffer.code,
      });
      setErrorMessage(error instanceof Error ? error.message : "Could not start the order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="builder-card">
      <span className="pill">Builder</span>
      <h1>Configure the paid order.</h1>
      <p className="lede">
        The paid flow now creates a real order draft first, then carries that order through uploads, checkout, and the portal.
      </p>

      <form className="upload-stack" onSubmit={handleSubmit}>
        <div className="toggle-row">
          <button
            className={deliveryMode === "pdf" ? "active" : undefined}
            type="button"
            onClick={() => handleModeChange("pdf")}
          >
            PDF
          </button>
          <button
            className={deliveryMode === "print" ? "active" : undefined}
            type="button"
            onClick={() => handleModeChange("print")}
          >
            Print + PDF
          </button>
        </div>

        <div className="offer-switch">
          {offerOptions[deliveryMode].map((offer) => (
            <button
              key={offer.code}
              className={offer.code === selectedOffer.code ? "active" : undefined}
              type="button"
              onClick={() => {
                setSelectedOfferCode(offer.code);
                trackEvent("builder_offer_selected", {
                  deliveryMode,
                  selectedOffer: offer.code,
                  designCount: offer.designs,
                });
              }}
            >
              {offer.designs} Designs
            </button>
          ))}
        </div>

        <div className="surface">
          <span className="pill">Selected offer</span>
          <h3>{selectedOffer.title}</h3>
          <p className="muted">{selectedOffer.priceLabel}</p>
          {selectedOffer.highlight ? <p className="muted">{selectedOffer.highlight}</p> : null}
        </div>

        <div className="form-grid">
          <label>
            <span className="muted">Email</span>
            <input className="input" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span className="muted">Child first name</span>
            <input className="input" value={childFirstName} onChange={(event) => setChildFirstName(event.target.value)} />
          </label>
        </div>

        <label>
          <span className="muted">Dedication (optional)</span>
          <textarea className="textarea" value={dedicationText} onChange={(event) => setDedicationText(event.target.value)} />
        </label>

        {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

        <div className="hero-actions">
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Starting order..." : "Continue to Uploads"}
          </button>
        </div>
      </form>
    </section>
  );
}
