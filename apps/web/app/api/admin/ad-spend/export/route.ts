import { NextResponse } from "next/server";
import { listAdSpendEntries } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../lib/auth";
import { csvResponse, rowsToCsv } from "../../../../../lib/csv";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await listAdSpendEntries({ limit: 5000 });
  const csv = rowsToCsv(
    entries.map((e) => ({
      spend_date: e.spendDate,
      platform: e.platform,
      campaign: e.campaign ?? "",
      amount_usd: (e.amountCents / 100).toFixed(2),
      notes: e.notes ?? "",
      recorded_by: e.recordedByEmail ?? "",
      created_at: e.createdAt,
    })),
    ["spend_date", "platform", "campaign", "amount_usd", "notes", "recorded_by", "created_at"],
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `ad-spend-${stamp}.csv`);
}
