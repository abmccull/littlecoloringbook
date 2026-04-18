import Link from "next/link";
import { notFound } from "next/navigation";
import { getDmThreadWithMessages } from "@littlecolorbook/db";
import type { DmThread, DmMessage, DmPlatform, DmThreadStatus } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../../../lib/auth";
import { InboxReplyClient } from "../../../../../components/admin/inbox-reply-client";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function windowInfo(thread: DmThread): { open: boolean; label: string; color: string } {
  if (!thread.windowExpiresAt) {
    return { open: false, label: "No window", color: "#9ca3af" };
  }
  const msLeft = thread.windowExpiresAt.getTime() - Date.now();
  if (msLeft <= 0) {
    return { open: false, label: "Window expired", color: "#dc2626" };
  }
  const hours = Math.floor(msLeft / 3_600_000);
  const mins = Math.floor((msLeft % 3_600_000) / 60_000);
  const label = hours > 0 ? `Window open — ${hours}h ${mins}m left` : `Window open — ${mins}m left`;
  return { open: true, label, color: hours >= 6 ? "#16a34a" : "#d97706" };
}

function platformLabel(platform: DmPlatform): string {
  return platform === "fb_messenger" ? "FB Messenger" : "Instagram Direct";
}

function statusColor(status: DmThreadStatus): string {
  if (status === "open") return "#16a34a";
  if (status === "snoozed") return "#d97706";
  return "#6b7280";
}

function sentByLabel(sentBy: string | null): string {
  if (!sentBy) return "system";
  if (sentBy === "customer") return "customer";
  if (sentBy.startsWith("auto:")) return `auto-reply`;
  return sentBy;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: DmMessage }) {
  const isInbound = message.direction === "inbound";
  const isAuto = message.sentBy?.startsWith("auto:") ?? false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isInbound ? "flex-start" : "flex-end",
        gap: "4px",
        maxWidth: "70%",
        alignSelf: isInbound ? "flex-start" : "flex-end",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderRadius: isInbound ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          background: isInbound ? "#f3f4f6" : isAuto ? "#ede9fe" : "var(--color-brand-light, #ddd6fe)",
          color: "var(--color-ink)",
          fontSize: "0.9rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          border: isAuto ? "1px solid #c4b5fd" : "none",
        }}
      >
        {message.body || <em style={{ color: "#9ca3af" }}>(no text — attachment only)</em>}
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
          {sentByLabel(message.sentBy)}
        </span>
        {isAuto && (
          <span
            style={{
              padding: "0 5px",
              borderRadius: "4px",
              fontSize: "0.68rem",
              fontWeight: 700,
              background: "#ede9fe",
              color: "#7c3aed",
              border: "1px solid #c4b5fd",
            }}
          >
            Auto
          </span>
        )}
        {message.tag && (
          <span
            style={{
              padding: "0 5px",
              borderRadius: "4px",
              fontSize: "0.68rem",
              fontWeight: 600,
              background: "#fef9c3",
              color: "#a16207",
            }}
          >
            {message.tag}
          </span>
        )}
        <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
          {formatDateTime(message.sentAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DmThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  const { id } = await params;

  const result = await getDmThreadWithMessages(id, { messageLimit: 100, messageOffset: 0 });
  if (!result) notFound();

  const { thread, messages } = result;
  const sorted = [...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const win = windowInfo(thread);
  const userLabel =
    thread.platformUserHandle ?? thread.userDisplayName ?? thread.platformUserId;

  return (
    <div style={{ padding: "24px", maxWidth: "860px", margin: "0 auto" }}>
      {/* ── Back link ────────────────────────────────────────────────────────── */}
      <p style={{ margin: "0 0 16px" }}>
        <Link href="/admin/growth/inbox" style={{ fontSize: "0.875rem" }}>
          ← DM Inbox
        </Link>
      </p>

      {/* ── Thread header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "16px 20px",
          background: "var(--color-paper)",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>{userLabel}</h1>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>{platformLabel(thread.platform)}</span>
              <span
                style={{
                  display: "inline-block",
                  padding: "1px 8px",
                  borderRadius: "999px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: thread.status === "open" ? "#dcfce7" : thread.status === "snoozed" ? "#fef9c3" : "#f1f5f9",
                  color: statusColor(thread.status),
                }}
              >
                {thread.status}
              </span>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: win.color }}>
                {win.label}
              </span>
              {thread.assignedTo && (
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  Assigned to {thread.assignedTo}
                </span>
              )}
            </div>
          </div>

          {/* Escalate to ticket */}
          {thread.ticketId ? (
            <Link
              href={`/admin/tickets/${thread.ticketId}`}
              style={{
                fontSize: "0.82rem",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                color: "var(--color-ink)",
                textDecoration: "none",
              }}
            >
              View ticket
            </Link>
          ) : (
            <Link
              href={`/admin/tickets/new?dmThreadId=${thread.id}`}
              style={{
                fontSize: "0.82rem",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                color: "var(--color-ink)",
                textDecoration: "none",
              }}
            >
              Escalate to ticket
            </Link>
          )}
        </div>
      </div>

      {/* ── Chat messages ──────────────────────────────────────────────────────── */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "12px",
          background: "var(--color-paper)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minHeight: "300px",
          maxHeight: "540px",
          overflowY: "auto",
        }}
      >
        {sorted.length === 0 ? (
          <p style={{ margin: "auto", color: "#9ca3af", fontSize: "0.875rem" }}>No messages yet.</p>
        ) : (
          sorted.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      {/* ── Reply + status controls ────────────────────────────────────────────── */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "12px",
          background: "var(--color-paper)",
          padding: "20px",
          marginTop: "16px",
        }}
      >
        <InboxReplyClient thread={thread} adminEmail={session.email ?? "admin"} />
      </div>
    </div>
  );
}
