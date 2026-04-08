"use client";

import { useState, useTransition } from "react";

type Props = {
  orderId: string;
  deliveryMode: "pdf" | "print";
};

export function AdminActions({ orderId, deliveryMode }: Props) {
  const [pageNumber, setPageNumber] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setFeedback(response.ok ? "Action queued for ops review." : payload?.error ?? "Action failed.");
  }

  return (
    <div className="surface stack">
      <div className="stack stack-tight">
        <span className="pill">Admin actions</span>
        <h3>Queue operational fixes</h3>
      </div>
      <div className="form-grid two-up">
        <label className="field-shell">
          <span className="field-label">Page number</span>
          <input
            className="field-input"
            inputMode="numeric"
            placeholder="Optional"
            value={pageNumber}
            onChange={(event) => setPageNumber(event.target.value)}
          />
        </label>
        <label className="field-shell">
          <span className="field-label">Note</span>
          <input
            className="field-input"
            placeholder="Reason for the request"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
      <div className="hero-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await submit(`/api/admin/orders/${orderId}/rerender-page`, {
                pageNumber: pageNumber ? Number(pageNumber) : undefined,
                note: note || undefined,
              });
            });
          }}
        >
          {isPending ? "Working..." : "Queue rerender"}
        </button>
        {deliveryMode === "print" ? (
          <button
            className="button button-secondary"
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await submit(`/api/admin/orders/${orderId}/resubmit-lulu`, {
                  note: note || undefined,
                });
              });
            }}
          >
            Request Lulu resubmission
          </button>
        ) : null}
      </div>
      {feedback ? <p className="notice">{feedback}</p> : null}
    </div>
  );
}
