"use client";

import Link from "next/link";
import { defaultOffer, getOfferByCode } from "@littlecolorbook/shared";
import { useMemo, useState } from "react";
import { trackEvent } from "./analytics-provider";

type ShippingCheckoutFormProps = {
  orderId?: string;
  selectedOffer?: string;
};

type Quote = {
  id: string;
  service: string;
  label: string;
  shippingCents: number;
  window: string;
  isSelected: boolean;
};

type QuoteResponse = {
  quotes?: Quote[];
  error?: string;
};

type CheckoutResponse = {
  checkoutUrl?: string;
  error?: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ShippingCheckoutForm({ orderId, selectedOffer }: ShippingCheckoutFormProps) {
  const offer = getOfferByCode(selectedOffer ?? defaultOffer);
  const [fullName, setFullName] = useState("Parent Example");
  const [phone, setPhone] = useState("(555) 555-0142");
  const [line1, setLine1] = useState("123 Cottonwood Lane");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("Denver");
  const [state, setState] = useState("CO");
  const [postalCode, setPostalCode] = useState("80202");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId],
  );

  if (!orderId) {
    return (
      <section className="builder-card">
        <span className="pill">Print shipping</span>
        <h1>Start from the builder first.</h1>
        <p className="lede">Shipping quotes need a real order ID so the selected quote can be attached before checkout starts.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/create">
            Go to Builder
          </Link>
        </div>
      </section>
    );
  }

  async function handleQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsQuoting(true);
    setErrorMessage(null);
    trackEvent("shipping_quote_requested", {
      orderId,
      selectedOffer: offer.code,
    });

    try {
      const response = await fetch(`/api/orders/${orderId}/quote-shipping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          phone,
          line1,
          line2,
          city,
          state,
          postalCode,
          countryCode: "US",
        }),
      });

      const payload = (await response.json()) as QuoteResponse;

      if (!response.ok || !payload.quotes) {
        throw new Error(payload.error ?? "Could not quote shipping.");
      }

      setQuotes(payload.quotes);
      setSelectedQuoteId(payload.quotes.find((quote) => quote.isSelected)?.id ?? payload.quotes[0]?.id ?? null);
      trackEvent("shipping_quote_received", {
        orderId,
        quoteCount: payload.quotes.length,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not quote shipping.");
    } finally {
      setIsQuoting(false);
    }
  }

  async function handleCheckout() {
    if (!selectedQuote) {
      setErrorMessage("Choose a shipping option before checkout.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedQuote: selectedQuote.id,
          selectedOffer: offer.code,
          shippingCents: selectedQuote.shippingCents,
          shippingLabel: selectedQuote.label,
        }),
      });

      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Could not start checkout.");
      }

      trackEvent("checkout_started", {
        deliveryMode: "print",
        orderId,
        selectedOffer: offer.code,
        shippingQuote: selectedQuote.id,
      });

      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="builder-card">
      <span className="pill">Print shipping</span>
      <h1>Quote shipping for the printed book.</h1>
      <p className="lede">
        Enter the final shipping address to get live Lulu shipping options. Faster shipping reduces transit time after production, not Lulu print time itself.
      </p>

      <form className="upload-stack" onSubmit={handleQuote}>
        <div className="form-grid">
          <label>
            <span className="muted">Full name</span>
            <input className="input" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            <span className="muted">Phone</span>
            <input className="input" required value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label>
            <span className="muted">Address</span>
            <input className="input" required value={line1} onChange={(event) => setLine1(event.target.value)} />
          </label>
          <label>
            <span className="muted">Address line 2</span>
            <input className="input" value={line2} onChange={(event) => setLine2(event.target.value)} />
          </label>
          <label>
            <span className="muted">City</span>
            <input className="input" required value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label>
            <span className="muted">State</span>
            <input className="input" required value={state} onChange={(event) => setState(event.target.value)} />
          </label>
          <label>
            <span className="muted">ZIP code</span>
            <input className="input" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </label>
        </div>

        <div className="status-banner">US-only in v1. Faster shipping reduces transit time, not production time.</div>

        <div className="hero-actions">
          <button className="button button-secondary" disabled={isQuoting} type="submit">
            {isQuoting ? "Quoting shipping..." : "Get Shipping Options"}
          </button>
        </div>
      </form>

      {quotes.length > 0 ? (
        <div className="upload-stack">
          <div className="stat-row">
            {quotes.map((quote) => {
              const isActive = quote.id === selectedQuoteId;
              return (
                <button
                  className={`surface${isActive ? " active-surface" : ""}`}
                  key={quote.id}
                  type="button"
                  onClick={() => setSelectedQuoteId(quote.id)}
                >
                  <span className="pill">{quote.label}</span>
                  <h3>{formatMoney(quote.shippingCents)}</h3>
                  <p className="muted">Estimated delivery: {quote.window}</p>
                </button>
              );
            })}
          </div>
          <div className="surface">
            <span className="pill">Checkout total</span>
            <h3>{formatMoney(offer.subtotalCents + (selectedQuote?.shippingCents ?? 0))}</h3>
            <p className="muted">
              {offer.title} plus {selectedQuote ? selectedQuote.label.toLowerCase() : "selected shipping"}
            </p>
          </div>
        </div>
      ) : null}

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions">
        <button className="button button-primary" disabled={!selectedQuote || isSubmitting} type="button" onClick={handleCheckout}>
          {isSubmitting ? "Starting checkout..." : "Continue to Checkout"}
        </button>
        <Link className="button button-secondary" href={`/order/${encodeURIComponent(orderId)}`}>
          View Order Portal
        </Link>
      </div>
    </section>
  );
}
