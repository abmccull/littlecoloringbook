import { NextRequest, NextResponse } from "next/server";
import {
  createMarketingRequestId,
  marketingMetricsDailyIngestRequestSchema,
  metricsDailyRowSchema,
  type MetricsDailyRow,
} from "@littlecolorbook/shared";
import { loadMetricsRowsForDate, mergeMetricsRows, writeMetricsRowsForDate } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingMetricsDailyIngestRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid daily metrics ingest request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const ingestId = createMarketingRequestId("metrics");
  const acceptedRows: MetricsDailyRow[] = [];
  const errors: Array<{ index: number; issues: unknown }> = [];

  parsed.data.rows.forEach((row, index) => {
    const rowResult = metricsDailyRowSchema.safeParse(row);

    if (!rowResult.success) {
      errors.push({
        index,
        issues: rowResult.error.flatten(),
      });
      return;
    }

    if (rowResult.data.reportDate !== parsed.data.reportDate) {
      errors.push({
        index,
        issues: {
          formErrors: [`Row reportDate '${rowResult.data.reportDate}' does not match request reportDate '${parsed.data.reportDate}'.`],
          fieldErrors: {},
        },
      });
      return;
    }

    acceptedRows.push(rowResult.data);
  });

  const existingRows = await loadMetricsRowsForDate(parsed.data.reportDate);
  const mergedRows = mergeMetricsRows(existingRows, acceptedRows);
  const filePath = await writeMetricsRowsForDate(parsed.data.reportDate, mergedRows);

  return NextResponse.json(
    {
      accepted: true,
      ingestId,
      reportDate: parsed.data.reportDate,
      rowsReceived: parsed.data.rows.length,
      rowsAccepted: acceptedRows.length,
      rowsRejected: errors.length,
      storedRows: mergedRows.length,
      filePath,
      errors,
    },
    { status: 202 },
  );
}
