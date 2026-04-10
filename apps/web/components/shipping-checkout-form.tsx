"use client";

import Link from "next/link";
import { defaultOffer, getOfferByCode } from "@littlecolorbook/shared";
import { useMemo, useState } from "react";
import { trackEvent } from "./analytics-provider";

type ShippingCheckoutFormProps = {
  orderId?: string;
  selectedOffer?: string;
  quantity?: number;
  bundleSelection?: string | null;
  subtotalCents?: number;
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

async function readApiPayload<T>(response: Response) {
  const raw = await response.text();

  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

export function ShippingCheckoutForm({ orderId, selectedOffer, quantity = 1, bundleSelection, subtotalCents }: ShippingCheckoutFormProps) {
  const offer = getOfferByCode(selectedOffer ?? defaultOffer);
  const orderSubtotalCents = subtotalCents ?? offer.subtotalCents;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedQuote = useMemo(() => quotes.find((quote) => quote.id === selectedQuoteId) ?? null, [quotes, selectedQuoteId]);

  if (!orderId) {
    return (
      <section className="builder-card">
        <span className="pill pill-coral">Delivery</span>
        <h1>Choose the printed book first, then pick delivery.</h1>
        <p className="lede">Once you have a print order started, this page shows live shipping choices and final checkout totals.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/create?offer=print-30">
            Go to Book Builder
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
          quantity,
          bundleSelection,
        }),
      });

      const payload = await readApiPayload<QuoteResponse>(response);

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
      setErrorMessage("Choose a delivery option before checkout.");
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
          quantity,
          bundleSelection,
          shippingCents: selectedQuote.shippingCents,
          shippingLabel: selectedQuote.label,
        }),
      });

      const payload = await readApiPayload<CheckoutResponse>(response);

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Could not start checkout.");
      }

      trackEvent("checkout_started", {
        deliveryMode: "print",
        orderId,
        selectedOffer: offer.code,
        quantity,
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
      <span className="pill pill-coral">Delivery</span>
      <h1>Where should we send the spiral book?</h1>
      <p className="lede">Enter the shipping address to see live delivery choices. You'll choose the best arrival option before payment.</p>

      <div className="surface selection-summary">
        <span className="pill pill-mint">Your printed set</span>
        <h3>
          {quantity} printed {quantity === 1 ? "copy" : "copies"}
        </h3>
        <p className="muted">{offer.title} with the PDF included. Shipping is quoted separately after you enter the address.</p>
      </div>

      <div className="detail-grid three-up">
        <article className="surface detail-card">
          <span className="pill pill-sky">1 business day</span>
          <p className="muted">Our target to get the finished print file moving toward production.</p>
        </article>
        <article className="surface detail-card">
          <span className="pill pill-sun">3-5 business days</span>
          <p className="muted">Typical Lulu print and bind window once the job is in production.</p>
        </article>
        <article className="surface detail-card">
          <span className="pill pill-mint">You choose transit</span>
          <p className="muted">Live delivery options show up after you enter the address below.</p>
        </article>
      </div>

      <form className="upload-stack" onSubmit={handleQuote}>
        <div className="form-grid">
          <label>
            <span className="muted">Full name</span>
            <input className="input" name="fullName" placeholder="Jordan Smith" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            <span className="muted">Phone</span>
            <input className="input" name="phone" placeholder="(555) 555-0142" required value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label>
            <span className="muted">Address</span>
            <input className="input" name="line1" placeholder="123 Cottonwood Lane" required value={line1} onChange={(event) => setLine1(event.target.value)} />
          </label>
          <label>
            <span className="muted">Address line 2</span>
            <input className="input" name="line2" value={line2} onChange={(event) => setLine2(event.target.value)} />
          </label>
          <label>
            <span className="muted">City</span>
            <input className="input" name="city" placeholder="Denver" required value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label>
            <span className="muted">State</span>
            <input className="input" name="state" placeholder="CO" required value={state} onChange={(event) => setState(event.target.value)} />
          </label>
          <label>
            <span className="muted">ZIP code</span>
            <input className="input" name="postalCode" placeholder="80202" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </label>
        </div>

        <div className="status-banner status-banner-progress">
          <strong>US shipping only in v1</strong>
          <span>Production still runs first. The shipping choice below changes transit speed after the book is printed.</span>
        </div>

        <div className="hero-actions">
          <button className="button button-secondary" disabled={isQuoting} type="submit">
            {isQuoting ? "Getting delivery options..." : "Show Delivery Options"}
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
                  <span className="pill pill-sky">{quote.label}</span>
                  <h3>{formatMoney(quote.shippingCents)}</h3>
                  <p className="muted">Estimated arrival: {quote.window}</p>
                </button>
              );
            })}
          </div>
          <div className="surface selection-summary">
            <span className="pill pill-coral">Checkout total</span>
            <h3>{formatMoney(orderSubtotalCents + (selectedQuote?.shippingCents ?? 0))}</h3>
            <p className="muted">
              {quantity} printed {quantity === 1 ? "copy" : "copies"} plus {selectedQuote ? selectedQuote.label.toLowerCase() : "selected delivery"}
            </p>
            <p className="mini-note">Your printed book still includes the PDF version too.</p>
          </div>
        </div>
      ) : null}

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions">
        <button className="button button-primary" disabled={!selectedQuote || isSubmitting} type="button" onClick={handleCheckout}>
          {isSubmitting ? "Starting checkout..." : "Continue to Secure Checkout"}
        </button>
        <Link className="button button-secondary" href={`/create?offer=${encodeURIComponent(offer.code)}`}>
          Back to Book Choice
        </Link>
      </div>
    </section>
  );
}
