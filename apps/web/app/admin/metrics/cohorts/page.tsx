import Link from "next/link";
import { AdminNav } from "../../../../components/admin/admin-nav";
import { requireAdminSession } from "../../../../lib/auth";
import {
  buildCohortReport,
  formatCohortLabel,
  COHORT_MAX_MONTHS_SINCE,
} from "../../../../lib/cohorts";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

type Mode = "cumulative" | "monthly" | "ltv";

function pickSeries(row: {
  cumulativeRevenueCents: number[];
  monthlyRevenueCents: number[];
  monthlyLtvCents: number[];
}, mode: Mode) {
  switch (mode) {
    case "monthly":
      return row.monthlyRevenueCents;
    case "ltv":
      return row.monthlyLtvCents;
    case "cumulative":
    default:
      return row.cumulativeRevenueCents;
  }
}

function cellTone(value: number, peerMax: number) {
  if (value <= 0) return { bg: "transparent", color: "#c2b5a4" };
  if (peerMax === 0) return { bg: "transparent", color: "var(--color-ink)" };
  const intensity = Math.min(1, value / peerMax);
  // Interpolate between pale mint (low) and deep teal (high).
  const alpha = 0.15 + 0.55 * intensity;
  return { bg: `rgba(58, 136, 121, ${alpha.toFixed(2)})`, color: intensity > 0.55 ? "#fff" : "var(--color-ink)" };
}

export default async function AdminCohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await requireAdminSession();
  const { mode: modeParam = "cumulative" } = await searchParams;
  const mode: Mode = modeParam === "monthly" || modeParam === "ltv" ? (modeParam as Mode) : "cumulative";
  const report = await buildCohortReport();

  const monthHeaders = Array.from({ length: COHORT_MAX_MONTHS_SINCE + 1 }, (_, i) => `M${i}`);

  // Peer-max for cell coloring: per-column max so each months-since
  // bucket gets its own intensity scale. Keeps colors meaningful even
  // when M0 revenue dwarfs later months.
  const columnMaxes: number[] = new Array(COHORT_MAX_MONTHS_SINCE + 1).fill(0);
  for (const row of report.rows) {
    const series = pickSeries(row, mode);
    for (let i = 0; i < series.length; i++) {
      if (series[i] > columnMaxes[i]) columnMaxes[i] = series[i];
    }
  }

  return (
    <main>
      <AdminNav sessionEmail={session.email} />
      <section style={{ padding: "24px", display: "grid", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0 }}>Cohort analysis</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              12-month retention-style view. Each row is a month of first-time paying customers. Each column is how
              many months after acquisition.
            </p>
          </div>
          <nav style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            {(["cumulative", "monthly", "ltv"] as const).map((k) => (
              <Link
                href={`/admin/metrics/cohorts?mode=${k}`}
                key={k}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                  background: k === mode ? "var(--color-ink)" : "var(--color-paper)",
                  color: k === mode ? "#fff" : "var(--color-ink)",
                  fontSize: "0.85rem",
                }}
              >
                {k === "cumulative" ? "Cumulative revenue" : k === "monthly" ? "Monthly revenue" : "Per-customer LTV"}
              </Link>
            ))}
            <a
              href="/api/admin/metrics/cohorts/export"
              style={{ padding: "6px 12px", fontSize: "0.85rem", color: "var(--color-ink)" }}
            >
              Export CSV ↓
            </a>
          </nav>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ padding: "16px 20px", background: "var(--color-paper)", border: "1px solid var(--line)", borderRadius: "12px" }}>
            <span className="muted mini-note">Mature cohorts (12+ months old)</span>
            <strong style={{ display: "block", fontSize: "1.4rem" }}>{report.matureCohortCount}</strong>
          </div>
          <div style={{ padding: "16px 20px", background: "var(--color-paper)", border: "1px solid var(--line)", borderRadius: "12px" }}>
            <span className="muted mini-note">Blended 12-month LTV</span>
            <strong style={{ display: "block", fontSize: "1.4rem" }}>
              {report.matureCohortCount > 0 ? formatMoney(report.blendedLtv12mCents) : "—"}
            </strong>
            <span className="mini-note">Weighted mean across mature cohorts</span>
          </div>
          <div style={{ padding: "16px 20px", background: "var(--color-paper)", border: "1px solid var(--line)", borderRadius: "12px" }}>
            <span className="muted mini-note">Cohorts tracked</span>
            <strong style={{ display: "block", fontSize: "1.4rem" }}>{report.rows.length}</strong>
            <span className="mini-note">Last 24 months</span>
          </div>
        </div>

        {report.rows.length === 0 ? (
          <p className="muted">
            No paid orders yet. Cohort table fills in as real customers land. Come back after a month.
          </p>
        ) : (
          <div style={{ overflowX: "auto", background: "var(--color-paper)", border: "1px solid var(--line)", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: "800px" }}>
              <thead>
                <tr style={{ background: "#faf3e8", borderBottom: "2px solid var(--line)" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", position: "sticky", left: 0, background: "#faf3e8", zIndex: 1 }}>Cohort</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Size</th>
                  {monthHeaders.map((h, i) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "right" }} title={`Month ${i} after first paid order`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => {
                  const series = pickSeries(row, mode);
                  return (
                    <tr key={row.cohortMonth} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, position: "sticky", left: 0, background: "var(--color-paper)", zIndex: 1 }}>
                        {formatCohortLabel(row.cohortMonth)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#8f7a68" }}>{row.customerCount}</td>
                      {series.map((value, i) => {
                        const tone = cellTone(value, columnMaxes[i] ?? 0);
                        const active = i <= row.latestActiveMonths;
                        return (
                          <td
                            key={i}
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              background: tone.bg,
                              color: active ? tone.color : "#c2b5a4",
                            }}
                          >
                            {active ? formatMoney(value) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mini-note">
          Cumulative mode = running revenue per cohort. Monthly mode = revenue only in that month since acquisition.
          LTV mode = per-customer cumulative (cumulative revenue ÷ cohort size). Only cohorts that reached M11 are
          counted in the blended 12-month LTV.
        </p>
      </section>
    </main>
  );
}
