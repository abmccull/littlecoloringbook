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
  const [email, setEmail] = useState("parent@example.com");
  const [childFirstName, setChildFirstName] = useState("Mila");
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
          <input className="input" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          <span className="muted">Child first name (optional)</span>
          <input className="input" value={childFirstName} onChange={(event) => setChildFirstName(event.target.value)} />
        </label>
      </div>

      <div className="surface">
        <span className="pill">How it works</span>
        <h3>Create the sample first, then upload one photo.</h3>
        <p className="muted">
          This gives the app a real order ID up front so the upload, generation job, preview, and email all stay tied to the same sample record.
        </p>
      </div>

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Starting sample..." : "Continue to Sample Upload"}
        </button>
      </div>
    </form>
  );
}
