import { getCampaignMetricsSummaries, listNonDeletedCampaigns } from "@littlecolorbook/db";
import { formatMoney, formatRoas, dateNDaysAgo, today } from "../../../../lib/growth-format";

export const dynamic = "force-dynamic";

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GrowthCampaignsPage() {
  const dateFrom = dateNDaysAgo(7);
  const dateTo = today();

  const [campaigns, metricsMap] = await Promise.all([
    listNonDeletedCampaigns(),
    getCampaignMetricsSummaries({ dateFrom, dateTo }),
  ]);

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: "0.8rem",
    fontWeight: 600,
    borderBottom: "2px solid var(--line)",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "0.875rem",
    borderBottom: "1px solid var(--line)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <h1 style={{ margin: 0 }}>Campaigns</h1>
      <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
        {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} (non-deleted) ·{" "}
        7-day metrics show once the campaign_daily_metrics sync cron runs.
      </p>

      {campaigns.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            border: "1px solid var(--line)",
            borderRadius: "12px",
          }}
        >
          <p style={{ fontWeight: 700, margin: 0 }}>No campaigns yet</p>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Campaign structure will appear here once the first paid batch launches on or after May 2.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Campaign name</th>
                <th style={thStyle}>Objective</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>7d spend</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Purchases</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const m = metricsMap.get(campaign.metaId);
                const spendCents = m?.spendCents ?? 0;
                const purchases = m?.purchases ?? 0;
                const revenueCents = m?.revenueCents ?? 0;
                const roas =
                  spendCents > 0 && revenueCents > 0 ? revenueCents / spendCents : null;

                return (
                  <tr key={campaign.id}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{campaign.name}</span>
                      <br />
                      <span
                        style={{ fontSize: "0.75rem", color: "#7D4D3B", fontFamily: "monospace" }}
                      >
                        {campaign.metaId}
                      </span>
                    </td>
                    <td style={tdStyle}>{campaign.objective}</td>
                    <td style={tdStyle}>
                      <StatusPill status={campaign.status} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatMoney(spendCents)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{purchases}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatMoney(revenueCents)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        color: roas && roas >= 1 ? "#1E5E45" : "inherit",
                      }}
                    >
                      {formatRoas(roas)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
