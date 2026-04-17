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
    return <p className="muted">Signed in. Redirecting…</p>;
  }

  if (step === "code") {
    return (
      <form className="stack-tight" onSubmit={handleVerify}>
        <p>
          We sent a sign-in code to <strong>{email}</strong>. It's good for a few minutes — paste it below.
        </p>
        <label className="stack-tight" htmlFor="magic-link-code">
          <span>Sign-in code</span>
          <input
            autoComplete="one-time-code"
            id="magic-link-code"
            inputMode="numeric"
            name="code"
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
            value={code}
          />
        </label>
        <button className="button button-primary" disabled={status === "submitting"} type="submit">
          {status === "submitting" ? "Verifying…" : "Sign in"}
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
        {errorMessage ? <p className="muted">{errorMessage}</p> : null}
      </form>
    );
  }

  return (
    <form className="stack-tight" onSubmit={handleSendOtp}>
      <label className="stack-tight" htmlFor="magic-link-email">
        <span>Email</span>
        <input
          autoComplete="email"
          id="magic-link-email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <button className="button button-primary" disabled={status === "submitting"} type="submit">
        {status === "submitting" ? "Sending…" : "Email me a sign-in code"}
      </button>
      {errorMessage ? <p className="muted">{errorMessage}</p> : null}
    </form>
  );
}
