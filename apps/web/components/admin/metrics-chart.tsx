type Point = { day: string; value: number };

/**
 * Minimal inline SVG sparkline — no chart library dependency. Uses a
 * 2-line approach: an area fill under the curve, then the line itself.
 * Renders nicely at ~200x60 for tiles or ~800x200 for section headers.
 */
export function MetricsLineChart({
  points,
  height = 120,
  padding = 16,
  label,
  yFormatter,
  stroke = "#ff6b57",
  fill = "#fff5e4",
}: {
  points: Point[];
  height?: number;
  padding?: number;
  label?: string;
  yFormatter?: (value: number) => string;
  stroke?: string;
  fill?: string;
}) {
  if (points.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          background: fill,
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8f7a68",
          fontSize: "0.85rem",
        }}
      >
        No data in this window.
      </div>
    );
  }

  const width = Math.max(points.length * 14, 200);
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const innerHeight = height - padding * 2;
  const innerWidth = width - padding * 2;

  const toX = (i: number) => padding + (i * innerWidth) / Math.max(1, points.length - 1);
  const toY = (v: number) => padding + innerHeight - ((v - min) / range) * innerHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${(padding + innerHeight).toFixed(1)} L ${toX(0).toFixed(1)} ${(padding + innerHeight).toFixed(1)} Z`;

  const lastPoint = points[points.length - 1];
  const lastValue = lastPoint?.value ?? 0;
  const formattedLast = yFormatter ? yFormatter(lastValue) : String(lastValue);

  return (
    <div style={{ background: "var(--color-paper)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
      {label ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span className="mini-note muted">{label}</span>
          <strong>{formattedLast}</strong>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <path d={areaPath} fill={fill} stroke="none" />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" />
        {points.map((p, i) => (
          <circle cx={toX(i)} cy={toY(p.value)} fill={stroke} key={p.day} r="2" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#8f7a68", marginTop: "4px" }}>
        <span>{points[0]?.day}</span>
        <span>{points[points.length - 1]?.day}</span>
      </div>
    </div>
  );
}
