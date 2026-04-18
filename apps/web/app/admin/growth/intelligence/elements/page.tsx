import {
  listCopyElements,
  getElementPerformance,
} from "@littlecolorbook/db";
import type { CopyElement, ElementPerformanceRow, CopyElementKind } from "@littlecolorbook/db";
import { IntelligenceElementRow } from "../../../../../components/admin/intelligence-element-row";
import {
  dateNDaysAgo,
  today,
} from "../../../../../lib/growth-format";

export const dynamic = "force-dynamic";

// ─── Valid kind values (used for safe parsing from query params) ──────────────

const VALID_KINDS: CopyElementKind[] = ["hook", "body", "cta", "visual_style"];
const VALID_SORTS = ["clb", "spend", "roas", "usage"] as const;
type SortKey = (typeof VALID_SORTS)[number];

function isValidKind(v: unknown): v is CopyElementKind {
  return typeof v === "string" && (VALID_KINDS as string[]).includes(v);
}

function isValidSort(v: unknown): v is SortKey {
  return typeof v === "string" && (VALID_SORTS as readonly string[]).includes(v);
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "8px 8px 8px 0",
  textAlign: "left",
  fontSize: "0.78rem",
  fontWeight: 600,
  borderBottom: "2px solid var(--line)",
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "6px",
  border: "1px solid var(--line)",
  fontSize: "0.875rem",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IntelligenceElementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    sort?: string;
    minSpendCents?: string;
    range?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const params = await searchParams;

  const kind: CopyElementKind = isValidKind(params.kind) ? params.kind : "hook";
  const sort: SortKey = isValidSort(params.sort) ? params.sort : "clb";
  const minSpendCents = Math.max(0, parseInt(params.minSpendCents ?? "0", 10));
  const rangeDays = parseInt(params.range ?? "30", 10);
  const pageSize = Math.min(100, Math.max(10, parseInt(params.limit ?? "50", 10)));
  const offset = Math.max(0, parseInt(params.offset ?? "0", 10));

  const dateFrom = dateNDaysAgo(rangeDays);
  const dateTo = today();

  // Fetch elements + performance in parallel — getElementPerformance fetches
  // elements internally, but we also need the CopyElement rows for text/tags.
  const [elements, perfRows] = await Promise.all([
    listCopyElements({ kind, limit: 500 }),
    getElementPerformance({ kind, dateFrom, dateTo }),
  ]);

  // Build perf map
  const perfMap = new Map<string, ElementPerformanceRow>(
    perfRows.map((p) => [p.elementId, p]),
  );

  // Pair elements with their perf (elements with no perf get a zero row)
  type PairedRow = { element: CopyElement; perf: ElementPerformanceRow };

  const zeroPerfFor = (el: CopyElement): ElementPerformanceRow => ({
    elementId: el.id,
    kind: el.kind,
    totalSpendCents: 0,
    totalPurchases: 0,
    totalRevenueCents: 0,
    avgCtr: 0,
    avgRoas: 0,
    avgCpaCents: 0,
    adCount: 0,
    avgHookRate: 0,
    confidenceLowerBound: 0,
  });

  const paired: PairedRow[] = elements.map((el) => ({
    element: el,
    perf: perfMap.get(el.id) ?? zeroPerfFor(el),
  }));

  // Filter by minSpend
  const filtered = minSpendCents > 0
    ? paired.filter((r) => r.perf.totalSpendCents >= minSpendCents)
    : paired;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "clb":
        return b.perf.confidenceLowerBound - a.perf.confidenceLowerBound;
      case "spend":
        return b.perf.totalSpendCents - a.perf.totalSpendCents;
      case "roas":
        return (b.perf.avgRoas ?? 0) - (a.perf.avgRoas ?? 0);
      case "usage":
        return b.element.usageCount - a.element.usageCount;
      default:
        return 0;
    }
  });

  const totalCount = sorted.length;
  const paged = sorted.slice(offset, offset + pageSize);

  const prevOffset = Math.max(0, offset - pageSize);
  const nextOffset = offset + pageSize;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < totalCount;

  function buildQuery(overrides: Record<string, string>) {
    const q = new URLSearchParams({
      kind,
      sort,
      minSpendCents: String(minSpendCents),
      range: String(rangeDays),
      limit: String(pageSize),
      offset: String(offset),
      ...overrides,
    });
    return `/admin/growth/intelligence/elements?${q.toString()}`;
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1400px",
        margin: "0 auto",
        display: "grid",
        gap: "16px",
      }}
    >
      <h1 style={{ margin: 0 }}>Copy Elements</h1>

      {/* Filter bar */}
      <form
        method="GET"
        action="/admin/growth/intelligence/elements"
        style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}
        aria-label="Filter copy elements"
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Kind
          <select name="kind" defaultValue={kind} style={selectStyle}>
            <option value="hook">Hook</option>
            <option value="body">Body</option>
            <option value="cta">CTA</option>
            <option value="visual_style">Visual style</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Sort by
          <select name="sort" defaultValue={sort} style={selectStyle}>
            <option value="clb">Confidence lower bound</option>
            <option value="spend">Spend</option>
            <option value="roas">ROAS</option>
            <option value="usage">Usage count</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem" }}>
          Min spend (cents)
          <input
            name="minSpendCents"
            type="number"
            min="0"
            step="100"
            defaultValue={minSpendCents}
            style={{ ...selectStyle, width: "110px" }}
            aria-label="Minimum spend in cents"
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

        {/* Preserve offset=0 on new filter */}
        <input type="hidden" name="offset" value="0" />

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

      <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
        {totalCount} element{totalCount !== 1 ? "s" : ""} · showing {offset + 1}–
        {Math.min(offset + pageSize, totalCount)} · {dateFrom} to {dateTo}
      </p>

      {/* Table */}
      {paged.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            border: "1px solid var(--line)",
            borderRadius: "12px",
          }}
        >
          <p style={{ fontWeight: 700, margin: 0 }}>No elements yet</p>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
            No elements yet — run{" "}
            <code
              style={{
                fontFamily: "monospace",
                background: "#F4E7DA",
                padding: "2px 4px",
                borderRadius: "4px",
              }}
            >
              node scripts/seed-copy-elements.mjs
            </code>{" "}
            to populate from taxonomy.
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}
              aria-label={`Copy elements table — ${kind} kind`}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Text preview</th>
                  <th style={thStyle}>Kind</th>
                  <th style={thStyle}>Audience</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Spend</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Avg ROAS</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Avg CPA</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Avg CTR</th>
                  <th style={thStyle}>Confidence</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Usage</th>
                  <th style={thStyle}>Last used</th>
                  <th style={thStyle}>Trend</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <IntelligenceElementRow
                    key={row.element.id}
                    element={row.element}
                    perf={row.perf}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              fontSize: "0.875rem",
            }}
          >
            {hasPrev && (
              <a href={buildQuery({ offset: String(prevOffset) })}>← Prev</a>
            )}
            <span className="muted">
              Page {Math.floor(offset / pageSize) + 1} /{" "}
              {Math.ceil(totalCount / pageSize)}
            </span>
            {hasNext && (
              <a href={buildQuery({ offset: String(nextOffset) })}>Next →</a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
