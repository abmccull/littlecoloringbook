"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DmKeywordResponse, KeywordResponseMatchKind, DmPlatform } from "@littlecolorbook/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  label: string;
  matchKind: KeywordResponseMatchKind;
  matchPattern: string;
  responseBody: string;
  platform: DmPlatform | "";
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  matchKind: "contains",
  matchPattern: "",
  responseBody: "",
  platform: "",
  enabled: true,
};

const MATCH_KIND_OPTIONS: { value: KeywordResponseMatchKind; label: string }[] = [
  { value: "exact", label: "Exact match" },
  { value: "contains", label: "Contains" },
  { value: "prefix", label: "Starts with" },
  { value: "regex", label: "Regex" },
];

const PLATFORM_OPTIONS: { value: DmPlatform | ""; label: string }[] = [
  { value: "", label: "Both platforms" },
  { value: "fb_messenger", label: "FB Messenger only" },
  { value: "ig_direct", label: "Instagram Direct only" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function platformLabel(platform: DmPlatform | null): string {
  if (!platform) return "Both";
  return platform === "fb_messenger" ? "FB" : "IG";
}

function platformColor(platform: DmPlatform | null): { bg: string; color: string } {
  if (!platform) return { bg: "#f1f5f9", color: "#64748b" };
  if (platform === "fb_messenger") return { bg: "#dbeafe", color: "#1d4ed8" };
  return { bg: "#fae8ff", color: "#7e22ce" };
}

function formatDateTime(d: Date | null | string): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(d),
  );
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function RuleForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
  formError,
}: {
  initial: FormState;
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
  formError: string | null;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function field(key: keyof FormState) {
    return {
      value: form[key] as string | boolean,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const val = e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
        setForm((prev) => ({ ...prev, [key]: val }));
      },
    };
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.82rem",
    fontWeight: 600,
    marginBottom: "4px",
    color: "#374151",
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      style={{ display: "grid", gap: "14px" }}
    >
      <div>
        <label style={labelStyle}>Label *</label>
        <input
          type="text"
          placeholder="e.g. Sample link request"
          required
          maxLength={200}
          style={inputStyle}
          {...(field("label") as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </div>

      <div>
        <label style={labelStyle}>Match kind *</label>
        <select style={inputStyle} {...(field("matchKind") as React.SelectHTMLAttributes<HTMLSelectElement>)}>
          {MATCH_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Match pattern *</label>
        <input
          type="text"
          placeholder={form.matchKind === "regex" ? "e.g. ^hi|^hello" : "e.g. sample link"}
          required
          maxLength={1000}
          style={inputStyle}
          {...(field("matchPattern") as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>
          {form.matchKind === "regex"
            ? "Regular expression — applied case-insensitively. Invalid patterns are skipped."
            : "Comparison is case-insensitive and whitespace-trimmed."}
        </p>
      </div>

      <div>
        <label style={labelStyle}>Response body *</label>
        <textarea
          placeholder="The message to send back automatically…"
          required
          maxLength={4000}
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
          {...(field("responseBody") as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      </div>

      <div>
        <label style={labelStyle}>Platform</label>
        <select style={inputStyle} {...(field("platform") as React.SelectHTMLAttributes<HTMLSelectElement>)}>
          {PLATFORM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          id="enabled"
          checked={form.enabled}
          onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          style={{ width: "16px", height: "16px" }}
        />
        <label htmlFor="enabled" style={{ fontSize: "0.875rem", cursor: "pointer" }}>
          Enabled
        </label>
      </div>

      {formError && (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626" }}>{formError}</p>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          style={{ padding: "7px 16px", borderRadius: "7px", border: "1px solid #d1d5db", cursor: "pointer", fontSize: "0.875rem" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "7px 20px",
            borderRadius: "7px",
            border: "none",
            background: isPending ? "#d1d5db" : "var(--color-brand, #7c3aed)",
            color: "#fff",
            cursor: isPending ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function KeywordResponsesClient({ initialRules }: { initialRules: DmKeywordResponse[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<DmKeywordResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(form: FormState) {
    setFormError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/dm-keyword-responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label,
            matchKind: form.matchKind,
            matchPattern: form.matchPattern,
            responseBody: form.responseBody,
            platform: form.platform || null,
            enabled: form.enabled,
          }),
        });
        const data = (await res.json()) as { error?: { message?: string } };
        if (!res.ok) {
          setFormError(data.error?.message ?? "Failed to create rule");
          return;
        }
        setShowCreate(false);
        router.refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  async function handleEdit(form: FormState) {
    if (!editingRule) return;
    setFormError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/dm-keyword-responses/${editingRule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label,
            matchKind: form.matchKind,
            matchPattern: form.matchPattern,
            responseBody: form.responseBody,
            platform: form.platform || null,
            enabled: form.enabled,
          }),
        });
        const data = (await res.json()) as { error?: { message?: string } };
        if (!res.ok) {
          setFormError(data.error?.message ?? "Failed to update rule");
          return;
        }
        setEditingRule(null);
        router.refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  async function handleToggleEnabled(rule: DmKeywordResponse) {
    startTransition(async () => {
      try {
        await fetch(`/api/admin/dm-keyword-responses/${rule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !rule.enabled }),
        });
        router.refresh();
      } catch {
        // silent
      }
    });
  }

  async function handleDelete(rule: DmKeywordResponse) {
    if (!window.confirm(`Delete rule "${rule.label}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await fetch(`/api/admin/dm-keyword-responses/${rule.id}`, { method: "DELETE" });
        router.refresh();
      } catch {
        // silent
      }
    });
  }

  const rules = initialRules; // Server-rendered; router.refresh() re-fetches

  return (
    <>
      {/* ── New rule button ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => { setFormError(null); setShowCreate(true); }}
          disabled={isPending}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            background: "var(--color-brand, #7c3aed)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          + New keyword response
        </button>
      </div>

      {/* ── Rules table ────────────────────────────────────────────────────── */}
      {rules.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--line, #e5e7eb)",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>No keyword rules yet.</p>
          <p style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
            Create your first rule to start auto-replying to DMs.
          </p>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--line, #e5e7eb)",
            borderRadius: "12px",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Label</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Kind</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Pattern</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Platform</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "center" }}>Enabled</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "right" }}>Matches</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Last matched</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const pc = platformColor(rule.platform);
                return (
                  <tr key={rule.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 14px", fontSize: "0.875rem", fontWeight: 500 }}>
                      {rule.label}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.82rem", fontFamily: "monospace" }}>
                      {rule.matchKind}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.82rem", fontFamily: "monospace", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span title={rule.matchPattern}>{rule.matchPattern.slice(0, 40)}{rule.matchPattern.length > 40 ? "…" : ""}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 7px",
                          borderRadius: "999px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: pc.bg,
                          color: pc.color,
                        }}
                      >
                        {platformLabel(rule.platform)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(rule)}
                        disabled={isPending}
                        title={rule.enabled ? "Disable" : "Enable"}
                        style={{
                          width: "40px",
                          height: "22px",
                          borderRadius: "999px",
                          border: "none",
                          background: rule.enabled ? "#16a34a" : "#d1d5db",
                          cursor: isPending ? "not-allowed" : "pointer",
                          position: "relative",
                          transition: "background 0.2s",
                        }}
                        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: rule.enabled ? "20px" : "3px",
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                          }}
                        />
                      </button>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {rule.matchCount.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.8rem", color: "#6b7280" }}>
                      {formatDateTime(rule.lastMatchedAt)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setEditingRule(rule);
                          }}
                          disabled={isPending}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #d1d5db",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          disabled={isPending}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #fca5a5",
                            color: "#dc2626",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create modal ───────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal onClose={() => { setShowCreate(false); setFormError(null); }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem" }}>New keyword response</h2>
          <RuleForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreate(false); setFormError(null); }}
            isPending={isPending}
            submitLabel="Create"
            formError={formError}
          />
        </Modal>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      {editingRule && (
        <Modal onClose={() => { setEditingRule(null); setFormError(null); }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem" }}>Edit: {editingRule.label}</h2>
          <RuleForm
            initial={{
              label: editingRule.label,
              matchKind: editingRule.matchKind,
              matchPattern: editingRule.matchPattern,
              responseBody: editingRule.responseBody,
              platform: editingRule.platform ?? "",
              enabled: editingRule.enabled,
            }}
            onSubmit={handleEdit}
            onCancel={() => { setEditingRule(null); setFormError(null); }}
            isPending={isPending}
            submitLabel="Save changes"
            formError={formError}
          />
        </Modal>
      )}
    </>
  );
}
