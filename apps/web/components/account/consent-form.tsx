"use client";

import { useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

export function ConsentForm({
  initialMarketingOptIn,
  initialFeatureConsent,
}: {
  initialMarketingOptIn: boolean;
  initialFeatureConsent: boolean | null;
}) {
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [featureConsent, setFeatureConsent] = useState(Boolean(initialFeatureConsent));
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/account/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ marketingOptIn, featureConsent }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        setStatus("error");
        setErrorMessage(text || `Save failed: ${response.status}`);
        return;
      }
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Network error");
    }
  }

  return (
    <form className="stack" onSubmit={handleSave}>
      <label style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <input
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          type="checkbox"
        />
        <span>
          <strong>Email me coloring-book news</strong>
          <br />
          <span className="muted">Two emails a week max. Sunday story + Thursday gallery. Unsubscribe anytime.</span>
        </span>
      </label>

      <label style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <input
          checked={featureConsent}
          disabled={!marketingOptIn}
          onChange={(e) => setFeatureConsent(e.target.checked)}
          type="checkbox"
        />
        <span>
          <strong>It's okay to feature my pages in the newsletter</strong>
          <br />
          <span className="muted">
            We never use last names, cities, or ages beyond approximate. First name only, and only if you also allow it.
          </span>
        </span>
      </label>

      <button className="button button-primary" disabled={status === "saving"} type="submit">
        {status === "saving" ? "Saving…" : "Save preferences"}
      </button>
      {status === "saved" ? <p className="muted">Saved.</p> : null}
      {status === "error" && errorMessage ? <p className="muted">{errorMessage}</p> : null}
    </form>
  );
}
