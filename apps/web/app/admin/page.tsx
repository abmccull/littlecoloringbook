import { getAdminOrderDetail, listAdminOrders } from "@littlecolorbook/db";
import { AdminConsole } from "../../components/admin-console";
import { AdminNav, AdminTiles } from "../../components/admin/admin-nav";
import { requireAdminSession } from "../../lib/auth";
import { computeDashboardMetrics } from "../../lib/metrics";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function PulseCard({
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
  return (
    <div className={`admin-pulse-card admin-pulse-card-${tone}`}>
      <span className="admin-pulse-card-label">{label}</span>
      <strong className="admin-pulse-card-value">{value}</strong>
      {sub ? <span className="admin-pulse-card-sub">{sub}</span> : null}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const session = await requireAdminSession();
  const { orderId } = await searchParams;
  const orders = await listAdminOrders(25);

  let dashboardMetrics: Awaited<ReturnType<typeof computeDashboardMetrics>> | null = null;
  try {
    dashboardMetrics = await computeDashboardMetrics("30d");
  } catch (error) {
    console.error("AdminPage metrics failed", error);
  }

  const selectedOrderId = orderId ?? orders[0]?.id ?? null;
  const selectedOrder = selectedOrderId ? await getAdminOrderDetail(selectedOrderId) : null;

  return (
    <main className="admin-page-shell">
      <AdminNav sessionEmail={session.email} />

      <section className="admin-page-intro">
        <div className="section-copy">
          <span className="pill">Admin command center</span>
          <h1>Run orders, revenue, spend, and fulfillment from one surface.</h1>
          <p className="lede">
            Start with the live business pulse, then drop into the queue to resolve production issues,
            customer communication, and print handoff without hunting across disconnected admin screens.
          </p>
        </div>

        <AdminTiles />

        <div className="surface admin-command-surface">
          <div className="admin-command-copy">
            <span className="pill">30-day business pulse</span>
            <h2>Meta spend, unit economics, and fulfillment are now first-class.</h2>
            <p className="lede">
              This admin landing page should answer the operator question and the founder question at the same
              time: what is stuck right now, and is the business making money while orders are moving?
            </p>
            <p className="muted">
              Spend, CAC, sample conversion, revenue, AOV, and print queue health are pulled into the root
              surface so you do not have to bounce between operations and reporting.
            </p>
            <a className="admin-command-link" href="/admin/metrics?range=30d">
              Open full financial reporting
            </a>
          </div>

          <div className="admin-pulse-grid">
            {dashboardMetrics ? (
              <>
                <PulseCard
                  label="Net revenue"
                  sub="Last 30 days"
                  tone="good"
                  value={formatMoney(dashboardMetrics.revenue.netCents)}
                />
                <PulseCard
                  label="Paid orders"
                  sub="Captured and fulfilled pipeline"
                  value={String(dashboardMetrics.orders.paidOrders)}
                />
                <PulseCard
                  label="AOV"
                  sub="Average order value"
                  value={formatMoney(dashboardMetrics.unit.aovCents)}
                />
                <PulseCard
                  label="Ad spend"
                  sub="Meta-backed spend log"
                  tone={dashboardMetrics.costs.adSpendCents > dashboardMetrics.revenue.netCents ? "warn" : "default"}
                  value={formatMoney(dashboardMetrics.costs.adSpendCents)}
                />
                <PulseCard
                  label="CAC"
                  sub="Spend per new paying customer"
                  tone={dashboardMetrics.unit.cacCents > dashboardMetrics.unit.aovCents ? "warn" : "default"}
                  value={dashboardMetrics.unit.cacCents > 0 ? formatMoney(dashboardMetrics.unit.cacCents) : "—"}
                />
                <PulseCard
                  label="Sample conversion"
                  sub={`${dashboardMetrics.funnel.samplesToPaid} paid from ${dashboardMetrics.funnel.samplesCreated} samples`}
                  tone="good"
                  value={formatPct(dashboardMetrics.funnel.sampleConversionPct)}
                />
                <PulseCard
                  label="Awaiting print handoff"
                  sub="Books ready to send to Lulu"
                  tone={dashboardMetrics.fulfillment.awaitingPrintSubmission > 0 ? "warn" : "default"}
                  value={String(dashboardMetrics.fulfillment.awaitingPrintSubmission)}
                />
                <PulseCard
                  label="In production"
                  sub="Submitted and moving through print"
                  value={String(dashboardMetrics.fulfillment.inProduction)}
                />
              </>
            ) : (
              <>
                <PulseCard label="Net revenue" sub="Reporting unavailable" value="—" />
                <PulseCard label="Paid orders" sub="Reporting unavailable" value="—" />
                <PulseCard label="AOV" sub="Reporting unavailable" value="—" />
                <PulseCard label="Ad spend" sub="Reporting unavailable" value="—" />
                <PulseCard label="CAC" sub="Reporting unavailable" value="—" />
                <PulseCard label="Sample conversion" sub="Reporting unavailable" value="—" />
                <PulseCard label="Awaiting print handoff" sub="Reporting unavailable" value="—" />
                <PulseCard label="In production" sub="Reporting unavailable" value="—" />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="admin-page-body">
        <AdminConsole orders={orders} selectedOrder={selectedOrder} />
      </section>
    </main>
  );
}
