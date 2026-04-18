"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DmThread, DmThreadStatus } from "@littlecolorbook/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplyClientProps = {
  thread: DmThread;
  adminEmail: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWindowOpen(thread: DmThread): boolean {
  if (!thread.windowExpiresAt) return false;
  return thread.windowExpiresAt.getTime() > Date.now();
}

function windowTimeLeft(thread: DmThread): string {
  if (!thread.windowExpiresAt) return "";
  const msLeft = thread.windowExpiresAt.getTime() - Date.now();
  if (msLeft <= 0) return "expired";
  const hours = Math.floor(msLeft / 3_600_000);
  const mins = Math.floor((msLeft % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

// ─── Reply Form ───────────────────────────────────────────────────────────────

export function InboxReplyClient({ thread, adminEmail }: ReplyClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [replyText, setReplyText] = useState("");
  const [useHumanAgent, setUseHumanAgent] = useState(false);
  const [status, setStatus] = useState<DmThreadStatus>(thread.status);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const open = isWindowOpen(thread);
  const timeLeft = windowTimeLeft(thread);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = {
          body: replyText.trim(),
          sentBy: adminEmail,
        };
        if (!open || useHumanAgent) {
          payload.tag = "HUMAN_AGENT";
        }

        const res = await fetch(
          `/api/admin/dm-threads/${thread.id}/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        const data = (await res.json()) as { error?: { message?: string } };
        if (!res.ok) {
          setError(data.error?.message ?? "Failed to send reply");
          return;
        }

        setReplyText("");
        setSuccessMsg("Reply sent.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  async function handleStatusChange(newStatus: DmThreadStatus) {
    setError(null);
    setStatus(newStatus);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/dm-threads/${thread.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: { message?: string } };
          setError(data.error?.message ?? "Failed to update status");
          setStatus(thread.status); // revert
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setStatus(thread.status);
      }
    });
  }

  async function handleAssignToMe() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/dm-threads/${thread.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo: adminEmail }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: { message?: string } };
          setError(data.error?.message ?? "Failed to assign thread");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: "20px", paddingTop: "20px" }}>
      {/* ── Status controls ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 500 }}>Status:</label>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as DmThreadStatus)}
          disabled={isPending}
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            fontSize: "0.85rem",
          }}
        >
          <option value="open">Open</option>
          <option value="snoozed">Snoozed</option>
          <option value="closed">Closed</option>
        </select>
        <button
          type="button"
          onClick={handleAssignToMe}
          disabled={isPending || thread.assignedTo === adminEmail}
          style={{
            padding: "4px 12px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            cursor: isPending ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
          }}
        >
          Assign to me
        </button>
        {thread.assignedTo && thread.assignedTo !== adminEmail && (
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            Assigned to {thread.assignedTo}
          </span>
        )}
      </div>

      {/* ── Window status indicator ────────────────────────────────────────── */}
      <div style={{ marginBottom: "10px" }}>
        {open ? (
          <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 500 }}>
            Window open — {timeLeft}
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", color: "#d97706", fontWeight: 500 }}>
              Window closed — toggle HUMAN_AGENT tag to reply
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useHumanAgent}
                onChange={(e) => setUseHumanAgent(e.target.checked)}
              />
              HUMAN_AGENT tag
            </label>
          </div>
        )}
      </div>

      {/* ── Reply form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleReply} style={{ display: "grid", gap: "10px" }}>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Type your reply…"
          rows={4}
          disabled={isPending}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            fontSize: "0.9rem",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626" }}>{error}</p>
        )}
        {successMsg && (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#16a34a" }}>{successMsg}</p>
        )}
        <div>
          <button
            type="submit"
            disabled={isPending || !replyText.trim() || (!open && !useHumanAgent)}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              background: isPending || !replyText.trim() || (!open && !useHumanAgent) ? "#e5e7eb" : "var(--color-brand, #7c3aed)",
              color: isPending || !replyText.trim() || (!open && !useHumanAgent) ? "#9ca3af" : "#fff",
              border: "none",
              cursor: isPending || !replyText.trim() || (!open && !useHumanAgent) ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            {isPending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>
    </div>
  );
}
