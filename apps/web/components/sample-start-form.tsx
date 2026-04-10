"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent } from "./analytics-provider";

type SampleCreateResponse = {
  error?: string;
  id?: string;
  processingUrl?: string;
};

export function SampleStartForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          childFirstName: childFirstName.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as SampleCreateResponse;

      if (!response.ok || !payload.id || !payload.processingUrl) {
        throw new Error(payload.error ?? "Could not start the free sample.");
      }

      trackEvent("sample_draft_created", {
        orderId: payload.id,
        hasChildName: Boolean(childFirstName.trim()),
      });

      const nextUrl = new URL(payload.processingUrl, window.location.origin);
      nextUrl.searchParams.set("orderId", payload.id);
      router.push(`${nextUrl.pathname}?${nextUrl.searchParams.toString()}`);
    } catch (error) {
      trackEvent("sample_draft_failed", {
        hasChildName: Boolean(childFirstName.trim()),
      });
      setErrorMessage(error instanceof Error ? error.message : "Could not start the sample.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="upload-stack" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span className="muted">Email</span>
          <input
            className="input"
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span className="muted">Child first name for the cover (optional)</span>
          <input className="input" placeholder="Mila" value={childFirstName} onChange={(event) => setChildFirstName(event.target.value)} />
        </label>
      </div>

      <div className="surface">
        <span className="pill pill-sky">What you get</span>
        <h3>One printable page from one favorite photo.</h3>
        <p className="muted">
          We'll save your sample first, then take you to the photo-upload step so your preview stays connected to the right inbox.
        </p>
      </div>

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Starting sample..." : "Continue to My Free Sample"}
        </button>
      </div>
    </form>
  );
}
