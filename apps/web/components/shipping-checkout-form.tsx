"use client";

import Link from "next/link";
import { defaultOffer, getOfferByCode } from "@littlecolorbook/shared";
import { useMemo, useState } from "react";
import { trackBuyerJourneyStage, trackEvent } from "./analytics-provider";

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
        <h1>Choose the spiral book first, then pick delivery.</h1>
        <p className="lede">Once your print order is started, this page shows real delivery choices and your final total before payment.</p>
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
        throw new Error(payload.error ?? "We couldn't load delivery choices. Please try again.");
      }

      setQuotes(payload.quotes);
      setSelectedQuoteId(payload.quotes.find((quote) => quote.isSelected)?.id ?? payload.quotes[0]?.id ?? null);
      trackEvent("shipping_quote_received", {
        orderId,
        quoteCount: payload.quotes.length,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't load delivery choices. Please try again.");
    } finally {
      setIsQuoting(false);
    }
  }

  async function handleCheckout() {
    if (!selectedQuote) {
      setErrorMessage("Choose a delivery option before you head to checkout.");
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
        throw new Error(payload.error ?? "We couldn't open checkout. Please try again.");
      }

      trackEvent("checkout_started", {
        deliveryMode: "print",
        orderId,
        selectedOffer: offer.code,
        quantity,
        shippingQuote: selectedQuote.id,
      });
      trackBuyerJourneyStage(
        "checkout_started",
        {
          orderId,
          deliveryMode: "print",
          selectedOffer: offer.code,
          quantity,
          shippingQuote: selectedQuote.id,
          surface: "shipping_checkout_step",
        },
        {
          onceKey: `checkout-started:${orderId}`,
        },
      );

      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't open checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="builder-card">
      <span className="pill pill-coral">Delivery</span>
      <h1>Where should we send the spiral book?</h1>
      <p className="lede">Add the shipping address to see real delivery choices before payment. Your PDF still comes with it either way.</p>

      <div className="surface selection-summary">
        <span className="pill pill-mint">Your giftable set</span>
        <h3>
          {quantity} printed {quantity === 1 ? "copy" : "copies"}
        </h3>
        <p className="muted">{offer.title} with the PDF included. Shipping gets added after you pick the delivery speed that fits.</p>
      </div>

      <div className="detail-grid three-up">
        <article className="surface detail-card">
          <span className="pill pill-sky">Usually within 1 business day</span>
          <p className="muted">That is our target to get your finished book moving toward print.</p>
        </article>
        <article className="surface detail-card">
          <span className="pill pill-sun">3-5 business days</span>
          <p className="muted">Typical print-and-bind window once the book reaches production.</p>
        </article>
        <article className="surface detail-card">
          <span className="pill pill-mint">You choose the arrival speed</span>
          <p className="muted">Delivery options show up right after you enter the address below.</p>
        </article>
      </div>

      <form className="upload-stack" onSubmit={handleQuote}>
        <div className="form-grid">
          <label>
            <span className="muted">Full name</span>
            <input
              autoComplete="name"
              className="input"
              name="fullName"
              placeholder="Jordan Smith"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
          <label>
            <span className="muted">Phone</span>
            <input
              autoComplete="tel"
              className="input"
              inputMode="tel"
              name="phone"
              placeholder="(555) 555-0142"
              required
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label>
            <span className="muted">Address</span>
            <input
              autoComplete="address-line1"
              className="input"
              name="line1"
              placeholder="123 Cottonwood Lane"
              required
              value={line1}
              onChange={(event) => setLine1(event.target.value)}
            />
          </label>
          <label>
            <span className="muted">Address line 2</span>
            <input autoComplete="address-line2" className="input" name="line2" value={line2} onChange={(event) => setLine2(event.target.value)} />
          </label>
          <label>
            <span className="muted">City</span>
            <input
              autoComplete="address-level2"
              className="input"
              name="city"
              placeholder="Denver"
              required
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <label>
            <span className="muted">State</span>
            <input
              autoComplete="address-level1"
              className="input"
              name="state"
              placeholder="CO"
              required
              value={state}
              onChange={(event) => setState(event.target.value)}
            />
          </label>
          <label>
            <span className="muted">ZIP code</span>
            <input
              autoComplete="postal-code"
              className="input"
              inputMode="numeric"
              name="postalCode"
              placeholder="80202"
              required
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
            />
          </label>
        </div>

        <div className="status-banner status-banner-progress">
          <strong>US shipping only for now</strong>
          <span>Your delivery choice changes transit time after the book is printed and bound.</span>
        </div>

        <div className="hero-actions hero-actions-mobile-bar">
          <button className="button button-secondary" disabled={isQuoting} type="submit">
            {isQuoting ? "Getting delivery choices..." : "Show Delivery Choices"}
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
            <span className="pill pill-coral">Your total today</span>
            <h3>{formatMoney(orderSubtotalCents + (selectedQuote?.shippingCents ?? 0))}</h3>
            <p className="muted">
              {quantity} printed {quantity === 1 ? "copy" : "copies"} plus {selectedQuote ? selectedQuote.label.toLowerCase() : "selected delivery"}
            </p>
            <p className="mini-note">The PDF is still included, so you can print at home while the spiral book is on the way.</p>
          </div>
        </div>
      ) : null}

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions hero-actions-mobile-bar">
        <button className="button button-primary" disabled={!selectedQuote || isSubmitting} type="button" onClick={handleCheckout}>
          {isSubmitting ? "Starting checkout..." : "Go to Secure Checkout"}
        </button>
        <Link className="button button-secondary" href={`/create?offer=${encodeURIComponent(offer.code)}`}>
          Back to photo upload
        </Link>
      </div>
    </section>
  );
}
