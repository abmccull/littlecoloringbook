import { listTopPerformingTagCombos } from "@littlecolorbook/db";
import type { TopTagComboResult } from "@littlecolorbook/db";
import { IntelligenceHeatmap } from "../../../../../components/admin/intelligence-heatmap";
import type { HeatmapCell } from "../../../../../components/admin/intelligence-heatmap";
import { formatRoas, formatMoney, formatPct, dateNDaysAgo, today } from "../../../../../lib/growth-format";

export const dynamic = "force-dynamic";

// ─── Semantic tag axis options ────────────────────────────────────────────────

const AXIS_OPTIONS = [
  { value: "scene_type",     label: "Scene type" },
  { value: "setting",        label: "Setting" },
  { value: "subject_type",   label: "Subject type" },
  { value: "subject_count",  label: "Subject count" },
  { value: "emotion",        label: "Emotion" },
  { value: "pose",           label: "Pose" },
  { value: "complexity_score", label: "Complexity score" },
] as const;

type AxisKey = (typeof AXIS_OPTIONS)[number]["value"];

const VALID_AXIS_KEYS: AxisKey[] = AXIS_OPTIONS.map((o) => o.value);

function isValidAxisKey(v: unknown): v is AxisKey {
  return typeof v === "string" && (VALID_AXIS_KEYS as string[]).includes(v);
}

type ValidMetric = "roas" | "cpa_cents" | "ctr";

function isValidMetric(v: unknown): v is ValidMetric {
  return v === "roas" || v === "cpa_cents" || v === "ctr";
}

// ─── Grouping logic ───────────────────────────────────────────────────────────

/**
 * Parse a tag fingerprint JSON string and extract the value for a given key.
 */
function extractTagValue(fingerprint: string, key: string): string | null {
  try {
    const obj = JSON.parse(fingerprint) as Record<string, unknown>;
    const v = obj[key];
    if (v == null) return null;
    return String(v);
  } catch {
    return null;
  }
}

type GroupedCell = {
  xValue: string;
  yValue: string;
  roasSum: number;
  count: number;
  adCountTotal: number;
};

function groupCombosIntoHeatmapCells(
  combos: TopTagComboResult[],
  xAxis: AxisKey,
  yAxis: AxisKey,
  minAdCount: number,
): HeatmapCell[] {
  const cellMap = new Map<string, GroupedCell>();

  for (const combo of combos) {
    const xVal = extractTagValue(combo.tagFingerprint, xAxis);
    const yVal = extractTagValue(combo.tagFingerprint, yAxis);
    if (!xVal || !yVal) continue;
    if (combo.avgRoas == null) continue;

    const key = `${xVal}||${yVal}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.roasSum += combo.avgRoas;
      existing.count += 1;
      existing.adCountTotal += combo.adCount;
    } else {
      cellMap.set(key, {
        xValue: xVal,
        yValue: yVal,
        roasSum: combo.avgRoas,
        count: 1,
        adCountTotal: combo.adCount,
      });
    }
  }

  return Array.from(cellMap.values())
    .filter((c) => c.adCountTotal >= minAdCount)
    .map((c) => ({
      xValue: c.xValue,
      yValue: c.yValue,
      avgRoas: c.count > 0 ? c.roasSum / c.count : null,
      adCount: c.adCountTotal,
    }));
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "6px",
  border: "1px solid var(--line)",
  fontSize: "0.875rem",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
};

const thStyle: React.CSSProperties = {
  padding: "6px 8px 6px 0",
  textAlign: "left",
  fontSize: "0.78rem",
  fontWeight: 600,
  borderBottom: "2px solid var(--line)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px 6px 0",
  fontSize: "0.82rem",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
};

function prettifyFingerprint(fp: string): string {
  try {
    const obj = JSON.parse(fp) as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ");
  } catch {
    return fp;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IntelligenceTagsPage({
  searchParams,
}: {
  searchParams: Promise<{
    xAxis?: string;
    yAxis?: string;
    metric?: string;
    minAdCount?: string;
    range?: string;
  }>;
}) {
  const params = await searchParams;

  const xAxis: AxisKey = isValidAxisKey(params.xAxis) ? params.xAxis : "scene_type";
  const yAxis: AxisKey = isValidAxisKey(params.yAxis) ? params.yAxis : "subject_type";
  const metric: ValidMetric = isValidMetric(params.metric) ? params.metric : "roas";
  const minAdCount = Math.max(0, parseInt(params.minAdCount ?? "1", 10));
  const rangeDays = parseInt(params.range ?? "30", 10);

  const dateFrom = dateNDaysAgo(rangeDays);
  const dateTo = today();

  // Fetch top 200 combos for heatmap grouping, and top 20 for the table below
  const [allCombos, topCombos] = await Promise.all([
    listTopPerformingTagCombos({ dateFrom, dateTo, metric, limit: 200 }),
    listTopPerformingTagCombos({ dateFrom, dateTo, metric: "roas", limit: 20 }),
  ]);

  // Group into heatmap cells
  const cells = groupCombosIntoHeatmapCells(allCombos, xAxis, yAxis, minAdCount);

  // Build sorted unique axis values
  const xValues = Array.from(new Set(cells.map((c) => c.xValue))).sort();
  const yValues = Array.from(new Set(cells.map((c) => c.yValue))).sort();

  const xAxisLabel = AXIS_OPTIONS.find((o) => o.value === xAxis)?.label ?? xAxis;
  const yAxisLabel = AXIS_OPTIONS.find((o) => o.value === yAxis)?.label ?? yAxis;

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
        display: "grid",
        gap: "20px",
      }}
    >
      <h1 style={{ margin: 0 }}>Semantic Tag Heatmap</h1>

      {/* Filter bar */}
      <form
        method="GET"
        action="/admin/growth/intelligence/tags"
        style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}
        aria-label="Heatmap filters"
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          X axis
          <select name="xAxis" defaultValue={xAxis} style={selectStyle}>
            {AXIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Y axis
          <select name="yAxis" defaultValue={yAxis} style={selectStyle}>
            {AXIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Metric (sort)
          <select name="metric" defaultValue={metric} style={selectStyle}>
            <option value="roas">ROAS</option>
            <option value="cpa_cents">CPA</option>
            <option value="ctr">CTR</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Min ads per cell
          <input
            name="minAdCount"
            type="number"
            min="0"
            step="1"
            defaultValue={minAdCount}
            style={{ ...selectStyle, width: "80px" }}
            aria-label="Minimum ad count per heatmap cell"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Date range
          <select name="range" defaultValue={String(rangeDays)} style={selectStyle}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>

        <button
          type="submit"
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            background: "#241813",
            color: "#FFF8F2",
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Apply
        </button>
      </form>

      {/* Heatmap grid (client component) */}
      <section
        style={{
          background: "var(--color-paper)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "20px",
        }}
        aria-label="ROAS heatmap grid"
      >
        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700 }}>
          ROAS by {xAxisLabel} &times; {yAxisLabel}
        </h2>
        <IntelligenceHeatmap
          cells={cells}
          xValues={xValues}
          yValues={yValues}
          xAxisLabel={xAxisLabel}
          yAxisLabel={yAxisLabel}
        />
      </section>

      {/* Top 20 tag combos table */}
      <section
        style={{
          background: "var(--color-paper)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "20px",
        }}
        aria-label="Top 20 tag combos by ROAS"
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 700 }}>
          Top 20 tag combos by ROAS — last {rangeDays} days
        </h2>
        {topCombos.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            No tag combo data yet. Tag creative assets to see results here.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Tag combo</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Hook rate</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Spend</th>
                </tr>
              </thead>
              <tbody>
                {topCombos.map((combo, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        maxWidth: "320px",
                        wordBreak: "break-word",
                      }}
                    >
                      {prettifyFingerprint(combo.tagFingerprint)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: 600,
                        color: (combo.avgRoas ?? 0) >= 1 ? "#1E5E45" : "inherit",
                      }}
                    >
                      {formatRoas(combo.avgRoas)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {combo.avgCpaCents != null
                        ? formatMoney(combo.avgCpaCents)
                        : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatPct(combo.avgCtr)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatPct(combo.avgHookRate)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {combo.adCount}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {formatMoney(combo.totalSpendCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
