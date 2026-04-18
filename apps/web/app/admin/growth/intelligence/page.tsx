import Link from "next/link";
import {
  getElementPerformance,
  listTopPerformingTagCombos,
  listCopyElements,
  listAgentJournal,
} from "@littlecolorbook/db";
import type { CopyElement, ElementPerformanceRow } from "@littlecolorbook/db";
import {
  formatMoney,
  formatRoas,
  formatPct,
  formatDateTime,
  dateNDaysAgo,
  today,
} from "../../../../lib/growth-format";

export const dynamic = "force-dynamic";

// ─── Shared style helpers ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--color-paper)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  padding: "16px 20px",
  display: "grid",
  gap: "12px",
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{children}</h2>
  );
}

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

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="muted"
        style={{ padding: "12px 0", fontSize: "0.875rem", textAlign: "center" }}
      >
        {message}
      </td>
    </tr>
  );
}

// ─── Top Hooks card ───────────────────────────────────────────────────────────

type ElementWithPerf = {
  element: CopyElement;
  perf: ElementPerformanceRow;
};

function TopHooksCard({ items }: { items: ElementWithPerf[] }) {
  return (
    <section style={cardStyle} aria-label="Top 5 hooks last 30 days">
      <SectionTitle>Top 5 Hooks — last 30 days</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Hook text</th>
              <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
              <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyRow colSpan={5} message="No hook performance data yet." />
            ) : (
              items.map(({ element, perf }) => (
                <tr key={element.id}>
                  <td style={tdStyle}>
                    <Link
                      href={`/admin/growth/intelligence/elements?kind=hook&id=${element.id}`}
                      style={{ color: "var(--color-ink)", textDecoration: "none" }}
                      title={element.text}
                    >
                      {element.text.slice(0, 60)}
                      {element.text.length > 60 ? "…" : ""}
                    </Link>
                  </td>
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
                  <td style={{ ...tdStyle, textAlign: "right" }}>{perf.adCount}</td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontFamily: "monospace",
                      fontSize: "0.78rem",
                    }}
                  >
                    {formatPct(perf.confidenceLowerBound)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Link href="/admin/growth/intelligence/elements?kind=hook" style={{ fontSize: "0.875rem" }}>
        View all hooks →
      </Link>
    </section>
  );
}

// ─── Top Tag Combos card ──────────────────────────────────────────────────────

type TagCombo = {
  tagFingerprint: string;
  avgRoas: number | null;
  avgCpaCents: number | null;
  adCount: number;
};

function prettifyTagFingerprint(fp: string): string {
  try {
    const obj = JSON.parse(fp) as Record<string, unknown>;
    return Object.values(obj)
      .filter((v) => v != null && v !== "")
      .join(" · ");
  } catch {
    return fp;
  }
}

function TopTagCombosCard({ combos }: { combos: TagCombo[] }) {
  return (
    <section style={cardStyle} aria-label="Top 5 tag combos">
      <SectionTitle>Top 5 Tag Combos — last 30 days</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Tags</th>
              <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
              <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
            </tr>
          </thead>
          <tbody>
            {combos.length === 0 ? (
              <EmptyRow colSpan={4} message="No tag combo data yet. Run semantic tagger to populate." />
            ) : (
              combos.map((combo, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.78rem" }}>
                    {prettifyTagFingerprint(combo.tagFingerprint)}
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
                    {combo.avgCpaCents != null ? formatMoney(combo.avgCpaCents) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{combo.adCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Link href="/admin/growth/intelligence/tags" style={{ fontSize: "0.875rem" }}>
        Open tag heatmap →
      </Link>
    </section>
  );
}

// ─── Top Images card ──────────────────────────────────────────────────────────

function TopImagesCard({ combos }: { combos: TagCombo[] }) {
  // Top images: tag combos with highest spend-weighted ROAS that include a
  // single asset. Without a signed-URL helper available on this route we show
  // asset fingerprint + metrics. A signed-URL helper can be wired in a
  // follow-up PR once the /api/admin/assets/sign route is confirmed.
  const imageItems = combos.slice(0, 5);

  return (
    <section style={cardStyle} aria-label="Top 5 images last 30 days">
      <SectionTitle>Top 5 Image Tag Patterns — last 30 days</SectionTitle>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        Derived from top tag combos. Thumbnail previews require a signed-URL
        helper — coming in next PR.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Tag pattern</th>
              <th style={{ ...thStyle, textAlign: "right" }}>ROAS</th>
              <th style={{ ...thStyle, textAlign: "right" }}>CPA</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
            </tr>
          </thead>
          <tbody>
            {imageItems.length === 0 ? (
              <EmptyRow
                colSpan={4}
                message="No image tag data yet. Tag creative assets to see results here."
              />
            ) : (
              imageItems.map((combo, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.78rem" }}>
                    {prettifyTagFingerprint(combo.tagFingerprint)}
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
                    {combo.avgCpaCents != null ? formatMoney(combo.avgCpaCents) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{combo.adCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Retirement candidates card ───────────────────────────────────────────────

type RetirementCandidate = {
  element: CopyElement;
  perf: ElementPerformanceRow;
};

function RetirementCandidatesCard({ candidates }: { candidates: RetirementCandidate[] }) {
  return (
    <section style={cardStyle} aria-label="Retirement candidates">
      <SectionTitle>Retirement Candidates</SectionTitle>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        Elements with ≥$50 spend and confidence lower bound &lt; 0.5%.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Text</th>
              <th style={thStyle}>Kind</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Spend</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Upper bound</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <EmptyRow colSpan={5} message="No retirement candidates — all elements are performing or have insufficient data." />
            ) : (
              candidates.map(({ element, perf }) => (
                <tr key={element.id}>
                  <td style={{ ...tdStyle, maxWidth: "200px" }}>
                    <span
                      title={element.text}
                      style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {element.text.slice(0, 60)}
                      {element.text.length > 60 ? "…" : ""}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <KindBadge kind={element.kind} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {formatMoney(perf.totalSpendCents)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      color: "#c85a4a",
                      fontFamily: "monospace",
                      fontSize: "0.78rem",
                    }}
                  >
                    {formatPct(perf.confidenceLowerBound)}
                  </td>
                  <td style={tdStyle}>
                    <span
                      title="Retire endpoint coming in next PR — POST /api/admin/creative/copy-elements/{id}/retire"
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
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
              ))
            )}
          </tbody>
        </table>
      </div>
      <Link href="/admin/growth/intelligence/elements" style={{ fontSize: "0.875rem" }}>
        View all elements →
      </Link>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IntelligenceOverviewPage() {
  const dateFrom = dateNDaysAgo(30);
  const dateTo = today();

  // Fetch all data in parallel
  const [hookElements, tagCombos, journalEntries] = await Promise.all([
    listCopyElements({ kind: "hook", limit: 200 }),
    listTopPerformingTagCombos({ dateFrom, dateTo, metric: "roas", limit: 20 }),
    listAgentJournal({ limit: 10 }),
  ]);

  // Get performance for all hooks (fires sequentially per element inside the fn)
  const hookPerf = await getElementPerformance({
    kind: "hook",
    dateFrom,
    dateTo,
  });

  // Build hook performance map
  const perfMap = new Map<string, ElementPerformanceRow>(
    hookPerf.map((p) => [p.elementId, p]),
  );

  // Top hooks: min $5 spend ($500 cents), sorted by confidenceLowerBound DESC
  const topHooks: ElementWithPerf[] = hookElements
    .map((el) => ({ element: el, perf: perfMap.get(el.id) }))
    .filter((x): x is ElementWithPerf => x.perf !== undefined && x.perf.totalSpendCents >= 500)
    .sort((a, b) => b.perf.confidenceLowerBound - a.perf.confidenceLowerBound)
    .slice(0, 5);

  // Retirement candidates across ALL kinds: get copy elements for all kinds
  const allElements = await listCopyElements({ limit: 500 });
  const allElementIds = allElements.map((e) => e.id);

  // Fetch perf for all elements in batches by kind to avoid "provide elementIds or kind" constraint
  const [bodyPerf, ctaPerf, vsPerf] = await Promise.all([
    getElementPerformance({ kind: "body", dateFrom, dateTo }),
    getElementPerformance({ kind: "cta", dateFrom, dateTo }),
    getElementPerformance({ kind: "visual_style", dateFrom, dateTo }),
  ]);

  const allPerfRows = [...hookPerf, ...bodyPerf, ...ctaPerf, ...vsPerf];
  const allPerfMap = new Map<string, ElementPerformanceRow>(
    allPerfRows.map((p) => [p.elementId, p]),
  );

  // Retirement: ≥$50 spend (5000 cents) AND confidence_lower_bound < 0.005
  const retirementCandidates: RetirementCandidate[] = allElements
    .map((el) => ({ element: el, perf: allPerfMap.get(el.id) }))
    .filter(
      (x): x is RetirementCandidate =>
        x.perf !== undefined &&
        x.perf.totalSpendCents >= 5000 &&
        x.perf.confidenceLowerBound < 0.005,
    )
    .slice(0, 10);

  // Top 5 tag combos
  const topCombos: TagCombo[] = tagCombos.slice(0, 5).map((c) => ({
    tagFingerprint: c.tagFingerprint,
    avgRoas: c.avgRoas,
    avgCpaCents: c.avgCpaCents,
    adCount: c.adCount,
  }));

  // Top images: use all 20 tag combos as source for image patterns
  const imageCombos: TagCombo[] = tagCombos.map((c) => ({
    tagFingerprint: c.tagFingerprint,
    avgRoas: c.avgRoas,
    avgCpaCents: c.avgCpaCents,
    adCount: c.adCount,
  }));

  return (
    <div
      style={{
        padding: "24px",
        display: "grid",
        gap: "20px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: 0 }}>Creative Intelligence</h1>

      {/* 4-card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <TopHooksCard items={topHooks} />
        <TopImagesCard combos={imageCombos} />
        <TopTagCombosCard combos={topCombos} />
        <RetirementCandidatesCard candidates={retirementCandidates} />
      </div>

      {/* Recent journal */}
      <section style={cardStyle} aria-label="Recent agent journal">
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
          Recent agent activity (last 10)
        </h2>
        {journalEntries.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            No journal entries yet.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: "6px",
            }}
          >
            {journalEntries.map((entry) => (
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
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    background: "#F4E7DA",
                    color: "#7D4D3B",
                    flexShrink: 0,
                  }}
                >
                  {entry.kind}
                </span>
                <span
                  style={{ color: "#7D4D3B", minWidth: "110px", flexShrink: 0 }}
                >
                  {formatDateTime(entry.createdAt)}
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.note}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/growth/journal" style={{ fontSize: "0.875rem" }}>
          Browse full journal →
        </Link>
      </section>
    </div>
  );
}
