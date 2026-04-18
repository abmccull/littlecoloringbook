import { NextResponse } from "next/server";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { csvResponse, rowsToCsv } from "../../../../../../lib/csv";
import {
  buildCohortReport,
  COHORT_MAX_MONTHS_SINCE,
  formatCohortLabel,
} from "../../../../../../lib/cohorts";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await buildCohortReport();

  // Long-form one-row-per-(cohort, months_since) CSV. Easier to pivot
  // in a spreadsheet than a wide table.
  type Row = {
    cohort_month: string;
    cohort_label: string;
    customer_count: number;
    months_since: number;
    monthly_revenue_usd: string;
    cumulative_revenue_usd: string;
    per_customer_ltv_usd: string;
  };

  const rows: Row[] = [];
  for (const cohort of report.rows) {
    for (let i = 0; i <= COHORT_MAX_MONTHS_SINCE; i += 1) {
      if (i > cohort.latestActiveMonths) break;
      rows.push({
        cohort_month: cohort.cohortMonth,
        cohort_label: formatCohortLabel(cohort.cohortMonth),
        customer_count: cohort.customerCount,
        months_since: i,
        monthly_revenue_usd: (cohort.monthlyRevenueCents[i] / 100).toFixed(2),
        cumulative_revenue_usd: (cohort.cumulativeRevenueCents[i] / 100).toFixed(2),
        per_customer_ltv_usd: (cohort.monthlyLtvCents[i] / 100).toFixed(2),
      });
    }
  }

  const csv = rowsToCsv(rows, [
    "cohort_month",
    "cohort_label",
    "customer_count",
    "months_since",
    "monthly_revenue_usd",
    "cumulative_revenue_usd",
    "per_customer_ltv_usd",
  ]);

  return csvResponse(csv, `cohorts-12mo-${new Date().toISOString().slice(0, 10)}.csv`);
}
