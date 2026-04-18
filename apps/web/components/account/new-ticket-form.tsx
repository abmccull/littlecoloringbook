"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "submitting" | "error";

const CATEGORIES = [
  { value: "refund_request", label: "Refund request" },
  { value: "print_quality", label: "Print quality issue" },
  { value: "shipping_damage", label: "Arrived damaged" },
  { value: "shipping_delay", label: "Shipping delay / lost" },
  { value: "wrong_item", label: "Wrong item received" },
  { value: "page_rerender", label: "Page didn't come out right" },
  { value: "account_help", label: "Account / sign-in help" },
  { value: "other", label: "Something else" },
] as const;

export function NewTicketForm({
  orderId,
  customerEmail,
}: {
  orderId: string;
  customerEmail: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("other");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/account/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, category, subject, body }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        setStatus("error");
        setErrorMessage(text || `Failed: ${response.status}`);
        return;
      }
      const json = (await response.json()) as { ticketId?: string };
      if (json.ticketId) {
        router.push(`/account/tickets/${json.ticketId}`);
      } else {
        router.push(`/account/tickets`);
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Network error");
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="stack-tight">
        <span>What's going on?</span>
        <select
          onChange={(e) => setCategory(e.target.value)}
          required
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}
          value={category}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="stack-tight">
        <span>Subject</span>
        <input
          maxLength={200}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Short summary (one line)"
          required
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}
          type="text"
          value={subject}
        />
      </label>

      <label className="stack-tight">
        <span>Tell us what happened</span>
        <textarea
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue. What page(s), any photos we should know about, and what you'd like us to do."
          required
          rows={6}
          style={{ padding: "12px", borderRadius: "8px", border: "1px solid var(--line)", width: "100%" }}
          value={body}
        />
      </label>

      <p className="mini-note">
        We'll reply to <strong>{customerEmail}</strong> within 24 hours (usually a lot faster).
      </p>

      <button className="button button-primary" disabled={status === "submitting"} type="submit">
        {status === "submitting" ? "Opening ticket…" : "Open ticket"}
      </button>
      {status === "error" && errorMessage ? <p className="muted">{errorMessage}</p> : null}
    </form>
  );
}
