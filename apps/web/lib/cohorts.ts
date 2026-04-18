import "server-only";

import {
  getCohortRevenueMatrix,
  type CohortCell,
  type CohortSize,
} from "@littlecolorbook/db";

export const COHORT_MAX_MONTHS_SINCE = 11; // 0..11 inclusive = 12 months
export const COHORT_LOOKBACK_MONTHS = 24;

export type CohortRow = {
  cohortMonth: string;
  customerCount: number;
  monthlyRevenueCents: number[];   // index 0..11
  cumulativeRevenueCents: number[]; // running sum
  monthlyLtvCents: number[];       // per-customer running LTV
  latestActiveMonths: number;      // highest months_since we have data for
};

export type CohortReport = {
  rows: CohortRow[];
  blendedLtv12mCents: number;     // weighted mean LTV at month 11 across mature cohorts
  matureCohortCount: number;      // cohorts with at least 12 months of data
};

function parseMonthLabel(ym: string) {
  // Input "YYYY-MM-DD" → "YYYY-MM"
  return ym.slice(0, 7);
}

function isoMonthIndex(iso: string) {
  // Months since an arbitrary epoch. Used only to compare two cohort
  // months in age order without pulling in a date library.
  const [year, month] = iso.slice(0, 7).split("-").map((n) => parseInt(n, 10));
  return year * 12 + (month - 1);
}

export async function buildCohortReport(): Promise<CohortReport> {
  const { cells, sizes } = await getCohortRevenueMatrix(COHORT_MAX_MONTHS_SINCE, COHORT_LOOKBACK_MONTHS);

  const sizesByMonth = new Map<string, number>();
  for (const s of sizes) {
    sizesByMonth.set(s.cohort_month, s.customer_count);
  }

  const cellsByMonth = new Map<string, CohortCell[]>();
  for (const c of cells) {
    const list = cellsByMonth.get(c.cohort_month) ?? [];
    list.push(c);
    cellsByMonth.set(c.cohort_month, list);
  }

  // Earliest-to-latest iteration so we know which cohorts are "mature"
  // (have seen 12 full months since their acquisition month).
  const nowMonthIndex = isoMonthIndex(new Date().toISOString());

  const rows: CohortRow[] = [];
  for (const s of sizes) {
    const cohortCells = cellsByMonth.get(s.cohort_month) ?? [];
    const monthly = new Array<number>(COHORT_MAX_MONTHS_SINCE + 1).fill(0);
    const latestActive = { max: 0 };

    for (const c of cohortCells) {
      if (c.months_since < 0 || c.months_since > COHORT_MAX_MONTHS_SINCE) continue;
      monthly[c.months_since] = c.net_cents;
      if (c.months_since > latestActive.max) latestActive.max = c.months_since;
    }

    const cumulative: number[] = [];
    let running = 0;
    for (const v of monthly) {
      running += v;
      cumulative.push(running);
    }

    const monthlyLtv = cumulative.map((cents) =>
      s.customer_count > 0 ? Math.round(cents / s.customer_count) : 0,
    );

    rows.push({
      cohortMonth: s.cohort_month,
      customerCount: s.customer_count,
      monthlyRevenueCents: monthly,
      cumulativeRevenueCents: cumulative,
      monthlyLtvCents: monthlyLtv,
      latestActiveMonths: latestActive.max,
    });
  }

  // Newest cohort on top.
  rows.sort((a, b) => (a.cohortMonth < b.cohortMonth ? 1 : -1));

  // Mature = cohort acquired 12+ months ago (so month 11 bucket is
  // fully observed).
  const mature = rows.filter((row) => {
    const ageMonths = nowMonthIndex - isoMonthIndex(row.cohortMonth);
    return ageMonths >= COHORT_MAX_MONTHS_SINCE;
  });

  const matureTotalCustomers = mature.reduce((acc, r) => acc + r.customerCount, 0);
  const matureTotalCents = mature.reduce(
    (acc, r) => acc + r.cumulativeRevenueCents[COHORT_MAX_MONTHS_SINCE],
    0,
  );
  const blendedLtv12mCents = matureTotalCustomers > 0
    ? Math.round(matureTotalCents / matureTotalCustomers)
    : 0;

  return {
    rows,
    blendedLtv12mCents,
    matureCohortCount: mature.length,
  };
}

export function formatCohortLabel(ym: string) {
  const [yyyy, mm] = parseMonthLabel(ym).split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = parseInt(mm, 10) - 1;
  return `${monthNames[monthIdx] ?? mm} ${yyyy}`;
}
