"use client";

import { useState } from "react";
import { formatRoas } from "../../lib/growth-format";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeatmapCell = {
  xValue: string;
  yValue: string;
  avgRoas: number | null;
  adCount: number;
};

export type IntelligenceHeatmapProps = {
  cells: HeatmapCell[];
  xValues: string[];
  yValues: string[];
  xAxisLabel: string;
  yAxisLabel: string;
};

// ─── Color scaling ────────────────────────────────────────────────────────────

// 9 buckets from red → yellow → green
const COLOR_BUCKETS = [
  "#c85a4a", // 0 — worst
  "#d4734a",
  "#e09a40",
  "#e8b840",
  "#f0d040",
  "#c8d840",
  "#90c840",
  "#50b040",
  "#1E5E45", // 8 — best
] as const;

function roasToBucketIndex(
  roas: number,
  min: number,
  max: number,
): number {
  if (max === min) return 4; // middle bucket when all same
  const ratio = (roas - min) / (max - min);
  return Math.min(8, Math.max(0, Math.round(ratio * 8)));
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

type TooltipState = {
  x: number;
  y: number;
  cell: HeatmapCell;
} | null;

// ─── Component ───────────────────────────────────────────────────────────────

export function IntelligenceHeatmap({
  cells,
  xValues,
  yValues,
  xAxisLabel,
  yAxisLabel,
}: IntelligenceHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  if (xValues.length === 0 || yValues.length === 0) {
    return (
      <p className="muted" style={{ fontSize: "0.875rem" }}>
        No data available for the selected axes and filters.
      </p>
    );
  }

  // Build lookup map
  const cellMap = new Map<string, HeatmapCell>(
    cells.map((c) => [`${c.xValue}||${c.yValue}`, c]),
  );

  // Find min/max ROAS for color scaling
  const roasValues = cells
    .map((c) => c.avgRoas)
    .filter((v): v is number => v !== null);
  const minRoas = roasValues.length > 0 ? Math.min(...roasValues) : 0;
  const maxRoas = roasValues.length > 0 ? Math.max(...roasValues) : 1;

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    cell: HeatmapCell,
  ) => {
    setTooltip({ x: e.clientX, y: e.clientY, cell });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tooltip) {
      setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  };

  const cellSize = Math.max(60, Math.min(100, Math.floor(600 / xValues.length)));

  return (
    <div style={{ position: "relative" }} onMouseMove={handleMouseMove}>
      {/* Axis labels */}
      <div
        style={{
          marginBottom: "8px",
          fontSize: "0.8rem",
          color: "#7D4D3B",
          fontWeight: 600,
        }}
      >
        X axis: {xAxisLabel} &nbsp;·&nbsp; Y axis: {yAxisLabel}
      </div>

      {/* Heatmap grid */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ borderCollapse: "separate", borderSpacing: "3px" }}
          role="grid"
          aria-label={`Heatmap of ${yAxisLabel} vs ${xAxisLabel}`}
        >
          <thead>
            <tr>
              {/* Corner cell */}
              <th
                style={{
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  textAlign: "right",
                  color: "#7D4D3B",
                  fontWeight: 400,
                  whiteSpace: "nowrap",
                }}
              >
                {yAxisLabel} \ {xAxisLabel}
              </th>
              {xValues.map((xv) => (
                <th
                  key={xv}
                  style={{
                    padding: "4px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    maxWidth: `${cellSize}px`,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={xv}
                >
                  {xv.slice(0, 12)}
                  {xv.length > 12 ? "…" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yValues.map((yv) => (
              <tr key={yv}>
                <td
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    textAlign: "right",
                    color: "var(--color-ink)",
                  }}
                >
                  {yv}
                </td>
                {xValues.map((xv) => {
                  const cell = cellMap.get(`${xv}||${yv}`);
                  const hasData = cell && cell.avgRoas !== null;
                  const bgColor = hasData
                    ? COLOR_BUCKETS[roasToBucketIndex(cell.avgRoas!, minRoas, maxRoas)]
                    : "transparent";

                  return (
                    <td key={xv} style={{ padding: 0 }}>
                      <div
                        role="gridcell"
                        aria-label={
                          hasData
                            ? `${xv} × ${yv}: ROAS ${formatRoas(cell!.avgRoas)}, ${cell!.adCount} ads`
                            : `${xv} × ${yv}: no data`
                        }
                        style={{
                          width: `${cellSize}px`,
                          height: "44px",
                          background: bgColor,
                          border: hasData
                            ? `1px solid ${bgColor}`
                            : "1px dashed #ccc",
                          borderRadius: "4px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: hasData ? "pointer" : "default",
                          position: "relative",
                          transition: "opacity 0.1s",
                        }}
                        onMouseEnter={
                          hasData
                            ? (e) => handleMouseEnter(e, cell!)
                            : undefined
                        }
                        onMouseLeave={hasData ? handleMouseLeave : undefined}
                      >
                        {hasData ? (
                          <>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                              }}
                            >
                              {formatRoas(cell!.avgRoas)}
                            </span>
                            <span
                              style={{
                                position: "absolute",
                                bottom: "3px",
                                right: "5px",
                                fontSize: "0.65rem",
                                color: "rgba(255,255,255,0.8)",
                              }}
                            >
                              {cell!.adCount}
                            </span>
                          </>
                        ) : (
                          <span
                            style={{ fontSize: "0.75rem", color: "#ccc" }}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Color legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginTop: "10px",
          fontSize: "0.72rem",
          color: "#7D4D3B",
        }}
      >
        <span>Low ROAS</span>
        {COLOR_BUCKETS.map((c, i) => (
          <div
            key={i}
            style={{
              width: "18px",
              height: "12px",
              background: c,
              borderRadius: "2px",
            }}
          />
        ))}
        <span>High ROAS</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: "#241813",
            color: "#FFF8F2",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            maxWidth: "220px",
          }}
        >
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>
            {tooltip.cell.xValue} × {tooltip.cell.yValue}
          </p>
          <p style={{ margin: "0 0 2px" }}>
            ROAS: {formatRoas(tooltip.cell.avgRoas)}
          </p>
          <p style={{ margin: 0, opacity: 0.75 }}>
            {tooltip.cell.adCount} ad{tooltip.cell.adCount !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
