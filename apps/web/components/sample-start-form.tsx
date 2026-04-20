"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AcquisitionPayload } from "../lib/acquisition";
import { trackBuyerJourneyStage, trackEvent } from "./analytics-provider";

type SampleCreateResponse = {
  error?: string;
  id?: string;
  processingUrl?: string;
  resumeUrl?: string;
  resumed?: boolean;
  resumedBy?: "email" | "visitor";
  blocked?: boolean;
  reason?: string;
  blockedBy?: Array<"email" | "visitor" | "ip">;
  limits?: {
    email: number;
    visitor: number;
    ip: number;
    ipWindowDays: number;
  };
};

type SampleStartFormProps = {
  acquisition: AcquisitionPayload;
};

export function SampleStartForm({ acquisition }: SampleStartFormProps) {
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
          ...acquisition,
        }),
      });

      const payload = (await response.json()) as SampleCreateResponse;

      if (response.ok && payload.resumed && payload.resumeUrl) {
        trackEvent("sample_draft_resumed", {
          orderId: payload.id,
          resumedBy: payload.resumedBy ?? "email",
        });

        router.push(payload.resumeUrl);
        return;
      }

      if (response.status === 429 && payload.blocked) {
        const limitUrl = new URL("/sample/limit-reached", window.location.origin);
        if (email) limitUrl.searchParams.set("email", email);
        if (payload.blockedBy?.length) {
          limitUrl.searchParams.set("blockedBy", payload.blockedBy.join(","));
        }
        if (payload.limits?.ip) {
          limitUrl.searchParams.set("ipLimit", String(payload.limits.ip));
        }
        if (payload.limits?.ipWindowDays) {
          limitUrl.searchParams.set("ipWindowDays", String(payload.limits.ipWindowDays));
        }
        router.push(limitUrl.pathname + limitUrl.search);
        return;
      }

      if (!response.ok || !payload.id || !payload.processingUrl) {
        throw new Error(payload.error ?? "Could not start the free sample.");
      }

      trackEvent("sample_draft_created", {
        orderId: payload.id,
        hasChildName: Boolean(childFirstName.trim()),
      });
      trackBuyerJourneyStage(
        "free_sample_started",
        {
          orderId: payload.id,
          hasChildName: Boolean(childFirstName.trim()),
          surface: "sample_start_form",
        },
        {
          onceKey: `free-sample-started:${payload.id}`,
        },
      );

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
    <form className="upload-stack sample-start-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span className="muted">Email</span>
          <input
            className="input"
            id="sample-email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span className="muted">Child first name for the cover (optional)</span>
          <input
            className="input"
            id="sample-child-first-name"
            name="childFirstName"
            autoComplete="given-name"
            placeholder="Mila"
            value={childFirstName}
            onChange={(event) => setChildFirstName(event.target.value)}
          />
        </label>
      </div>

      <div className="surface sample-start-benefit">
        <span className="pill pill-sky">What you get</span>
        <h3>See your photo become a coloring page in 90 seconds.</h3>
        <p className="muted">We'll email you the finished page so you never lose it.</p>
        <p className="mini-note">
          Free sample policy: 1 sample per email, 1 active sample per browser, up to 4 samples per
          household/network in 30 days.
        </p>
      </div>

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions sample-start-actions">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Starting sample..." : "Continue to My Free Sample"}
        </button>
      </div>
    </form>
  );
}
