"use client";

import { useState } from "react";

type Status = "drafted" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";

export function BroadcastActions({
  broadcastId,
  status,
  resendBroadcastId,
}: {
  broadcastId: string;
  status: Status;
  resendBroadcastId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function callAction(action: "send_now" | "cancel") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcastId}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const text = await res.text();
      setMsg(res.ok ? `OK: ${text}` : `Error: ${text}`);
      if (res.ok) setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  const canAct = status === "drafted" || status === "scheduled";

  return (
    <div className="surface" style={{ margin: "24px 0" }}>
      <h3>Actions</h3>
      {!canAct ? (
        <p className="muted">
          Broadcast is {status}. No further actions available.
        </p>
      ) : (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {resendBroadcastId ? (
            <button className="button button-primary" disabled={busy} onClick={() => callAction("send_now")}>
              {busy ? "Sending…" : "Send now (skip schedule)"}
            </button>
          ) : (
            <p className="muted">Not yet pushed to Resend — nothing to send or cancel.</p>
          )}
          <button className="button button-secondary" disabled={busy} onClick={() => callAction("cancel")}>
            {busy ? "Cancelling…" : "Cancel broadcast"}
          </button>
        </div>
      )}
      {msg ? <p className="muted" style={{ marginTop: "12px" }}>{msg}</p> : null}
    </div>
  );
}
