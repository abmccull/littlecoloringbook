import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { marketingExperimentsRankRequestSchema } from "@littlecolorbook/shared";
import { loadMetricsRowsForDate, rankMarketingMetricsRows } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { writeMarketingJson } from "../../../../../../lib/marketing-files";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingExperimentsRankRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid experiment ranking request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const rows = parsed.data.rows ?? (await loadMetricsRowsForDate(parsed.data.reportDate));
  const decisions = rankMarketingMetricsRows(rows);
  const filePath = await writeMarketingJson(path.join("experiments", `decisions-${parsed.data.reportDate}.json`), {
    reportDate: parsed.data.reportDate,
    mode: parsed.data.mode,
    rowCount: rows.length,
    decisionCount: decisions.length,
    decisions,
  });

  return NextResponse.json({
    accepted: true,
    reportDate: parsed.data.reportDate,
    mode: parsed.data.mode,
    rowCount: rows.length,
    decisionCount: decisions.length,
    filePath,
    decisions,
  });
}
