"use client";

import { useState } from "react";
import type { PromptEvalScoreDimensions, PromptEvalVariant } from "@littlecolorbook/db";

export type VariantCell = {
  variant: PromptEvalVariant;
  label: string;
  sample: {
    id: string;
    model: string;
    overallScore: number | null;
    scoreDimensions: PromptEvalScoreDimensions | null;
    notes: string | null;
    scoredAt: string | null;
  } | null;
  imageUrl: string | null;
};

export type EvalRowData = {
  sourceUploadId: string;
  sourceObjectPath: string;
  orderIdHint: string | null;
  sourceUrl: string | null;
  cells: VariantCell[];
};

export function EvalRow({ data }: { data: EvalRowData }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px repeat(3, 1fr)",
        gap: "16px",
        padding: "16px",
        border: "1px solid var(--line)",
        borderRadius: "8px",
        background: "#fff",
      }}
    >
      <SourceCell data={data} />
      {data.cells.map((cell) => (
        <VariantCellComponent key={cell.variant} cell={cell} />
      ))}
    </div>
  );
}

function SourceCell({ data }: { data: EvalRowData }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", color: "#8f7a68" }}>
        Source
      </div>
      {data.sourceUrl ? (
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          <img
            src={data.sourceUrl}
            alt="source"
            style={{ width: "100%", borderRadius: "4px", border: "1px solid var(--line)" }}
          />
        </a>
      ) : (
        <div style={{ padding: "24px", background: "#f7f4ed", borderRadius: "4px", fontSize: "0.8rem", color: "#8f7a68", textAlign: "center" }}>
          (no signed URL)
        </div>
      )}
      <div style={{ fontSize: "0.7rem", color: "#8f7a68", marginTop: "6px", wordBreak: "break-all" }}>
        {data.orderIdHint ? `order: ${data.orderIdHint}` : "no order id"}
      </div>
      <div style={{ fontSize: "0.65rem", color: "#b7a991", marginTop: "2px", wordBreak: "break-all" }}>
        {data.sourceObjectPath}
      </div>
    </div>
  );
}

function VariantCellComponent({ cell }: { cell: VariantCell }) {
  if (!cell.sample) {
    return (
      <div style={{ padding: "16px", background: "#faf7f0", borderRadius: "6px", opacity: 0.5 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", color: "#8f7a68" }}>
          {cell.label}
        </div>
        <div style={{ fontSize: "0.85rem", color: "#8f7a68" }}>No sample for this variant.</div>
      </div>
    );
  }

  return (
    <ScoringCell cell={cell} />
  );
}

function ScoringCell({ cell }: { cell: VariantCell }) {
  const sample = cell.sample!;
  const dims = sample.scoreDimensions ?? {};

  const [overall, setOverall] = useState<number | null>(sample.overallScore);
  const [faceQuality, setFaceQuality] = useState<number | undefined>(dims.faceQuality);
  const [lineQuality, setLineQuality] = useState<number | undefined>(dims.lineQuality);
  const [sceneFaithfulness, setSceneFaithfulness] = useState<number | undefined>(dims.sceneFaithfulness);
  const [artifactFree, setArtifactFree] = useState<number | undefined>(dims.artifactFree);
  const [notes, setNotes] = useState<string>(sample.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(sample.scoredAt);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/prompt-eval/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: sample.id,
          overallScore: overall,
          scoreDimensions: {
            faceQuality,
            lineQuality,
            sceneFaithfulness,
            artifactFree,
          },
          notes: notes.trim() || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const body = await response.json();
      setSavedAt(body?.sample?.scoredAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "12px", background: "#faf7f0", borderRadius: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#8f7a68" }}>
          {cell.label}
        </div>
        <div style={{ fontSize: "0.7rem", color: "#b7a991" }}>{sample.model}</div>
      </div>

      {cell.imageUrl ? (
        <a href={cell.imageUrl} target="_blank" rel="noreferrer">
          <img
            src={cell.imageUrl}
            alt={cell.label}
            style={{ width: "100%", borderRadius: "4px", border: "1px solid var(--line)", background: "#fff" }}
          />
        </a>
      ) : (
        <div style={{ padding: "24px", background: "#fff", borderRadius: "4px", fontSize: "0.8rem", color: "#8f7a68", textAlign: "center" }}>
          (no signed URL)
        </div>
      )}

      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <ScoreField label="Overall" value={overall} onChange={setOverall} required />
        <ScoreField label="Face quality" value={faceQuality ?? null} onChange={(n) => setFaceQuality(n ?? undefined)} />
        <ScoreField label="Line quality" value={lineQuality ?? null} onChange={(n) => setLineQuality(n ?? undefined)} />
        <ScoreField label="Scene faithfulness" value={sceneFaithfulness ?? null} onChange={(n) => setSceneFaithfulness(n ?? undefined)} />
        <ScoreField label="Artifact free" value={artifactFree ?? null} onChange={(n) => setArtifactFree(n ?? undefined)} />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes…"
          rows={2}
          style={{ width: "100%", fontSize: "0.8rem", padding: "6px", border: "1px solid var(--line)", borderRadius: "4px", resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={save}
            disabled={saving || overall === null}
            style={{ padding: "4px 12px", fontSize: "0.8rem" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <div style={{ fontSize: "0.7rem", color: error ? "#c85a4a" : "#8f7a68" }}>
            {error ? `✗ ${error}` : savedAt ? `✓ saved ${new Date(savedAt).toLocaleTimeString()}` : "unscored"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem" }}>
      <span style={{ minWidth: "120px" }}>{label}{required && " *"}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={{ padding: "2px 6px", fontSize: "0.8rem", flex: 1 }}
      >
        <option value="">—</option>
        <option value="1">1 (bad)</option>
        <option value="2">2</option>
        <option value="3">3 (ok)</option>
        <option value="4">4</option>
        <option value="5">5 (great)</option>
      </select>
    </label>
  );
}
