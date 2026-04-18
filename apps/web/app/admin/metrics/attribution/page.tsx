import Link from "next/link";
import { getUtmAttributionReport, type MetricsWindow } from "@littlecolorbook/db";
import { AdminNav } from "../../../../components/admin/admin-nav";
import { requireAdminSession } from "../../../../lib/auth";
import { windowFromRange } from "../../../../lib/metrics";

export const dynamic = "force-dynamic";

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export default async function AdminAttributionPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdminSession();
  const { range = "30d" } = await searchParams;
  const rangeKey = (["7d", "30d", "90d", "ytd", "all"] as const).includes(range as RangeKey)
    ? (range as RangeKey)
    : "30d";
  const w = windowFromRange(rangeKey);
  const window: MetricsWindow = { start: w.start, end: w.end };
  const rows = await getUtmAttributionReport(window);

  const totals = rows.reduce(
    (acc, r) => {
      acc.samples += r.samples;
      acc.paid += r.paid_orders;
      acc.revenue += r.revenue_cents;
      acc.refunded += r.refunded_cents;
      return acc;
    },
    { samples: 0, paid: 0, revenue: 0, refunded: 0 },
  );

  return (
    <main>
      <AdminNav sessionEmail={session.email} />
      <section style={{ padding: "24px", display: "grid", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0 }}>UTM attribution</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {w.label} · every paid + sample order grouped by the UTM tags captured at first landing.
            </p>
          </div>
          <nav style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            {(["7d", "30d", "90d", "ytd", "all"] as RangeKey[]).map((k) => (
              <Link
                href={`/admin/metrics/attribution?range=${k}`}
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
                {k.toUpperCase()}
              </Link>
            ))}
            <a href={`/api/admin/metrics/attribution/export?range=${rangeKey}`} style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
              Export CSV ↓
            </a>
          </nav>
        </div>

        {rows.length === 0 ? (
          <p className="muted">No orders in this window with UTM tags attached. Confirm your ad destination URLs include utm_source / utm_medium / utm_campaign.</p>
        ) : (
          <div style={{ overflowX: "auto", background: "var(--color-paper)", border: "1px solid var(--line)", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: "980px" }}>
              <thead>
                <tr style={{ background: "#faf3e8", borderBottom: "2px solid var(--line)" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Source</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Medium</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Campaign</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Path</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Samples</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Paid</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Sample→Paid</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Revenue</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Refunded</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>AOV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const aov = r.paid_orders > 0 ? r.revenue_cents / r.paid_orders : 0;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 12px" }}>{r.utm_source}</td>
                      <td style={{ padding: "8px 12px" }}>{r.utm_medium}</td>
                      <td style={{ padding: "8px 12px" }}>{r.utm_campaign}</td>
                      <td style={{ padding: "8px 12px", color: "#8f7a68" }}>{r.acquisition_path}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{r.samples}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{r.paid_orders}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{pct(r.paid_orders, r.samples)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{formatMoney(r.revenue_cents)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: r.refunded_cents > 0 ? "#c85a4a" : "inherit" }}>
                        {r.refunded_cents > 0 ? formatMoney(r.refunded_cents) : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{r.paid_orders > 0 ? formatMoney(aov) : "—"}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid var(--line)", background: "#faf3e8", fontWeight: 600 }}>
                  <td style={{ padding: "10px 12px" }} colSpan={4}>
                    Totals
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{totals.samples}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{totals.paid}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{pct(totals.paid, totals.samples)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatMoney(totals.revenue)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{totals.refunded > 0 ? formatMoney(totals.refunded) : "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{totals.paid > 0 ? formatMoney(totals.revenue / totals.paid) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mini-note">
          Attribution is first-touch — the UTMs on the landing URL when the customer started their session. Post-purchase
          order creates inherit them even if the actual checkout happened days later. If your ad URLs aren't tagged
          consistently, rows will cluster under "(none)".
        </p>
      </section>
    </main>
  );
}
