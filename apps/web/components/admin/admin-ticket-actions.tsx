"use client";

import { useState } from "react";

type Status = "open" | "awaiting_customer" | "in_progress" | "resolved" | "closed";

export function AdminTicketActions({
  ticketId,
  currentStatus,
  adminEmail,
}: {
  ticketId: string;
  currentStatus: Status;
  adminEmail: string | null;
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body, internal: isInternal }),
      });
      const text = await res.text();
      setMsg(res.ok ? "Sent" : `Error: ${text}`);
      if (res.ok) {
        setBody("");
        setTimeout(() => window.location.reload(), 400);
      }
    } finally {
      setBusy(false);
    }
  }

  async function transition(status: Status) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const text = await res.text();
      setMsg(res.ok ? `Status → ${status}` : `Error: ${text}`);
      if (res.ok) setTimeout(() => window.location.reload(), 400);
    } finally {
      setBusy(false);
    }
  }

  async function assignToMe() {
    if (!adminEmail) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedAdminEmail: adminEmail }),
      });
      setMsg(`Assigned to ${adminEmail}`);
      setTimeout(() => window.location.reload(), 400);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "24px" }}>
      <form className="surface" onSubmit={submitReply} style={{ marginBottom: "16px" }}>
        <h3>Reply</h3>
        <textarea
          onChange={(e) => setBody(e.target.value)}
          placeholder={isInternal ? "Internal note (not emailed to customer)" : "Reply to customer…"}
          required
          rows={5}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}
          value={body}
        />
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}>
          <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} type="checkbox" />
            <span>Internal note (admin-only)</span>
          </label>
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? "Sending…" : isInternal ? "Add note" : "Send reply"}
          </button>
        </div>
      </form>

      <div className="surface">
        <h3>Transitions</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {currentStatus !== "in_progress" ? (
            <button className="button button-secondary" disabled={busy} onClick={() => transition("in_progress")}>
              Mark in progress
            </button>
          ) : null}
          {currentStatus !== "awaiting_customer" ? (
            <button className="button button-secondary" disabled={busy} onClick={() => transition("awaiting_customer")}>
              Awaiting customer
            </button>
          ) : null}
          {currentStatus !== "resolved" ? (
            <button className="button button-secondary" disabled={busy} onClick={() => transition("resolved")}>
              Mark resolved
            </button>
          ) : null}
          {currentStatus !== "closed" ? (
            <button className="button button-secondary" disabled={busy} onClick={() => transition("closed")}>
              Close
            </button>
          ) : null}
          {adminEmail ? (
            <button className="button button-secondary" disabled={busy} onClick={assignToMe}>
              Assign to me
            </button>
          ) : null}
        </div>
      </div>

      {msg ? <p className="muted" style={{ marginTop: "12px" }}>{msg}</p> : null}
    </div>
  );
}
