"use client";

import { useState } from "react";

type Step = "email" | "code" | "signed_in";
type Status = "idle" | "submitting";

// Same-origin proxy. Works identically in dev/preview/prod because all
// requests go through our Next route handler at /api/auth/[...all].
const AUTH_BASE = "/api/auth";

export function MagicLinkForm({ callbackURL = "/account" }: { callbackURL?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const feedback = errorMessage ? (
    <div className="status-banner status-banner-warning status-banner-compact auth-feedback" role="alert">
      <div className="status-banner-copy">
        <strong>We could not complete that sign-in step yet.</strong>
        <p>{errorMessage}</p>
      </div>
    </div>
  ) : null;

  async function handleSendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch(`${AUTH_BASE}/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          type: "sign-in",
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        setStatus("idle");
        setErrorMessage(text || `Request failed: ${response.status}`);
        return;
      }

      setStep("code");
      setStatus("idle");
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Network error");
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch(`${AUTH_BASE}/sign-in/email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: code.trim(),
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        setStatus("idle");
        setErrorMessage(text || "That code didn't match. Try again or request a new one.");
        return;
      }

      setStep("signed_in");
      // Give the session cookie a moment to be set, then navigate.
      window.location.href = callbackURL;
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Network error");
    }
  }

  if (step === "signed_in") {
    return (
      <div className="status-banner status-banner-success auth-feedback" aria-live="polite">
        <div className="status-banner-copy">
          <strong>Signed in.</strong>
          <p>Redirecting to your account now...</p>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form className="auth-magic-form" noValidate onSubmit={handleVerify}>
        <div className="auth-step-card auth-step-card-sky">
          <span className="pill pill-sky">Step 2 of 2</span>
          <div className="status-banner-copy">
            <strong>Check your inbox for the six-digit sign-in code.</strong>
            <p>
              We sent it to <strong>{email}</strong>. It stays valid for a few minutes, then you can request a fresh
              one from the previous step.
            </p>
          </div>
        </div>

        <div className="field-shell auth-field-shell auth-code-shell">
          <div className="field-head">
            <label className="field-label" htmlFor="magic-link-code">
              Sign-in code
            </label>
            <span className="field-note">6 digits</span>
          </div>
          <input
            autoComplete="one-time-code"
            autoFocus
            className="input auth-input auth-code-input"
            enterKeyHint="done"
            id="magic-link-code"
            inputMode="numeric"
            maxLength={6}
            name="code"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
            value={code}
          />
          <p className="field-note">Paste the code in or type it manually from the email.</p>
        </div>

        {feedback}

        <div className="hero-actions auth-form-actions">
          <button className="button button-primary" disabled={status === "submitting"} type="submit">
            {status === "submitting" ? "Verifying..." : "Sign in"}
          </button>
          <button
            className="button button-secondary"
            disabled={status === "submitting"}
            onClick={() => {
              setStep("email");
              setCode("");
              setErrorMessage(null);
            }}
            type="button"
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="auth-magic-form" noValidate onSubmit={handleSendOtp}>
      <div className="auth-step-card auth-step-card-coral">
        <span className="pill pill-coral">Step 1 of 2</span>
        <div className="status-banner-copy">
          <strong>Start with the email you used when you ordered.</strong>
          <p>We will send a six-digit code there, then open the account tied to that inbox.</p>
        </div>
      </div>

      <div className="field-shell auth-field-shell">
        <div className="field-head">
          <label className="field-label" htmlFor="magic-link-email">
            Email address
          </label>
          <span className="field-note">Private sign-in code goes here</span>
        </div>
        <input
          autoComplete="email"
          autoFocus
          className="input auth-input"
          enterKeyHint="send"
          id="magic-link-email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <p className="field-note">Use the inbox where you received your order and sample emails.</p>
      </div>

      {feedback}

      <div className="hero-actions auth-form-actions">
        <button className="button button-primary" disabled={status === "submitting"} type="submit">
          {status === "submitting" ? "Sending..." : "Email me a sign-in code"}
        </button>
      </div>
    </form>
  );
}
