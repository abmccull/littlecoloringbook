import Link from "next/link";
import {
  getTopPerformingAds,
  listAdsByStatus,
  listNonDeletedCampaigns,
  listAgentProposals,
  listAgentJournal,
  listOrganicPosts,
  countCreativeAssetsBySource,
  listAdDailyMetrics,
} from "@littlecolorbook/db";
import {
  formatMoney,
  formatRoas,
  formatPct,
  formatDateTime,
  dateNDaysAgo,
  today,
} from "../../../lib/growth-format";

export const dynamic = "force-dynamic";

// ─── Spend aggregator ─────────────────────────────────────────────────────────

async function getSpendSummary() {
  const todayStr = today();

  const [day, week, month] = await Promise.all([
    listAdDailyMetrics({ dateFrom: todayStr, dateTo: todayStr, limit: 500 }),
    listAdDailyMetrics({ dateFrom: dateNDaysAgo(7), dateTo: todayStr, limit: 500 }),
    listAdDailyMetrics({ dateFrom: dateNDaysAgo(30), dateTo: todayStr, limit: 500 }),
  ]);

  const sum = (rows: { spendCents: number | null }[]) =>
    rows.reduce((acc, r) => acc + (r.spendCents ?? 0), 0);

  return {
    todayCents: sum(day),
    sevenDayCents: sum(week),
    thirtyDayCents: sum(month),
  };
}

// ─── Paid ads flag ────────────────────────────────────────────────────────────

function PaidAdsFlag() {
  const enabled = process.env.PAID_ADS_ENABLED === "true";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "0.8rem",
        fontWeight: 600,
        background: enabled ? "#DDF4EA" : "#F4E7DA",
        color: enabled ? "#1E5E45" : "#7D4D3B",
      }}
    >
      {enabled ? "Enabled" : "Disabled — launches May 2"}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    ACTIVE:    { bg: "#DDF4EA", color: "#1E5E45" },
    PAUSED:    { bg: "#F4E7DA", color: "#7D4D3B" },
    DELETED:   { bg: "#F4E7DA", color: "#7D4D3B" },
    scheduled: { bg: "#DDF5FF", color: "#175B77" },
    published: { bg: "#DDF4EA", color: "#1E5E45" },
    draft:     { bg: "#F4E7DA", color: "#7D4D3B" },
    pending:   { bg: "#FFD65A40", color: "#7D4D3B" },
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

// ─── Card shell ───────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--color-paper)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "16px 20px",
        display: "grid",
        gap: "12px",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{title}</h2>
      {children}
    </section>
  );
}

// ─── Stat item ────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>{label}</p>
      <strong style={{ fontSize: "1.3rem" }}>{value}</strong>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GrowthOverviewPage() {
  const sevenDaysAgo = dateNDaysAgo(7);
  const todayStr = today();

  const [
    spend,
    activeAds,
    campaigns,
    topAds,
    bottomAdsByCpa,
    pendingProposals,
    recentJournal,
    upcomingPosts,
    creativeSources,
  ] = await Promise.all([
    getSpendSummary(),
    listAdsByStatus({ status: "ACTIVE", limit: 1000 }),
    listNonDeletedCampaigns(),
    getTopPerformingAds({ metric: "roas", direction: "desc", limit: 5, dateFrom: sevenDaysAgo, dateTo: todayStr }),
    getTopPerformingAds({ metric: "cpa_cents", direction: "desc", limit: 5, dateFrom: sevenDaysAgo, dateTo: todayStr }),
    listAgentProposals({ status: "pending", limit: 50 }),
    listAgentJournal({ limit: 10 }),
    listOrganicPosts({ status: "scheduled", limit: 20 }),
    countCreativeAssetsBySource(),
  ]);

  const pendingTotal = pendingProposals.length;

  const activeCampaignCount = campaigns.filter((c) => c.status !== "DELETED" && c.status !== "PAUSED").length;

  // Upcoming posts: next 7 days from now
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const upcomingFiltered = upcomingPosts.filter((p) => {
    if (!p.scheduledAt) return false;
    const t = new Date(p.scheduledAt).getTime();
    return t >= nowMs && t <= nowMs + sevenDaysMs;
  });

  return (
    <div style={{ padding: "24px", display: "grid", gap: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Growth overview</h1>
        <PaidAdsFlag />
      </div>

      {/* ── Spend grid ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <Card title="Spend">
          <Stat label="Today" value={formatMoney(spend.todayCents)} />
          <Stat label="Last 7 days" value={formatMoney(spend.sevenDayCents)} />
          <Stat label="Last 30 days" value={formatMoney(spend.thirtyDayCents)} />
        </Card>

        <Card title="Active inventory">
          <Stat label="Active ads" value={String(activeAds.length)} />
          <Stat label="Active campaigns" value={String(activeCampaignCount)} />
          <Stat label="Total campaigns (non-deleted)" value={String(campaigns.length)} />
        </Card>

        <Card title="Creative library">
          {creativeSources.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>No assets yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "4px 0", fontSize: "0.8rem" }}>Source</th>
                  <th style={{ padding: "4px 0", fontSize: "0.8rem", textAlign: "right" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {creativeSources.map((s) => (
                  <tr key={s.source}>
                    <td style={{ padding: "2px 0", fontSize: "0.85rem" }}>{s.source}</td>
                    <td style={{ padding: "2px 0", fontSize: "0.85rem", textAlign: "right" }}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Agent proposals">
          <Stat
            label="Pending review"
            value={String(pendingTotal)}
          />
          {pendingTotal > 0 && (
            <Link href="/admin/growth/proposals" style={{ fontSize: "0.875rem" }}>
              Review proposals →
            </Link>
          )}
          {pendingTotal === 0 && (
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>No pending proposals.</p>
          )}
        </Card>
      </div>

      {/* ── Top + Bottom ads ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <Card title="Top 5 ads by ROAS — last 7 days">
          {topAds.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              No ad data yet. First paid batch launches on or after May 2.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "4px 8px 4px 0", fontSize: "0.8rem" }}>Ad ID</th>
                  <th style={{ padding: "4px 0", fontSize: "0.8rem", textAlign: "right" }}>Spend</th>
                  <th style={{ padding: "4px 0", fontSize: "0.8rem", textAlign: "right" }}>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {topAds.map((ad) => (
                  <tr key={ad.entityMetaId} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "4px 8px 4px 0", fontSize: "0.82rem", fontFamily: "monospace" }}>
                      {ad.entityMetaId.slice(0, 12)}…
                    </td>
                    <td style={{ padding: "4px 0", fontSize: "0.82rem", textAlign: "right" }}>
                      {formatMoney(ad.totalSpendCents)}
                    </td>
                    <td style={{ padding: "4px 0", fontSize: "0.82rem", textAlign: "right", fontWeight: 600 }}>
                      {formatRoas(ad.avgMetric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Bottom 5 ads by CPA — last 7 days">
          {bottomAdsByCpa.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              No ad data yet. First paid batch launches on or after May 2.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "4px 8px 4px 0", fontSize: "0.8rem" }}>Ad ID</th>
                  <th style={{ padding: "4px 0", fontSize: "0.8rem", textAlign: "right" }}>Spend</th>
                  <th style={{ padding: "4px 0", fontSize: "0.8rem", textAlign: "right" }}>CPA</th>
                </tr>
              </thead>
              <tbody>
                {bottomAdsByCpa.filter((ad) => ad.totalPurchases > 0).map((ad) => (
                  <tr key={ad.entityMetaId} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "4px 8px 4px 0", fontSize: "0.82rem", fontFamily: "monospace" }}>
                      {ad.entityMetaId.slice(0, 12)}…
                    </td>
                    <td style={{ padding: "4px 0", fontSize: "0.82rem", textAlign: "right" }}>
                      {formatMoney(ad.totalSpendCents)}
                    </td>
                    <td style={{ padding: "4px 0", fontSize: "0.82rem", textAlign: "right", fontWeight: 600, color: "#c85a4a" }}>
                      {ad.avgMetric != null ? formatMoney(ad.avgMetric) : "—"}
                    </td>
                  </tr>
                ))}
                {bottomAdsByCpa.filter((ad) => ad.totalPurchases > 0).length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "8px 0", fontSize: "0.875rem" }} className="muted">
                      No rows with purchases yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── Upcoming organic posts ───────────────────────────────────────────── */}
      <Card title={`Upcoming organic posts — next 7 days (${upcomingFiltered.length})`}>
        {upcomingFiltered.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            No posts scheduled in the next 7 days.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "6px" }}>
            {upcomingFiltered.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "6px",
                }}
              >
                <StatusPill status={p.status} />
                <span style={{ color: "#7D4D3B", minWidth: "110px" }}>
                  {p.scheduledAt ? formatDateTime(p.scheduledAt) : "—"}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#7D4D3B" }}>
                  {p.platform}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.caption ? p.caption.slice(0, 80) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/growth/organic" style={{ fontSize: "0.875rem" }}>
          View full calendar →
        </Link>
      </Card>

      {/* ── Recent journal ───────────────────────────────────────────────────── */}
      <Card title="Recent agent journal (last 10)">
        {recentJournal.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>No journal entries yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "6px" }}>
            {recentJournal.map((entry) => (
              <li
                key={entry.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "6px",
                }}
              >
                <StatusPill status={entry.kind} />
                <span style={{ color: "#7D4D3B", minWidth: "110px", flexShrink: 0 }}>
                  {formatDateTime(entry.createdAt)}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.note}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/growth/journal" style={{ fontSize: "0.875rem" }}>
          Browse full journal →
        </Link>
      </Card>
    </div>
  );
}
