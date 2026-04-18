import {
  listAdsByStatus,
  listNonDeletedAds,
  listAdDailyMetrics,
} from "@littlecolorbook/db";
import {
  formatMoney,
  formatPct,
  formatRoas,
  formatNum,
  dateNDaysAgo,
  today,
} from "../../../../lib/growth-format";

export const dynamic = "force-dynamic";

// ─── Kill / winner evaluation (inlined from packages/ads/src/rules.ts) ────────
// We inline the minimal logic here to avoid adding @littlecolorbook/ads as a
// dependency of @littlecolorbook/web (it reads YAML from disk, which works in
// a server component but requires package wiring + transpile config changes).

type MetricsSnapshot = {
  spendCents: number;
  addsToCart: number;
  purchases: number;
  cpa_cents: number | null;
  roas: number | null;
  hookRate: number | null;
  impressions: number;
  frequency: number | null;
};

function computeFlags(snap: MetricsSnapshot): string[] {
  const flags: string[] = [];

  // Kill: no cart after $15 spend
  if (snap.spendCents >= 1500 && snap.addsToCart === 0) {
    flags.push("kill:no_cart");
  }
  // Kill: CPA > 2.5× $30 target = $75
  if (snap.cpa_cents != null && snap.cpa_cents > 7500) {
    flags.push("kill:high_cpa");
  }
  // Kill: hook rate < 2% after 1k impressions
  if (snap.hookRate != null && snap.impressions >= 1000 && snap.hookRate < 0.02) {
    flags.push("kill:low_hook");
  }
  // Winner: spend ≥ $25, purchases ≥ 3, CPA ≤ $30
  if (snap.spendCents >= 2500 && snap.purchases >= 3 && snap.cpa_cents != null && snap.cpa_cents <= 3000) {
    flags.push("winner");
  }

  return flags;
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    ACTIVE:  { bg: "#DDF4EA", color: "#1E5E45" },
    PAUSED:  { bg: "#F4E7DA", color: "#7D4D3B" },
    DELETED: { bg: "#F4E7DA", color: "#7D4D3B" },
  };
  const c = colors[status] ?? { bg: "#F4E7DA", color: "#7D4D3B" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {status}
    </span>
  );
}

function FlagPill({ flag }: { flag: string }) {
  const isKill = flag.startsWith("kill");
  const isWinner = flag === "winner";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 700,
        marginRight: "4px",
        background: isKill ? "#c85a4a20" : isWinner ? "#DDF4EA" : "#F4E7DA",
        color: isKill ? "#c85a4a" : isWinner ? "#1E5E45" : "#7D4D3B",
      }}
    >
      {flag}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GrowthAdsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    page?: string;
    range?: string;
  }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "ALL";
  const sortBy = (params.sort ?? "roas") as "roas" | "cpa" | "ctr";
  const rangeStr = params.range ?? "7";
  const rangeDays = parseInt(rangeStr, 10);
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = 25;

  const dateFrom = dateNDaysAgo(rangeDays);
  const dateTo = today();

  // Fetch all non-deleted ads
  const allAds = statusFilter === "ACTIVE"
    ? await listAdsByStatus({ status: "ACTIVE", limit: 500 })
    : await listNonDeletedAds();

  // Fetch aggregated metrics for the date range
  const metricsRows = await listAdDailyMetrics({ dateFrom, dateTo, limit: 5000 });

  // Aggregate metrics per ad
  type AdSummary = {
    entityMetaId: string;
    spendCents: number;
    impressions: number;
    clicks: number;
    addsToCart: number;
    purchases: number;
    revenueCents: number;
    ctrSum: number;
    ctrCount: number;
    cpaCents: number | null;
    roas: number | null;
    hookRateSum: number;
    hookRateCount: number;
    frequencySum: number;
    frequencyCount: number;
  };

  const metricsMap = new Map<string, AdSummary>();
  for (const row of metricsRows) {
    const key = row.entityMetaId;
    const existing = metricsMap.get(key) ?? {
      entityMetaId: key,
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      addsToCart: 0,
      purchases: 0,
      revenueCents: 0,
      ctrSum: 0,
      ctrCount: 0,
      cpaCents: null,
      roas: null,
      hookRateSum: 0,
      hookRateCount: 0,
      frequencySum: 0,
      frequencyCount: 0,
    };

    existing.spendCents += row.spendCents ?? 0;
    existing.impressions += row.impressions ?? 0;
    existing.clicks += row.clicks ?? 0;
    existing.addsToCart += row.addsToCart ?? 0;
    existing.purchases += row.purchases ?? 0;
    existing.revenueCents += row.revenueCents ?? 0;

    if (row.ctr != null) {
      existing.ctrSum += parseFloat(row.ctr as unknown as string);
      existing.ctrCount++;
    }
    if (row.hookRate != null) {
      existing.hookRateSum += parseFloat(row.hookRate as unknown as string);
      existing.hookRateCount++;
    }
    if (row.frequency != null) {
      existing.frequencySum += parseFloat(row.frequency as unknown as string);
      existing.frequencyCount++;
    }

    // Recalculate derived metrics
    existing.cpaCents = existing.purchases > 0
      ? Math.round(existing.spendCents / existing.purchases)
      : null;
    existing.roas = existing.spendCents > 0 && existing.revenueCents > 0
      ? existing.revenueCents / existing.spendCents
      : null;

    metricsMap.set(key, existing);
  }

  // Build rows
  type AdRow = {
    id: string;
    metaId: string;
    name: string;
    status: string;
    spendCents: number;
    impressions: number;
    avgCtr: number | null;
    cpaCents: number | null;
    roas: number | null;
    avgFrequency: number | null;
    flags: string[];
  };

  const rows: AdRow[] = allAds.map((ad) => {
    const m = metricsMap.get(ad.metaId);
    const avgCtr = m && m.ctrCount > 0 ? m.ctrSum / m.ctrCount : null;
    const avgFreq = m && m.frequencyCount > 0 ? m.frequencySum / m.frequencyCount : null;
    const avgHookRate = m && m.hookRateCount > 0 ? m.hookRateSum / m.hookRateCount : null;

    const snap: MetricsSnapshot = {
      spendCents: m?.spendCents ?? 0,
      addsToCart: m?.addsToCart ?? 0,
      purchases: m?.purchases ?? 0,
      cpa_cents: m?.cpaCents ?? null,
      roas: m?.roas ?? null,
      hookRate: avgHookRate,
      impressions: m?.impressions ?? 0,
      frequency: avgFreq,
    };

    return {
      id: ad.id,
      metaId: ad.metaId,
      name: ad.name,
      status: ad.status,
      spendCents: m?.spendCents ?? 0,
      impressions: m?.impressions ?? 0,
      avgCtr,
      cpaCents: m?.cpaCents ?? null,
      roas: m?.roas ?? null,
      avgFrequency: avgFreq,
      flags: computeFlags(snap),
    };
  });

  // Sort
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "roas") {
      return (b.roas ?? -Infinity) - (a.roas ?? -Infinity);
    } else if (sortBy === "cpa") {
      const av = a.cpaCents ?? Infinity;
      const bv = b.cpaCents ?? Infinity;
      return av - bv;
    } else {
      return (b.avgCtr ?? -Infinity) - (a.avgCtr ?? -Infinity);
    }
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    fontSize: "0.8rem",
    fontWeight: 600,
    borderBottom: "2px solid var(--line)",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: "0.85rem",
    borderBottom: "1px solid var(--line)",
    verticalAlign: "middle",
  };

  function buildQuery(overrides: Record<string, string>) {
    const q = new URLSearchParams({
      status: statusFilter,
      sort: sortBy,
      range: rangeStr,
      page: String(pageNum),
      ...overrides,
    });
    return `/admin/growth/ads?${q.toString()}`;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <h1 style={{ margin: 0 }}>Ads</h1>

      {/* Filters */}
      <form method="GET" action="/admin/growth/ads" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Status
          <select name="status" defaultValue={statusFilter} style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <option value="ALL">All (non-deleted)</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Sort by
          <select name="sort" defaultValue={sortBy} style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <option value="roas">ROAS</option>
            <option value="cpa">CPA</option>
            <option value="ctr">CTR</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Date range
          <select name="range" defaultValue={rangeStr} style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="submit"
            style={{ padding: "6px 16px", borderRadius: "6px", background: "#241813", color: "#FFF8F2", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Apply
          </button>
        </div>
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", border: "1px solid var(--line)", borderRadius: "12px" }}>
          <p style={{ fontWeight: 700, margin: 0 }}>No ads yet</p>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            First paid batch launches on or after May 2. Ad data will appear here once the campaign goes live.
          </p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            {rows.length} ad{rows.length !== 1 ? "s" : ""} · page {pageNum} of {totalPages}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Ad name</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Spend ({rangeStr}d)</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Freq</th>
                  <th style={thStyle}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <span title={row.metaId} style={{ fontWeight: 500 }}>{row.name}</span>
                      <br />
                      <span style={{ fontSize: "0.75rem", color: "#7D4D3B", fontFamily: "monospace" }}>{row.metaId.slice(0, 12)}…</span>
                    </td>
                    <td style={tdStyle}><StatusPill status={row.status} /></td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatMoney(row.spendCents)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatNum(row.impressions)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatPct(row.avgCtr)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: row.cpaCents && row.cpaCents > 7500 ? "#c85a4a" : "inherit" }}>
                      {row.cpaCents != null ? formatMoney(row.cpaCents) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: row.roas && row.roas >= 1 ? "#1E5E45" : "inherit" }}>
                      {formatRoas(row.roas)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {row.avgFrequency != null ? row.avgFrequency.toFixed(1) : "—"}
                    </td>
                    <td style={tdStyle}>
                      {row.flags.length > 0
                        ? row.flags.map((f) => <FlagPill key={f} flag={f} />)
                        : <span className="muted" style={{ fontSize: "0.75rem" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.875rem" }}>
            {pageNum > 1 && (
              <a href={buildQuery({ page: String(pageNum - 1) })}>← Prev</a>
            )}
            <span className="muted">Page {pageNum} / {totalPages}</span>
            {pageNum < totalPages && (
              <a href={buildQuery({ page: String(pageNum + 1) })}>Next →</a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
