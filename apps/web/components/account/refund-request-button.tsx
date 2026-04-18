"use client";

import { useState } from "react";

type Stage = "closed" | "form" | "submitting" | "result" | "error";

type Reason =
  | "customer_request_no_questions"
  | "print_quality"
  | "shipping_damage"
  | "shipping_lost"
  | "duplicate_charge"
  | "other";

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: "customer_request_no_questions", label: "Changed my mind / don't love it" },
  { value: "print_quality", label: "Print quality isn't right" },
  { value: "shipping_damage", label: "Arrived damaged" },
  { value: "shipping_lost", label: "Never arrived" },
  { value: "duplicate_charge", label: "Duplicate charge" },
  { value: "other", label: "Something else" },
];

type ApiResponse = {
  ok?: boolean;
  error?: string;
  tier?: string;
  amountCents?: number;
  autoApproved?: boolean;
  summary?: string;
};

function formatMoney(cents: number | undefined) {
  if (cents === undefined) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function RefundRequestButton({ orderId }: { orderId: string }) {
  const [stage, setStage] = useState<Stage>("closed");
  const [reason, setReason] = useState<Reason>("customer_request_no_questions");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage("submitting");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/account/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, reason, notes: notes || undefined }),
      });
      const json = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setStage("error");
        setErrorMessage(json.error ?? `Request failed: ${response.status}`);
        return;
      }
      setResult(json);
      setStage("result");
    } catch (error) {
      setStage("error");
      setErrorMessage(error instanceof Error ? error.message : "Network error");
    }
  }

  if (stage === "closed") {
    return (
      <button className="button button-secondary" onClick={() => setStage("form")} type="button">
        Request refund
      </button>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className="surface" style={{ background: "#fff5e4" }}>
        <h3>{result.autoApproved ? "Refund approved" : "Refund requested"}</h3>
        <p>{result.summary}</p>
        {result.amountCents ? (
          <p>
            <strong>Amount:</strong> {formatMoney(result.amountCents)}
          </p>
        ) : null}
        <p className="muted">
          We opened a support ticket for this too. Check <a href="/account/tickets">your tickets</a> for updates.
        </p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="surface">
        <p className="muted">{errorMessage}</p>
        <button className="button button-secondary" onClick={() => setStage("form")} type="button">
          Try again
        </button>
      </div>
    );
  }

  return (
    <form className="surface" onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
      <h3>Request a refund</h3>
      <label className="stack-tight">
        <span>What's the reason?</span>
        <select
          onChange={(e) => setReason(e.target.value as Reason)}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}
          value={reason}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="stack-tight">
        <span>Anything else we should know? (optional)</span>
        <textarea
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--line)", width: "100%" }}
          value={notes}
        />
      </label>
      <div style={{ display: "flex", gap: "8px" }}>
        <button className="button button-primary" disabled={stage === "submitting"} type="submit">
          {stage === "submitting" ? "Submitting…" : "Submit request"}
        </button>
        <button className="button button-secondary" onClick={() => setStage("closed")} type="button">
          Cancel
        </button>
      </div>
      <p className="mini-note">
        We apply our <a href="/refunds">refund policy</a> automatically. You'll see the outcome on the next screen.
      </p>
    </form>
  );
}
