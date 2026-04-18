"use client";

import { useState } from "react";

const PLATFORMS = ["meta", "google", "tiktok", "youtube", "reddit", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AdSpendForm() {
  const [spendDate, setSpendDate] = useState(today());
  const [platform, setPlatform] = useState<Platform>("meta");
  const [campaign, setCampaign] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setMsg("Enter a positive amount.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const response = await fetch("/api/admin/ad-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          spendDate,
          platform,
          campaign: campaign || null,
          amountCents,
          notes: notes || null,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        setMsg(text || `Error: ${response.status}`);
        return;
      }
      setMsg("Saved.");
      setCampaign("");
      setAmount("");
      setNotes("");
      setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack-tight" onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        <label className="stack-tight">
          <span className="mini-note">Date</span>
          <input
            onChange={(e) => setSpendDate(e.target.value)}
            required
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)" }}
            type="date"
            value={spendDate}
          />
        </label>
        <label className="stack-tight">
          <span className="mini-note">Platform</span>
          <select
            onChange={(e) => setPlatform(e.target.value as Platform)}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)" }}
            value={platform}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="stack-tight">
          <span className="mini-note">Campaign (optional)</span>
          <input
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="Retargeting · Mother's Day"
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)" }}
            type="text"
            value={campaign}
          />
        </label>
        <label className="stack-tight">
          <span className="mini-note">Amount (USD)</span>
          <input
            onChange={(e) => setAmount(e.target.value)}
            placeholder="125.50"
            required
            step="0.01"
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)" }}
            type="number"
            value={amount}
          />
        </label>
      </div>
      <label className="stack-tight">
        <span className="mini-note">Notes (optional)</span>
        <input
          onChange={(e) => setNotes(e.target.value)}
          placeholder="CPM spike on Tuesday; paused creative B."
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)" }}
          type="text"
          value={notes}
        />
      </label>
      <div>
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Saving…" : "Log spend"}
        </button>
        {msg ? <span className="muted" style={{ marginLeft: "12px" }}>{msg}</span> : null}
      </div>
    </form>
  );
}
