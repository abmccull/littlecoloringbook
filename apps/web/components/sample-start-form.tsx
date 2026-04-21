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

function getEmailError(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "Enter the email where we should send your private sample link.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
    return "Use a valid email so the sample link lands in the right inbox.";
  }

  return null;
}

export function SampleStartForm({ acquisition }: SampleStartFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [featureConsent, setFeatureConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const emailError = emailTouched ? getEmailError(email) : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmailError = getEmailError(email);
    if (nextEmailError) {
      setEmailTouched(true);
      setErrorMessage(null);
      return;
    }

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
          featureConsent,
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
    <form className="upload-stack sample-start-form" noValidate onSubmit={handleSubmit}>
      <div className={`field-shell${emailError ? " field-shell-invalid" : ""}`}>
        <div className="field-head">
          <span className="field-label">Email</span>
          <span className="field-note">Private link goes here</span>
        </div>
        <input
          aria-describedby={emailError ? "sample-email-error" : "sample-email-note"}
          aria-invalid={emailError ? true : undefined}
          className="input"
          id="sample-email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          type="email"
          value={email}
          onBlur={() => setEmailTouched(true)}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailTouched) {
              setEmailTouched(true);
            }
          }}
        />
        {emailError ? (
          <p className="field-error" id="sample-email-error" role="alert">
            {emailError}
          </p>
        ) : (
          <p className="field-note" id="sample-email-note">
            We open the upload step right after this, then send the private sample link to the same inbox.
          </p>
        )}
      </div>

      {errorMessage ? (
        <div className="status-banner status-banner-warning" role="alert">
          <div className="status-banner-copy">
            <strong>We couldn't start the sample yet.</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {isSubmitting ? (
        <div aria-live="polite" className="status-banner status-banner-progress status-banner-compact">
          <span className="pill pill-sky">Opening your upload step</span>
          <div className="status-banner-copy">
            <strong>Saving your spot now.</strong>
            <p>The private upload screen will open as soon as this step is locked in.</p>
          </div>
        </div>
      ) : null}

      <div className="hero-actions sample-start-actions">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Starting sample..." : "Continue to My Free Sample"}
        </button>
      </div>

      <div className="sample-start-optional">
        <div className="field-shell">
          <span className="field-label">Child first name for the cover (optional)</span>
          <input
            className="input"
            id="sample-child-first-name"
            name="childFirstName"
            autoComplete="given-name"
            placeholder="Mila"
            value={childFirstName}
            onChange={(event) => setChildFirstName(event.target.value)}
          />
          <p className="field-note">Leave it blank if you want to decide on the cover wording after you see the sample style.</p>
        </div>

        <div className="sample-start-assurance">
          <span className="pill pill-sky">Private by default</span>
          <p className="muted">Upload happens next. The cover name is optional, and you can still opt out of gallery features below.</p>
        </div>

        <label className="field-checkbox sample-start-consent">
          <input
            type="checkbox"
            checked={featureConsent}
            onChange={(event) => setFeatureConsent(event.target.checked)}
          />
          <span className="muted">
            It's okay to feature my coloring page in your gallery and social posts. Totally optional - uncheck if you'd rather we keep it private.
          </span>
        </label>
      </div>
    </form>
  );
}
