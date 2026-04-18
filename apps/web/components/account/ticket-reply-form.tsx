"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setStatus("sending");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/account/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        setStatus("error");
        setErrorMessage(text || `Reply failed: ${response.status}`);
        return;
      }
      setStatus("sent");
      setBody("");
      setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Network error");
    }
  }

  return (
    <form className="stack-tight" onSubmit={handleSubmit}>
      <textarea
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type your reply here…"
        required
        rows={5}
        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}
        value={body}
      />
      <button className="button button-primary" disabled={status === "sending"} type="submit">
        {status === "sending" ? "Sending…" : "Send reply"}
      </button>
      {status === "error" && errorMessage ? <p className="muted">{errorMessage}</p> : null}
    </form>
  );
}
