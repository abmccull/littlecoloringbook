// Admin A/B-eval grid for prompt + model combos. One row per source
// photo, up to 3 variant cells per row. Scoring is captured per cell
// and posted to /api/admin/prompt-eval/score.

import {
  listPromptEvalRunIds,
  listPromptEvalSamples,
  summarizePromptEvalRun,
  type PromptEvalSample,
  type PromptEvalVariant,
} from "@littlecolorbook/db";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";
import { requireAdminSession } from "../../../lib/auth";
import { EvalRow, type EvalRowData, type VariantCell } from "./eval-row";

export const dynamic = "force-dynamic";

const VARIANT_ORDER: PromptEvalVariant[] = [
  "old_historical",
  "new_flash_minimal",
  "new_pro_minimal",
];

const VARIANT_LABELS: Record<PromptEvalVariant, string> = {
  old_historical: "Old prompt (historical)",
  new_flash_minimal: "New prompt — 2.5 Flash",
  new_pro_minimal: "New prompt — 3 Pro",
};

async function signedUrl(objectPath: string): Promise<string | null> {
  try {
    const { url } = await createSignedDownloadUrl({
      bucket: "uploads",
      objectPath,
      expiresInMinutes: 60,
    });
    return url;
  } catch {
    return null;
  }
}

type SearchParams = Promise<{ run?: string }>;

export default async function PromptEvalPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminSession();

  const params = await searchParams;
  const runIds = await listPromptEvalRunIds(20);
  const activeRunId = params.run && runIds.includes(params.run) ? params.run : runIds[0] ?? null;

  if (!activeRunId) {
    return (
      <main className="admin-main" style={{ padding: "24px" }}>
        <h1>Prompt eval</h1>
        <p className="muted">
          No eval runs found. Run{" "}
          <code>npx tsx --env-file=.env scripts/generate-prompt-eval.mjs</code> to populate one.
        </p>
      </main>
    );
  }

  const [samples, summary] = await Promise.all([
    listPromptEvalSamples(activeRunId),
    summarizePromptEvalRun(activeRunId),
  ]);

  // Group samples by sourceUploadId
  const groups = new Map<string, PromptEvalSample[]>();
  for (const sample of samples) {
    const list = groups.get(sample.sourceUploadId) ?? [];
    list.push(sample);
    groups.set(sample.sourceUploadId, list);
  }

  // Build signed URLs for every image in parallel
  const rows: EvalRowData[] = await Promise.all(
    Array.from(groups.entries()).map(async ([sourceUploadId, group]) => {
      const first = group[0];
      const sourceUrl = await signedUrl(first.sourceObjectPath);

      const cells: VariantCell[] = [];
      for (const variant of VARIANT_ORDER) {
        const match = group.find((g) => g.variant === variant);
        if (!match) {
          cells.push({
            variant,
            label: VARIANT_LABELS[variant],
            sample: null,
            imageUrl: null,
          });
          continue;
        }
        const url = await signedUrl(match.outputObjectPath);
        cells.push({
          variant,
          label: VARIANT_LABELS[variant],
          sample: {
            id: match.id,
            model: match.model,
            overallScore: match.overallScore,
            scoreDimensions: match.scoreDimensions,
            notes: match.notes,
            scoredAt: match.scoredAt ? match.scoredAt.toISOString() : null,
          },
          imageUrl: url,
        });
      }

      return {
        sourceUploadId,
        sourceObjectPath: first.sourceObjectPath,
        orderIdHint: first.orderIdHint,
        sourceUrl,
        cells,
      };
    }),
  );

  const totalScored = summary.reduce((acc, v) => acc + v.scored, 0);
  const totalSamples = summary.reduce((acc, v) => acc + v.total, 0);

  return (
    <main className="admin-main" style={{ padding: "24px" }}>
      <h1 style={{ marginBottom: "8px" }}>Prompt eval</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Side-by-side scoring for prompt × model combos. Score each cell 1–5 overall + optional
        sub-dimensions.
      </p>

      <form method="GET" style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        <label htmlFor="run-select" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Run:</label>
        <select id="run-select" name="run" defaultValue={activeRunId} style={{ padding: "4px 8px" }}>
          {runIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: "4px 12px" }}>Switch</button>

        <div style={{ fontSize: "0.85rem", marginLeft: "auto" }}>
          <strong>{rows.length}</strong> sources • <strong>{totalScored}</strong>/{totalSamples} cells scored
        </div>
      </form>

      <div style={{
        display: "flex",
        gap: "16px",
        marginBottom: "24px",
        padding: "12px 16px",
        background: "#f7f4ed",
        borderRadius: "6px",
        fontSize: "0.9rem",
        flexWrap: "wrap",
      }}>
        {summary.map((v) => (
          <span key={v.variant}>
            <strong>{VARIANT_LABELS[v.variant] ?? v.variant}</strong>{" "}
            avg <strong>{v.avgOverall === null ? "—" : v.avgOverall.toFixed(2)}</strong>{" "}
            <span className="muted">({v.scored}/{v.total} scored)</span>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {rows.map((row) => (
          <EvalRow key={row.sourceUploadId} data={row} />
        ))}
      </div>

      {rows.length === 0 && (
        <p className="muted">No samples in this run.</p>
      )}
    </main>
  );
}
