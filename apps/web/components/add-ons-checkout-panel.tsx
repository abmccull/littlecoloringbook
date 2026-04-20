"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getOfferByCode,
  getOfferSubtotalForQuantity,
  type Offer,
  type OfferCode,
  type PrintBundleCode,
} from "@littlecolorbook/shared";
import { trackEvent } from "./analytics-provider";
import { readMetaClickIds } from "../lib/meta-click-ids";

type AddOnsCheckoutPanelProps = {
  orderId: string;
  selectedOffer: string;
  uploadedCount: number;
  onCheckoutComplete?: () => void;
};

type AddOnSelection = {
  /** Whether to upgrade from PDF-only to the spiral print + PDF combo */
  upgradeToSpiralBook: boolean;
  /** Extra printed copies beyond the base quantity, as a bundle code */
  printBundleCode: PrintBundleCode | null;
  /** Names for additional copies (up to 3) */
  copyNames: string[];
  /** Number of additional gift copies the user wants to add */
  giftCopyCount: number;
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
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

type BundleOption = {
  code: PrintBundleCode;
  quantity: number;
  label: string;
  description: string;
  pillTone: "mint" | "coral" | "sun" | "sky";
};

const bundleOptions: BundleOption[] = [
  {
    code: "set-of-2",
    quantity: 2,
    label: "Add one more copy",
    description: "Two printed copies total. Good for siblings or a grandparent gift.",
    pillTone: "mint",
  },
  {
    code: "set-of-3",
    quantity: 3,
    label: "Add two more copies",
    description: "Three printed copies total. Enough for both grandparent households or sibling gifts.",
    pillTone: "coral",
  },
  {
    code: "set-of-5",
    quantity: 5,
    label: "Add four more copies",
    description: "Five printed copies total. The full family pack.",
    pillTone: "sun",
  },
];

const MAX_GIFT_NAMES = 3;

export function AddOnsCheckoutPanel({ orderId, selectedOffer, uploadedCount, onCheckoutComplete }: AddOnsCheckoutPanelProps) {
  const offer = useMemo(() => getOfferByCode(selectedOffer), [selectedOffer]);
  const isPdfOffer = offer.format === "pdf";
  const isPrintOffer = offer.format === "print";

  // Derive the matching print offer for the PDF-to-spiral upgrade
  const spiralOffer = useMemo<Offer | null>(() => {
    if (!isPdfOffer) return null;
    return getOfferByCode(`print-${offer.designs}` as OfferCode);
  }, [isPdfOffer, offer.designs]);

  const [upgradeSpiralBook, setUpgradeSpiralBook] = useState(false);
  const [printBundleCode, setPrintBundleCode] = useState<PrintBundleCode | null>(null);
  const [giftCopyCount, setGiftCopyCount] = useState(0);
  const [giftNames, setGiftNames] = useState<string[]>(["", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeOffer = upgradeSpiralBook && spiralOffer ? spiralOffer : offer;

  const baseSubtotalCents = useMemo(() => {
    if (printBundleCode && activeOffer.format === "print") {
      return getOfferSubtotalForQuantity(activeOffer, {
        bundleSelection: printBundleCode,
        quantity: bundleOptions.find((b) => b.code === printBundleCode)?.quantity ?? 1,
      });
    }
    return activeOffer.subtotalCents;
  }, [activeOffer, printBundleCode]);

  const summaryItems = useMemo(() => {
    const items: { label: string; value: string }[] = [];

    if (upgradeSpiralBook && spiralOffer) {
      items.push({ label: "Upgrade to Spiral Book", value: formatMoney(spiralOffer.subtotalCents - offer.subtotalCents) });
    }

    if (printBundleCode && (upgradeSpiralBook || isPrintOffer)) {
      const bundle = bundleOptions.find((b) => b.code === printBundleCode);
      if (bundle) {
        items.push({ label: bundle.label, value: "Included in bundle price" });
      }
    }

    if (giftCopyCount > 0 && isPdfOffer && !upgradeSpiralBook) {
      items.push({ label: `${giftCopyCount} gift ${giftCopyCount === 1 ? "copy" : "copies"}`, value: "PDF covers them all" });
    }

    return items;
  }, [upgradeSpiralBook, spiralOffer, offer.subtotalCents, printBundleCode, isPrintOffer, giftCopyCount, isPdfOffer]);

  const resolvedBundleSelection: PrintBundleCode | null = useMemo(() => {
    if (activeOffer.format !== "print") return null;
    if (printBundleCode) return printBundleCode;
    if (giftCopyCount > 0 && giftCopyCount <= 4) {
      const total = giftCopyCount + 1;
      if (total === 2) return "set-of-2";
      if (total === 3) return "set-of-3";
      if (total >= 5) return "set-of-5";
    }
    return "single";
  }, [activeOffer.format, printBundleCode, giftCopyCount]);

  const resolvedCopyNames = useMemo(() => {
    const filled = giftNames.slice(0, MAX_GIFT_NAMES).filter((n) => n.trim().length > 0);
    return filled.length > 0 ? filled : null;
  }, [giftNames]);

  const handleGiftNameChange = useCallback((index: number, value: string) => {
    setGiftNames((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  async function handleCheckout() {
    setIsSubmitting(true);
    setErrorMessage(null);

    const checkoutOfferCode = activeOffer.code;
    const quantity =
      resolvedBundleSelection && resolvedBundleSelection !== "single"
        ? bundleOptions.find((b) => b.code === resolvedBundleSelection)?.quantity ?? 1
        : 1;

    try {
      const response = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedOffer: checkoutOfferCode,
          quantity,
          bundleSelection: resolvedBundleSelection,
          copyNames: resolvedCopyNames,
          ...readMetaClickIds(),
        }),
      });

      const payload = await readApiPayload<CheckoutResponse>(response);

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "We couldn't open checkout. Please try again.");
      }

      trackEvent("checkout_started_with_addons", {
        orderId,
        selectedOffer: checkoutOfferCode,
        originalOffer: offer.code,
        upgradedToSpiral: upgradeSpiralBook,
        bundleSelection: resolvedBundleSelection ?? "none",
        giftCopyCount,
        uploadedCount,
        surface: "add_ons_panel",
      });

      window.location.assign(payload.checkoutUrl);
      onCheckoutComplete?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't open checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="upload-stack">
      <div className="surface selection-summary">
        <span className="pill pill-mint">Enhance your order</span>
        <h3>A few ways to get more from this book before you check out.</h3>
        <p className="muted">
          Every add-on below uses the same pages you already built. There is no extra work on your end.
        </p>
      </div>

      {/* Upgrade: PDF to Spiral Book */}
      {isPdfOffer && spiralOffer ? (
        <div className="upload-stack">
          <div className="stack-tight">
            <strong>Want the printed spiral book too?</strong>
            <p className="muted">
              The spiral book arrives printed and bound. Your PDF comes with it so you still have the print-at-home version.
              Add {formatMoney(spiralOffer.subtotalCents - offer.subtotalCents)} to upgrade.
            </p>
          </div>
          <div className="toggle-row">
            <button
              className={upgradeSpiralBook ? undefined : "active"}
              type="button"
              onClick={() => {
                setUpgradeSpiralBook(false);
                setPrintBundleCode(null);
                trackEvent("add_on_spiral_upgrade_declined", { orderId, surface: "add_ons_panel" });
              }}
            >
              <span className="pill pill-sky">PDF only</span>
              <strong>Keep it digital</strong>
              <p>Print at home whenever you want. Fast and flexible.</p>
            </button>
            <button
              className={upgradeSpiralBook ? "active" : undefined}
              type="button"
              onClick={() => {
                setUpgradeSpiralBook(true);
                trackEvent("add_on_spiral_upgrade_selected", { orderId, surface: "add_ons_panel" });
              }}
            >
              <span className="pill pill-coral">+ {formatMoney(spiralOffer.subtotalCents - offer.subtotalCents)}</span>
              <strong>Add the spiral book</strong>
              <p>Giftable spiral-bound version plus the PDF. Shipping is added at the delivery step.</p>
            </button>
          </div>
        </div>
      ) : null}

      {/* Extra printed copies — shown when the order already is a print order or when user upgrades to print */}
      {(isPrintOffer || upgradeSpiralBook) ? (
        <div className="upload-stack">
          <div className="stack-tight">
            <strong>Add extra printed copies while the pages are already built.</strong>
            <p className="muted">
              Ordering copies in a bundle is cheaper per copy than reordering later. Grandparent copies, sibling sets, or a keep-safe copy alongside the everyday one.
            </p>
          </div>
          <div className="offer-switch offer-switch-bundles">
            {bundleOptions.map((bundle) => {
              const isActive = printBundleCode === bundle.code;
              const bundleSubtotal = getOfferSubtotalForQuantity(activeOffer, {
                bundleSelection: bundle.code,
                quantity: bundle.quantity,
              });

              return (
                <button
                  className={isActive ? "active" : undefined}
                  key={bundle.code}
                  type="button"
                  onClick={() => {
                    setPrintBundleCode(isActive ? null : bundle.code);
                    trackEvent("add_on_bundle_selected", {
                      orderId,
                      bundleCode: bundle.code,
                      quantity: bundle.quantity,
                      surface: "add_ons_panel",
                    });
                  }}
                >
                  <span className={`pill pill-${bundle.pillTone}`}>{bundle.label}</span>
                  <strong>{bundle.quantity} printed copies</strong>
                  <p>{bundle.description}</p>
                  <p className="offer-meta">{formatMoney(bundleSubtotal)} before shipping</p>
                </button>
              );
            })}
          </div>

          {/* Custom names for each copy */}
          {(printBundleCode ?? "single") !== "single" ? (
            <div className="upload-stack">
              <div className="stack-tight">
                <strong>Different name on each cover? (optional)</strong>
                <p className="muted">
                  Leave these blank to use the same cover name on every copy, or add a name for each recipient.
                </p>
              </div>
              <div className="form-grid">
                {Array.from(
                  { length: Math.min((bundleOptions.find((b) => b.code === printBundleCode)?.quantity ?? 2) - 1, MAX_GIFT_NAMES) },
                  (_, index) => (
                    <label key={`copy-name-${index + 1}`}>
                      <span className="muted">Copy {index + 2} cover name</span>
                      <input
                        autoComplete="given-name"
                        className="input"
                        placeholder={index === 0 ? "Grandma's copy" : `Copy ${index + 2} name`}
                        type="text"
                        value={giftNames[index] ?? ""}
                        onChange={(event) => handleGiftNameChange(index, event.target.value)}
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Gift copies for PDF-only orders (names noted for the record) */}
      {isPdfOffer && !upgradeSpiralBook ? (
        <div className="upload-stack">
          <div className="stack-tight">
            <strong>Want to send a copy to grandma or a sibling?</strong>
            <p className="muted">
              For the print version, you can add extra copies at checkout. Or upgrade to the spiral book above to unlock the multi-copy bundles.
              The PDF you're ordering today can be printed as many times as you need at home.
            </p>
          </div>
          <div className="status-banner">
            <span className="pill pill-sun">PDF includes unlimited home prints</span>
            <p className="muted">
              Your PDF can be printed as many times as needed. Upgrade to the spiral book above if you want the giftable bound version.
            </p>
          </div>
        </div>
      ) : null}

      {/* Order summary */}
      <div className="surface selection-summary">
        <span className="pill pill-coral">Your total today</span>
        <h3>{formatMoney(baseSubtotalCents)}</h3>
        {summaryItems.length > 0 ? (
          <div className="builder-review-list">
            {summaryItems.map((item) => (
              <div className="builder-review-line" key={item.label}>
                <span className="muted">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {upgradeSpiralBook ? (
          <p className="mini-note">Shipping is calculated at the next step based on your address.</p>
        ) : null}
      </div>

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions hero-actions-mobile-bar">
        <button
          className="button button-primary"
          disabled={isSubmitting}
          type="button"
          onClick={handleCheckout}
        >
          {isSubmitting ? "Starting checkout..." : "Go to Secure Checkout"}
        </button>
      </div>
    </div>
  );
}
