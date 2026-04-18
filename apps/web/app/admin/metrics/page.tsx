import Link from "next/link";
import { getDailyRevenueSeries, type MetricsWindow } from "@littlecolorbook/db";
import { AdminNav } from "../../../components/admin/admin-nav";
import { MetricsLineChart } from "../../../components/admin/metrics-chart";
import { requireAdminSession } from "../../../lib/auth";
import { computeDashboardMetrics, windowFromRange } from "../../../lib/metrics";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
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
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
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
      <strong style={{ fontSize: "1.4rem", color: toneColor }}>{value}</strong>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0 }}>Metrics</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>{metrics.window.label}</p>
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
              Export CSV ↓
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
          <Tile label="Gross revenue" value={formatMoney(metrics.revenue.grossCents)} />
          <Tile label="Refunded" value={formatMoney(metrics.revenue.refundedCents)} tone={metrics.revenue.refundedCents > 0 ? "warn" : "default"} />
          <Tile label="Net revenue" value={formatMoney(metrics.revenue.netCents)} tone="good" />
          <Tile label="Gross margin" value={formatMoney(metrics.unit.grossMarginCents)} tone={metrics.unit.grossMarginCents > 0 ? "good" : "bad"} />
          <Tile label="Profit margin" value={formatPct(metrics.unit.profitMarginPct)} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Orders</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Paid orders" value={String(metrics.orders.paidOrders)} />
          <Tile label="AOV" value={formatMoney(metrics.unit.aovCents)} />
          <Tile label="PDF / print" value={`${metrics.orders.pdfOrders} / ${metrics.orders.printOrders}`} />
          <Tile label="Free samples" value={String(metrics.orders.samples)} />
          <Tile label="Refunds" value={String(metrics.orders.refundedOrders)} sub={formatPct(metrics.orders.refundRatePct) + " refund rate"} tone={metrics.orders.refundRatePct > 5 ? "warn" : "default"} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Funnel</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Samples created" value={String(metrics.funnel.samplesCreated)} />
          <Tile label="Samples → paid" value={String(metrics.funnel.samplesToPaid)} />
          <Tile label="Sample conversion" value={formatPct(metrics.funnel.sampleConversionPct)} tone="good" />
        </div>

        <h2 style={{ marginBottom: 0 }}>Unit economics</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Ad spend" value={formatMoney(metrics.costs.adSpendCents)} sub="Edit on the Ads page →" />
          <Tile label="New paying customers" value={String(metrics.unit.newPayingCustomers)} />
          <Tile label="CAC" value={metrics.unit.cacCents > 0 ? formatMoney(metrics.unit.cacCents) : "—"} sub="ad spend / new paying" />
          <Tile label="Cost per sample" value={metrics.funnel.samplesCreated > 0 ? formatMoney(metrics.unit.costPerSampleCents) : "—"} sub="ad + Gemini" />
          <Tile label="LTV (in window)" value={metrics.retention.payingCustomers > 0 ? formatMoney(metrics.retention.ltvCents) : "—"} sub="12-month view → Cohorts" />
          <Tile label="Repeat rate" value={formatPct(metrics.retention.repeatOrderRatePct)} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Costs breakdown</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Ad spend" value={formatMoney(metrics.costs.adSpendCents)} />
          <Tile label="Gemini (all)" value={formatMoney(metrics.costs.geminiTotalCents)} sub={`sample ${formatMoney(metrics.costs.geminiSampleCents)} · paid ${formatMoney(metrics.costs.geminiPaidCents)}`} />
          <Tile label="Stripe fees" value={formatMoney(metrics.costs.stripeFeeCents)} sub="2.9% + $0.30 per order" />
          <Tile label="Lulu (est.)" value={formatMoney(metrics.costs.luluEstimateCents)} sub="40% of print portion" />
          <Tile label="Total costs" value={formatMoney(metrics.costs.totalCents)} tone={metrics.costs.totalCents > metrics.revenue.netCents ? "bad" : "default"} />
        </div>

        <h2 style={{ marginBottom: 0 }}>Fulfillment queue</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <Tile label="Pending assembly" value={String(metrics.fulfillment.pendingAssembly)} sub="Preprocessing → PDF ready" />
          <Tile label="Awaiting Lulu" value={String(metrics.fulfillment.awaitingPrintSubmission)} tone={metrics.fulfillment.awaitingPrintSubmission > 5 ? "warn" : "default"} />
          <Tile label="In production" value={String(metrics.fulfillment.inProduction)} sub="Submitted + printing" />
          <Tile label="Shipped" value={String(metrics.fulfillment.shipped)} />
          <Tile label="Delivered" value={String(metrics.fulfillment.delivered)} tone="good" />
        </div>

        <p className="mini-note" style={{ marginTop: "20px" }}>
          Cost-per-sample and CAC require ad spend entries.{" "}
          <Link href="/admin/ads">Log ad spend →</Link>
          {" · "}
          Gemini cost is estimated at ${Number(process.env.GEMINI_COST_CENTS_PER_IMAGE ?? "4") / 100} per render
          (configurable via GEMINI_COST_CENTS_PER_IMAGE env). Lulu cost is a 40% estimate until we wire per-job cost
          tracking.
        </p>
      </section>
    </main>
  );
}
