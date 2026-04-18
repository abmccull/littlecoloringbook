"use client";

import { useState } from "react";
import type { CopyElement, ElementPerformanceRow } from "@littlecolorbook/db";
import { formatMoney, formatRoas, formatPct, formatDate } from "../../lib/growth-format";

export type IntelligenceElementRowProps = {
  element: CopyElement;
  perf: ElementPerformanceRow;
};

const tdStyle: React.CSSProperties = {
  padding: "8px 8px 8px 0",
  fontSize: "0.82rem",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
};

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    hook:         { bg: "#DDF5FF", color: "#175B77" },
    body:         { bg: "#DDF4EA", color: "#1E5E45" },
    cta:          { bg: "#FFD65A40", color: "#7D4D3B" },
    visual_style: { bg: "#F4E7DA", color: "#7D4D3B" },
  };
  const c = colors[kind] ?? { bg: "#F4E7DA", color: "#7D4D3B" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {kind}
    </span>
  );
}

/** Mini horizontal bar 0–10% range for confidence lower bound */
function ConfidenceBar({ value }: { value: number }) {
  // Clamp to 0–0.1 range for display
  const pct = Math.min(1, value / 0.1);
  const color = pct < 0.2 ? "#c85a4a" : pct < 0.5 ? "#e09a40" : "#1E5E45";
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "6px" }}
      aria-label={`Confidence lower bound: ${formatPct(value)}`}
    >
      <div
        style={{
          width: "48px",
          height: "6px",
          background: "var(--line)",
          borderRadius: "3px",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            borderRadius: "3px",
          }}
        />
      </div>
      <span style={{ fontSize: "0.72rem", fontFamily: "monospace" }}>
        {formatPct(value)}
      </span>
    </div>
  );
}

export function IntelligenceElementRow({ element, perf }: IntelligenceElementRowProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => setExpanded((v) => !v);

  // Trend indicator: if avgRoas > 1 we show an up arrow, else down
  const trendSymbol = perf.avgRoas >= 1 ? "↑" : perf.avgRoas > 0 ? "↓" : "–";
  const trendColor = perf.avgRoas >= 1 ? "#1E5E45" : perf.avgRoas > 0 ? "#c85a4a" : "#7D4D3B";

  return (
    <>
      <tr
        onClick={toggleExpand}
        style={{ cursor: "pointer" }}
        aria-expanded={expanded}
      >
        <td style={{ ...tdStyle, maxWidth: "220px" }}>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.78rem",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={element.text}
          >
            {element.text.slice(0, 120)}
            {element.text.length > 120 ? "…" : ""}
          </span>
          {element.label && (
            <span
              style={{ fontSize: "0.7rem", color: "#7D4D3B", display: "block" }}
            >
              {element.label}
            </span>
          )}
        </td>
        <td style={tdStyle}>
          <KindBadge kind={element.kind} />
        </td>
        <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#7D4D3B" }}>
          {element.audienceTag ?? "—"}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {formatMoney(perf.totalSpendCents)}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>{perf.adCount}</td>
        <td
          style={{
            ...tdStyle,
            textAlign: "right",
            fontWeight: 600,
            color: perf.avgRoas >= 1 ? "#1E5E45" : "inherit",
          }}
        >
          {formatRoas(perf.avgRoas)}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {perf.avgCpaCents > 0 ? formatMoney(perf.avgCpaCents) : "—"}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {formatPct(perf.avgCtr)}
        </td>
        <td style={tdStyle}>
          <ConfidenceBar value={perf.confidenceLowerBound} />
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {element.usageCount}
        </td>
        <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#7D4D3B" }}>
          {element.lastUsedAt ? formatDate(element.lastUsedAt) : "—"}
        </td>
        <td style={tdStyle}>
          <span
            style={{
              color: trendColor,
              fontWeight: 700,
              fontSize: "1rem",
            }}
            aria-label={`ROAS trend: ${trendSymbol}`}
          >
            {trendSymbol}
          </span>
        </td>
        <td style={tdStyle}>
          <span
            title="Retire endpoint coming in next PR — POST /api/admin/creative/copy-elements/{id}/retire"
            style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "#F4E7DA",
              color: "#7D4D3B",
              border: "1px solid #e8d5c4",
              cursor: "not-allowed",
              opacity: 0.65,
            }}
          >
            Retire
          </span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td
            colSpan={13}
            style={{
              background: "var(--color-paper)",
              padding: "16px 20px",
              borderBottom: "2px solid var(--line)",
            }}
          >
            <div style={{ display: "grid", gap: "12px", maxWidth: "800px" }}>
              <div>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#7D4D3B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Full text
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {element.text}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#7D4D3B",
                      textTransform: "uppercase",
                    }}
                  >
                    Brand voice score
                  </p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                    {element.brandVoiceScore != null
                      ? Number(element.brandVoiceScore).toFixed(2)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#7D4D3B",
                      textTransform: "uppercase",
                    }}
                  >
                    Usage count
                  </p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                    {element.usageCount}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#7D4D3B",
                      textTransform: "uppercase",
                    }}
                  >
                    Ad count
                  </p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                    {perf.adCount}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#7D4D3B",
                      textTransform: "uppercase",
                    }}
                  >
                    Hook rate avg
                  </p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                    {formatPct(perf.avgHookRate)}
                  </p>
                </div>
              </div>

              {Object.keys(element.tagsJson ?? {}).length > 0 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#7D4D3B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Tags JSON
                  </p>
                  <pre
                    style={{
                      margin: 0,
                      padding: "10px 12px",
                      background: "#F4E7DA30",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontFamily: "monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(element.tagsJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
