import Link from "next/link";
import { getDailyRevenueSeries, type MetricsWindow } from "@littlecolorbook/db";
import { AdminNav } from "../../../components/admin/admin-nav";
import { MetricsLineChart } from "../../../components/admin/metrics-chart";
import { MetricsLiveRefresh } from "../../../components/admin/metrics-live-refresh";
import { requireAdminSession } from "../../../lib/auth";
import { computeDashboardMetrics, windowFromRange } from "../../../lib/metrics";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function describeAdSpendSource(costs: Awaited<ReturnType<typeof computeDashboardMetrics>>["costs"]) {
  if (costs.adSpendMetaSyncedCents > 0 && costs.adSpendManualCents > 0) {
    return `Meta ${costs.adSpendMetaSourceLevel ?? "sync"} data + manual adjustments`;
  }
  if (costs.adSpendMetaSyncedCents > 0) {
    return `Meta ${costs.adSpendMetaSourceLevel ?? "sync"} data`;
  }
  if (costs.adSpendManualCents > 0) {
    return "Manual fallback / non-Meta spend";
  }
  return "No spend captured in this window";
}

function describeLuluCostSource(costs: Awaited<ReturnType<typeof computeDashboardMetrics>>["costs"]) {
  return `actual ${formatMoney(costs.luluActualCents)} | quoted ${formatMoney(costs.luluQuotedCents)} | fallback ${formatMoney(costs.luluFallbackCents)}`;
}

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";
const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  ytd: "YTD",
  all: "All",
};

function Tile({
  label,
  value,
  sub,
  tone = "default",
  liveId,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
  liveId?: string;
}) {
  const toneColor =
    tone === "good" ? "#3a8879" : tone === "warn" ? "#d28a3b" : tone === "bad" ? "#c85a4a" : "var(--color-ink)";

  return (
    <div
      style={{
        padding: "16px 20px",
        background: "var(--color-paper)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        display: "grid",
        gap: "4px",
      }}
    >
      <span className="muted mini-note">{label}</span>
      <strong data-live-id={liveId} style={{ fontSize: "1.4rem", color: toneColor }}>
        {value}
      </strong>
      {sub ? <span className="mini-note">{sub}</span> : null}
    </div>
  );
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdminSession();
  const { range = "30d" } = await searchParams;
  const rangeKey = (["7d", "30d", "90d", "ytd", "all"] as const).includes(range as RangeKey)
    ? (range as RangeKey)
    : "30d";
  const metrics = await computeDashboardMetrics(rangeKey);
  const w = windowFromRange(rangeKey);
  const window: MetricsWindow = { start: w.start, end: w.end };
  const series = await getDailyRevenueSeries(window);
  const revenueSeries = series.map((row) => ({ day: row.day, value: row.revenue_cents }));
  const ordersSeries = series.map((row) => ({ day: row.day, value: row.paid_orders }));
  const samplesSeries = series.map((row) => ({ day: row.day, value: row.samples }));

  return (
    <main>
      <AdminNav sessionEmail={session.email} />
      <section style={{ padding: "24px", display: "grid", gap: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Metrics</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {metrics.window.label}
            </p>
            <div style={{ marginTop: "6px" }}>
              <MetricsLiveRefresh range={rangeKey} />
            </div>
          </div>
          <nav style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
              <Link
                href={`/admin/metrics?range=${k}`}
                key={k}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  background: k === rangeKey ? "var(--color-ink)" : "var(--color-paper)",
                  color: k === rangeKey ? "#fff" : "var(--color-ink)",
                  fontSize: "0.85rem",
                }}
              >
                {RANGE_LABELS[k]}
              </Link>
            ))}
            <a
              href={`/api/admin/metrics/export?range=${rangeKey}&format=summary`}
              style={{ padding: "6px 12px", fontSize: "0.85rem", color: "var(--color-ink)" }}
            >
              Export CSV
            </a>
          </nav>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          <MetricsLineChart points={revenueSeries} label="Daily revenue" yFormatter={(v) => formatMoney(v)} />
          <MetricsLineChart points={ordersSeries} label="Daily paid orders" stroke="#3a8879" fill="#e5f0ec" />
          <MetricsLineChart points={samplesSeries} label="Daily samples" stroke="#d28a3b" fill="#faf0d8" />
        </div>

        <h2 style={{ marginBottom: 0 }}>Revenue</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile liveId="revenue-gross" label="Gross revenue" value={formatMoney(metrics.revenue.grossCents)} />
          <Tile
            liveId="revenue-refunded"
            label="Refunded"
            tone={metrics.revenue.refundedCents > 0 ? "warn" : "default"}
            value={formatMoney(metrics.revenue.refundedCents)}
          />
          <Tile liveId="revenue-net" label="Net revenue" tone="good" value={formatMoney(metrics.revenue.netCents)} />
          <Tile
            liveId="margin-gross"
            label="Gross margin"
            tone={metrics.unit.grossMarginCents > 0 ? "good" : "bad"}
            value={formatMoney(metrics.unit.grossMarginCents)}
          />
          <Tile label="Profit margin" value={formatPct(metrics.unit.profitMarginPct)} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Orders</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile liveId="orders-paid" label="Paid orders" value={String(metrics.orders.paidOrders)} />
          <Tile liveId="orders-aov" label="AOV" value={formatMoney(metrics.unit.aovCents)} />
          <Tile label="PDF / print" value={`${metrics.orders.pdfOrders} / ${metrics.orders.printOrders}`} />
          <Tile liveId="orders-samples" label="Free samples" value={String(metrics.orders.samples)} />
          <Tile
            liveId="orders-refund-rate"
            label="Refunds"
            sub={`${formatPct(metrics.orders.refundRatePct)} refund rate`}
            tone={metrics.orders.refundRatePct > 5 ? "warn" : "default"}
            value={String(metrics.orders.refundedOrders)}
          />
        </div>

        <h2 style={{ marginBottom: 0 }}>Funnel</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Samples created" value={String(metrics.funnel.samplesCreated)} />
          <Tile label="Samples -> paid" value={String(metrics.funnel.samplesToPaid)} />
          <Tile label="Sample conversion" tone="good" value={formatPct(metrics.funnel.sampleConversionPct)} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Unit economics</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Ad spend" sub={describeAdSpendSource(metrics.costs)} value={formatMoney(metrics.costs.adSpendCents)} />
          <Tile label="New paying customers" value={String(metrics.unit.newPayingCustomers)} />
          <Tile
            label="CAC"
            sub="ad spend / new paying"
            value={metrics.unit.cacCents > 0 ? formatMoney(metrics.unit.cacCents) : "—"}
          />
          <Tile
            label="Cost per sample"
            sub="ad + Gemini"
            value={metrics.funnel.samplesCreated > 0 ? formatMoney(metrics.unit.costPerSampleCents) : "—"}
          />
          <Tile
            label="LTV (in window)"
            sub="12-month view -> Cohorts"
            value={metrics.retention.payingCustomers > 0 ? formatMoney(metrics.retention.ltvCents) : "—"}
          />
          <Tile label="Repeat rate" value={formatPct(metrics.retention.repeatOrderRatePct)} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Costs breakdown</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Ad spend" sub={describeAdSpendSource(metrics.costs)} value={formatMoney(metrics.costs.adSpendCents)} />
          <Tile
            label="Gemini (all)"
            sub={`sample ${formatMoney(metrics.costs.geminiSampleCents)} | paid ${formatMoney(metrics.costs.geminiPaidCents)}`}
            value={formatMoney(metrics.costs.geminiTotalCents)}
          />
          <Tile label="Stripe fees" sub="2.9% + $0.30 per order" value={formatMoney(metrics.costs.stripeFeeCents)} />
          <Tile label="Lulu" sub={describeLuluCostSource(metrics.costs)} value={formatMoney(metrics.costs.luluTotalCents)} />
          <Tile
            label="Total costs"
            tone={metrics.costs.totalCents > metrics.revenue.netCents ? "bad" : "default"}
            value={formatMoney(metrics.costs.totalCents)}
          />
        </div>

        <h2 style={{ marginBottom: 0 }}>Fulfillment queue</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile
            liveId="fulfillment-pending"
            label="Pending assembly"
            sub="Preprocessing -> PDF ready"
            value={String(metrics.fulfillment.pendingAssembly)}
          />
          <Tile
            liveId="fulfillment-awaiting-lulu"
            label="Awaiting Lulu"
            tone={metrics.fulfillment.awaitingPrintSubmission > 5 ? "warn" : "default"}
            value={String(metrics.fulfillment.awaitingPrintSubmission)}
          />
          <Tile
            liveId="fulfillment-in-prod"
            label="In production"
            sub="Submitted + printing"
            value={String(metrics.fulfillment.inProduction)}
          />
          <Tile label="Shipped" value={String(metrics.fulfillment.shipped)} />
          <Tile label="Delivered" tone="good" value={String(metrics.fulfillment.delivered)} />
        </div>

        <p className="mini-note" style={{ marginTop: "20px" }}>
          Ad spend uses synced Meta daily metrics when available and falls back to manual Meta entries only when the sync
          is empty. Manual entries still add non-Meta spend and operator adjustments. Gemini cost is now priced from
          per-render usage in the generation pipeline. Lulu cost uses captured fulfillment job cost first, then live
          Lulu production quotes, and only falls back to the shared formula when neither exists.{" "}
          <Link href="/admin/ads">Open spend adjustments</Link>
        </p>
      </section>
    </main>
  );
}
