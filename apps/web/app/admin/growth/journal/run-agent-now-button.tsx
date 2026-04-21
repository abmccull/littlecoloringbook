"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result =
  | { status: "idle" }
  | { status: "running" }
  | {
      status: "done";
      ok: boolean;
      proposals: number;
      rejected: number;
      durationMs: number;
      cacheHit: boolean;
      preamble?: string;
      error?: string;
    };

export function RunAgentNowButton() {
  const router = useRouter();
  const [result, setResult] = useState<Result>({ status: "idle" });

  async function handleClick() {
    setResult({ status: "running" });
    try {
      const response = await fetch("/api/admin/growth/run-agent-review", {
        method: "POST",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResult({
          status: "done",
          ok: false,
          proposals: 0,
          rejected: 0,
          durationMs: body?.durationMs ?? 0,
          cacheHit: false,
          error: body?.error ?? `HTTP ${response.status}`,
        });
        return;
      }
      setResult({
        status: "done",
        ok: true,
        proposals: body?.proposals ?? 0,
        rejected: Array.isArray(body?.rejected) ? body.rejected.length : 0,
        durationMs: body?.durationMs ?? 0,
        cacheHit: Boolean(body?.usage?.cacheHit),
        preamble: typeof body?.preamble === "string" ? body.preamble : undefined,
      });
      // Refresh the page's journal list so the new entries show up.
      router.refresh();
    } catch (error) {
      setResult({
        status: "done",
        ok: false,
        proposals: 0,
        rejected: 0,
        durationMs: 0,
        cacheHit: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const disabled = result.status === "running";
  const buttonLabel = disabled ? "Running…" : "Run agent now";

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        style={{
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          background: disabled ? "#E8DDCC" : "#241813",
          color: disabled ? "#7D4D3B" : "#FFF8F2",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: disabled ? "wait" : "pointer",
          width: "fit-content",
        }}
      >
        {buttonLabel}
      </button>

      {result.status === "done" && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: result.ok ? "#DDF4EA" : "#c85a4a20",
            fontSize: "0.82rem",
            color: result.ok ? "#1E5E45" : "#c85a4a",
          }}
        >
          {result.ok ? (
            <>
              ✓ Agent run completed in {Math.round(result.durationMs / 100) / 10}s · {result.proposals} proposal{result.proposals !== 1 ? "s" : ""}
              {result.rejected > 0 ? `, ${result.rejected} rejected` : ""} · cache {result.cacheHit ? "HIT" : "miss"}
              {result.preamble ? (
                <div style={{ marginTop: 6, fontSize: "0.75rem", whiteSpace: "pre-wrap", opacity: 0.8 }}>
                  {result.preamble.slice(0, 400)}
                  {result.preamble.length > 400 ? "…" : ""}
                </div>
              ) : null}
            </>
          ) : (
            <>✗ {result.error ?? "Run failed"}</>
          )}
        </div>
      )}
    </div>
  );
}
