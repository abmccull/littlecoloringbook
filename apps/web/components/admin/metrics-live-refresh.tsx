"use client";

import { useEffect, useState } from "react";

const POLL_MS = 10_000;

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

type LiveShape = {
  metrics: {
    revenue: { grossCents: number; netCents: number; refundedCents: number };
    orders: { paidOrders: number; refundRatePct: number; samples: number };
    unit: { aovCents: number; grossMarginCents: number };
    fulfillment: { pendingAssembly: number; awaitingPrintSubmission: number; inProduction: number };
  };
  fetchedAt: string;
};

/**
 * Swaps live values into elements already server-rendered on the page.
 * We identify them by data-live-id — /admin/metrics stamps the IDs and
 * this component finds them at runtime without a React rerender of the
 * whole page.
 */
function applyLiveValues(payload: LiveShape) {
  const m = payload.metrics;
  const set = (id: string, value: string, tone?: "good" | "warn" | "bad" | "default") => {
    const el = document.querySelector<HTMLElement>(`[data-live-id="${id}"]`);
    if (!el) return;
    el.textContent = value;
    if (tone) {
      const toneColor =
        tone === "good" ? "#3a8879" : tone === "warn" ? "#d28a3b" : tone === "bad" ? "#c85a4a" : "var(--color-ink)";
      el.style.color = toneColor;
    }
  };

  set("revenue-gross", formatMoney(m.revenue.grossCents));
  set("revenue-refunded", formatMoney(m.revenue.refundedCents), m.revenue.refundedCents > 0 ? "warn" : "default");
  set("revenue-net", formatMoney(m.revenue.netCents), "good");
  set("margin-gross", formatMoney(m.unit.grossMarginCents), m.unit.grossMarginCents > 0 ? "good" : "bad");
  set("orders-paid", String(m.orders.paidOrders));
  set("orders-aov", formatMoney(m.unit.aovCents));
  set("orders-samples", String(m.orders.samples));
  set("orders-refund-rate", formatPct(m.orders.refundRatePct), m.orders.refundRatePct > 5 ? "warn" : "default");
  set("fulfillment-pending", String(m.fulfillment.pendingAssembly));
  set("fulfillment-awaiting-lulu", String(m.fulfillment.awaitingPrintSubmission), m.fulfillment.awaitingPrintSubmission > 5 ? "warn" : "default");
  set("fulfillment-in-prod", String(m.fulfillment.inProduction));
}

export function MetricsLiveRefresh({ range }: { range: string }) {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/metrics/live?range=${range}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const payload = (await response.json()) as LiveShape;
        if (cancelled) return;
        applyLiveValues(payload);
        setLastSync(new Date().toLocaleTimeString());
      } catch (error) {
        if (!cancelled) {
          console.error("[metrics-live] poll failed", error);
        }
      }
    };

    const interval = setInterval(poll, POLL_MS);
    poll(); // first fetch immediately
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [range, paused]);

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "0.8rem", color: "#8f7a68" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: paused ? "#c85a4a" : "#3a8879",
          }}
        />
        {paused ? "paused" : `live (every ${POLL_MS / 1000}s)`}
      </span>
      {lastSync ? <span>synced {lastSync}</span> : null}
      <button
        onClick={() => setPaused((p) => !p)}
        style={{
          border: "1px solid var(--line)",
          background: "var(--color-paper)",
          borderRadius: "6px",
          padding: "2px 8px",
          cursor: "pointer",
          fontSize: "0.75rem",
        }}
        type="button"
      >
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
