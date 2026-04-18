import { NextRequest, NextResponse } from "next/server";
import { recomputeDailyRollup } from "@littlecolorbook/db";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function toDayIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  // Recompute yesterday + today on every run. Yesterday catches any
  // late-arriving events (e.g. refunds that landed before midnight UTC
  // but after the previous run). Today covers the current day so the
  // dashboard shows fresh numbers from rollup even intraday.
  const now = new Date();
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const days = [toDayIso(yesterday), toDayIso(today)];
  const results: Array<{ day: string; ok: boolean; error?: string }> = [];
  for (const day of days) {
    try {
      await recomputeDailyRollup(day);
      results.push({ day, ok: true });
    } catch (error) {
      results.push({ day, ok: false, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  return NextResponse.json({ accepted: true, results });
}

export async function POST(request: NextRequest) {
  // Admin-initiated backfill for a specific date. Body: { day: "YYYY-MM-DD" }
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as { day?: string } | null;
  const day = body?.day;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Pass body { day: 'YYYY-MM-DD' }" }, { status: 400 });
  }

  try {
    const row = await recomputeDailyRollup(day);
    return NextResponse.json({ accepted: true, day, row });
  } catch (error) {
    return NextResponse.json(
      { accepted: false, day, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
