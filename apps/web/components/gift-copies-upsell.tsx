"use client";

import { useState } from "react";
import { TrackedLink } from "./tracked-link";
import { trackEvent } from "./analytics-provider";

type GiftCopyMode = "gift" | "sibling";

type GiftCopiesUpsellProps = {
  baseHref?: string;
};

const MAX_GIFT_COPIES = 3;

function buildHrefWithCopyNames(base: string, names: string[]): string {
  const filled = names.filter((n) => n.trim().length > 0);
  const separator = base.includes("?") ? "&" : "?";
  const copyNamesParam = filled.map((n) => encodeURIComponent(n)).join(",");
  const params = `offer=print-100&bundle=set-of-${filled.length + 1}&source=gift-copies-upsell${copyNamesParam ? `&copyNames=${copyNamesParam}` : ""}`;
  return `${base}${separator}${params}`;
}

export function GiftCopiesUpsell({ baseHref = "/create" }: GiftCopiesUpsellProps) {
  const [mode, setMode] = useState<GiftCopyMode | null>(null);
  const [siblingName, setSiblingName] = useState("");
  const [giftNames, setGiftNames] = useState<string[]>(["", "", ""]);

  function handleModeSelect(next: GiftCopyMode) {
    setMode(next);
    trackEvent("gift_copies_upsell_mode_selected", { mode: next, surface: "sample_ready_page" });
  }

  function updateGiftName(index: number, value: string) {
    setGiftNames((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }

  const filledGiftNames = giftNames.filter((n) => n.trim().length > 0);
  const siblingHref = buildHrefWithCopyNames(baseHref, [siblingName]);
  const giftHref = buildHrefWithCopyNames(baseHref, giftNames.slice(0, MAX_GIFT_COPIES));

  return (
    <div className="stack">
      <div className="section-copy">
        <p className="eyebrow">Add more copies</p>
        <h2>Same book, different covers. Perfect for siblings and gifts.</h2>
        <p className="lede">
          Every extra copy uses the same pages you already built. You just add the names for each cover, and we print them all in one order.
        </p>
      </div>

      <div className="detail-grid two-up">
        <article className="surface detail-card">
          <span className="pill pill-sun">Sibling copy</span>
          <h3>Make one for each child.</h3>
          <p className="muted">
            Same photos and pages as the original, but with your second child's name on the cover. Great for keeping things equal without rebuilding from scratch.
          </p>
          {mode === "sibling" ? (
            <div className="upload-stack">
              <label>
                <span className="muted">Sibling's name on cover</span>
                <input
                  autoComplete="given-name"
                  className="input"
                  placeholder="Jamie"
                  type="text"
                  value={siblingName}
                  onChange={(event) => setSiblingName(event.target.value)}
                />
              </label>
              <TrackedLink
                className="button button-primary offer-card-cta"
                href={siblingHref}
                eventName="sibling_copy_upsell_clicked"
                eventProperties={{
                  siblingName: siblingName.trim() || "unnamed",
                  surface: "sample_ready_page",
                }}
              >
                Add sibling copy
              </TrackedLink>
            </div>
          ) : (
            <button
              className="button button-secondary offer-card-cta"
              type="button"
              onClick={() => handleModeSelect("sibling")}
            >
              Add a sibling copy
            </button>
          )}
        </article>

        <article className="surface detail-card">
          <span className="pill pill-coral">Gift copies</span>
          <h3>Add a copy for grandma.</h3>
          <p className="muted">
            Order up to three extra printed copies alongside the original. Each one can have a different name on the cover — one for grandma, one for the birthday guest, one to keep.
          </p>
          {mode === "gift" ? (
            <div className="upload-stack">
              {giftNames.slice(0, MAX_GIFT_COPIES).map((name, index) => (
                <label key={`gift-copy-${index + 1}`}>
                  <span className="muted">Gift copy {index + 1} cover name</span>
                  <input
                    autoComplete="given-name"
                    className="input"
                    placeholder={index === 0 ? "Grandma's copy" : `Copy ${index + 2} name`}
                    type="text"
                    value={name}
                    onChange={(event) => updateGiftName(index, event.target.value)}
                  />
                </label>
              ))}
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Leave a field blank to use the same name as the main copy.
              </p>
              <TrackedLink
                className="button button-primary offer-card-cta"
                href={giftHref}
                eventName="gift_copies_upsell_clicked"
                eventProperties={{
                  filledCount: filledGiftNames.length,
                  surface: "sample_ready_page",
                }}
              >
                {filledGiftNames.length > 0
                  ? `Add ${filledGiftNames.length} gift ${filledGiftNames.length === 1 ? "copy" : "copies"}`
                  : "Add gift copies"}
              </TrackedLink>
            </div>
          ) : (
            <button
              className="button button-secondary offer-card-cta"
              type="button"
              onClick={() => handleModeSelect("gift")}
            >
              Add gift copies
            </button>
          )}
        </article>
      </div>
    </div>
  );
}
