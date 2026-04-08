"use client";

import { useState, useTransition } from "react";

export function PortalSupportForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="surface support-form">
      <div className="stack stack-tight">
        <span className="pill">Need help?</span>
        <h3>Send a support request</h3>
        <p className="muted">This creates a support-required item for ops and sends you a confirmation email.</p>
      </div>
      <label className="field-label" htmlFor="support-message">What do you need help with?</label>
      <textarea
        id="support-message"
        className="field-textarea"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Example: page 12 has a bad face render and I want it rerun."
        rows={5}
      />
      <div className="hero-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={isPending || message.trim().length < 10}
          onClick={() => {
            startTransition(async () => {
              setFeedback(null);
              const response = await fetch(`/api/portal/${token}/support`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
              });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              setFeedback(response.ok ? "Support request received." : payload?.error ?? "Could not submit support request.");
              if (response.ok) {
                setMessage("");
              }
            });
          }}
        >
          {isPending ? "Sending..." : "Send request"}
        </button>
      </div>
      {feedback ? <p className="notice">{feedback}</p> : null}
    </div>
  );
}
