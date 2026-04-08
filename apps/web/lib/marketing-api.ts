import "server-only";

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import {
  createMarketingRequestId,
  experimentDecisionSchema,
  internalProductAssetRequestSchema,
  type ExperimentDecision,
  type InternalProductAssetRequest,
  type InternalProductAssetResponse,
  type MarketingOrganicQueueRequest,
  type MarketingPaidQueueRequest,
  type MarketingWeeklySynthesisRequest,
  type MetricsDailyRow,
} from "@littlecolorbook/shared";
import { authorizeInternalJobRequest } from "./internal-jobs";
import { queueMarketingPayload, readMarketingJson, writeMarketingJson, writeMarketingMarkdown } from "./marketing-files";

type FatigueStatus = NonNullable<ExperimentDecision["fatigueStatus"]>;
type ProductAssetRequestValidator = (input: InternalProductAssetRequest) => string | null;
type ProductAssetRequestExecutor = (input: InternalProductAssetRequest) => Promise<InternalProductAssetResponse | null>;

function getMetricValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function scoreAgainstMedian(input: {
  value: number;
  medianValue: number;
  weight: number;
  inverse?: boolean;
}) {
  const floor = input.weight * 0.35;

  if (input.value <= 0 || input.medianValue <= 0) {
    return floor;
  }

  const rawRatio = input.inverse ? input.medianValue / input.value : input.value / input.medianValue;
  const clampedRatio = Math.max(0, Math.min(rawRatio, 1.5));

  return Number((clampedRatio * input.weight).toFixed(2));
}

function buildMedianMap(rows: MetricsDailyRow[]) {
  const metric = (selector: (row: MetricsDailyRow) => number) => median(rows.map(selector).filter((value) => value > 0));

  return {
    cac: metric((row) => getMetricValue(row.cac)),
    cpl: metric((row) => {
      const spend = getMetricValue(row.spend);
      const optIns = getMetricValue(row.landingPageOptIns);
      return spend > 0 && optIns > 0 ? spend / optIns : 0;
    }),
    ctr: metric((row) => getMetricValue(row.ctr)),
    holdRate: metric((row) => getMetricValue(row.holdRate)),
    hookRate: metric((row) => getMetricValue(row.hookRate)),
    optInRate: metric((row) => getMetricValue(row.optInRate)),
    printAttachRate: metric((row) => getMetricValue(row.printAttachRate)),
    profileVisits: metric((row) => getMetricValue(row.profileVisits)),
    purchaseRate: metric((row) => getMetricValue(row.purchaseRate)),
    savesAndShares: metric((row) => getMetricValue(row.saves) + getMetricValue(row.shares)),
    watchThroughRate: metric((row) => getMetricValue(row.watchThroughRate)),
  };
}

function deriveOrganicScore(row: MetricsDailyRow, medians: ReturnType<typeof buildMedianMap>) {
  return Number(
    (
      scoreAgainstMedian({ value: getMetricValue(row.hookRate), medianValue: medians.hookRate, weight: 25 }) +
      scoreAgainstMedian({ value: getMetricValue(row.watchThroughRate), medianValue: medians.watchThroughRate, weight: 20 }) +
      scoreAgainstMedian({
        value: getMetricValue(row.saves) + getMetricValue(row.shares),
        medianValue: medians.savesAndShares,
        weight: 20,
      }) +
      scoreAgainstMedian({ value: getMetricValue(row.profileVisits), medianValue: medians.profileVisits, weight: 15 }) +
      scoreAgainstMedian({ value: getMetricValue(row.optInRate), medianValue: medians.optInRate, weight: 10 }) +
      scoreAgainstMedian({ value: getMetricValue(row.purchaseRate), medianValue: medians.purchaseRate, weight: 10 })
    ).toFixed(2),
  );
}

function derivePaidScore(row: MetricsDailyRow, medians: ReturnType<typeof buildMedianMap>) {
  const spend = getMetricValue(row.spend);
  const optIns = getMetricValue(row.landingPageOptIns);
  const derivedCpl = spend > 0 && optIns > 0 ? spend / optIns : 0;

  return Number(
    (
      scoreAgainstMedian({ value: getMetricValue(row.hookRate), medianValue: medians.hookRate, weight: 20 }) +
      scoreAgainstMedian({ value: getMetricValue(row.holdRate), medianValue: medians.holdRate, weight: 15 }) +
      scoreAgainstMedian({ value: getMetricValue(row.ctr), medianValue: medians.ctr, weight: 20 }) +
      scoreAgainstMedian({ value: derivedCpl, medianValue: medians.cpl, weight: 20, inverse: true }) +
      scoreAgainstMedian({ value: getMetricValue(row.cac), medianValue: medians.cac, weight: 15, inverse: true }) +
      scoreAgainstMedian({ value: getMetricValue(row.printAttachRate), medianValue: medians.printAttachRate, weight: 10 })
    ).toFixed(2),
  );
}

function deriveFatigueStatus(row: MetricsDailyRow, organicScore: number, paidScore: number): FatigueStatus {
  const impressions = getMetricValue(row.impressions);
  const score = row.platform === "meta_ads" ? paidScore : organicScore;

  if (impressions >= 10000 && score < 55) {
    return "fatigued";
  }

  if (impressions >= 5000) {
    return "watch";
  }

  if (impressions > 0) {
    return "stable";
  }

  return "fresh";
}

function deriveWinnerStatus(row: MetricsDailyRow, organicScore: number, paidScore: number) {
  const score = row.platform === "meta_ads" ? paidScore : organicScore;

  if (score >= 95) {
    return "winner" as const;
  }

  if (score >= 78) {
    return "near_winner" as const;
  }

  if (score < 45) {
    return "loser" as const;
  }

  return "neutral" as const;
}

function deriveRecommendedAction(input: {
  platform: MetricsDailyRow["platform"];
  fatigueStatus: FatigueStatus;
  winnerStatus: ExperimentDecision["winnerStatus"];
}) {
  if (input.fatigueStatus === "fatigued") {
    return "retire" as const;
  }

  if (input.winnerStatus === "winner") {
    return input.platform === "meta_ads" ? ("exploit" as const) : ("promote_to_paid" as const);
  }

  if (input.winnerStatus === "near_winner") {
    return "adjacent" as const;
  }

  if (input.winnerStatus === "loser") {
    return "pause" as const;
  }

  return "explore" as const;
}

export function rankMarketingMetricsRows(rows: MetricsDailyRow[]) {
  const medians = buildMedianMap(rows);

  return rows.map((row) => {
    const organicScore = deriveOrganicScore(row, medians);
    const paidScore = derivePaidScore(row, medians);
    const fatigueStatus = deriveFatigueStatus(row, organicScore, paidScore);
    const winnerStatus = deriveWinnerStatus(row, organicScore, paidScore);
    const recommendedAction = deriveRecommendedAction({
      platform: row.platform,
      fatigueStatus,
      winnerStatus,
    });

    const reasonCodes = [row.platform === "meta_ads" ? "paid_surface" : "organic_surface", fatigueStatus, winnerStatus];

    return experimentDecisionSchema.parse({
      assetId: row.assetId,
      reportDate: row.reportDate,
      organicScore,
      paidScore,
      winnerStatus,
      fatigueStatus,
      recommendedAction,
      reasonCodes,
      notes: `${row.platform} creative ranked from normalized daily metrics.`,
    });
  });
}

export function mergeMetricsRows(existingRows: MetricsDailyRow[], incomingRows: MetricsDailyRow[]) {
  const keyedRows = new Map<string, MetricsDailyRow>();

  for (const row of [...existingRows, ...incomingRows]) {
    const key = [
      row.assetId,
      row.platform,
      row.reportDate,
      row.accountId ?? "",
      row.campaignId ?? "",
      row.adsetId ?? "",
      row.adId ?? "",
    ].join("::");

    keyedRows.set(key, row);
  }

  return [...keyedRows.values()].sort((left, right) => {
    if (left.platform !== right.platform) {
      return left.platform.localeCompare(right.platform);
    }

    return left.assetId.localeCompare(right.assetId);
  });
}

export function createQueuedProductAssetRouteHandler(
  expectedOrderStyle: InternalProductAssetRequest["orderStyle"],
  options?: { validate?: ProductAssetRequestValidator; execute?: ProductAssetRequestExecutor },
) {
  return async function POST(request: NextRequest) {
    const unauthorized = authorizeInternalJobRequest(request);

    if (unauthorized) {
      return unauthorized;
    }

    const body = await request.json().catch(() => null);
    const parsed = internalProductAssetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          accepted: false,
          error: "Invalid marketing render request",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (parsed.data.orderStyle !== expectedOrderStyle) {
      return NextResponse.json(
        {
          accepted: false,
          error: `Expected orderStyle '${expectedOrderStyle}'`,
        },
        { status: 400 },
      );
    }

    const validationError = options?.validate?.(parsed.data);

    if (validationError) {
      return NextResponse.json(
        {
          accepted: false,
          error: validationError,
        },
        { status: 400 },
      );
    }

    const receivedAt = new Date().toISOString();
    const executed = options?.execute ? await options.execute(parsed.data) : null;

    if (executed) {
      return NextResponse.json(executed, { status: executed.status === "queued" ? 202 : 200 });
    }

    await queueMarketingPayload("render-requests", parsed.data.requestId, {
      ...parsed.data,
      receivedAt,
    });

    const response: InternalProductAssetResponse = {
      requestId: parsed.data.requestId,
      status: "queued",
      assets: [],
      provider: "internal-renderer",
      createdAt: receivedAt,
      error: null,
    };

    return NextResponse.json(response, { status: 202 });
  };
}

export async function loadMetricsRowsForDate(reportDate: string) {
  const payload = await readMarketingJson<{ reportDate: string; rows: MetricsDailyRow[] }>(
    path.join("experiments", `metrics-${reportDate}.json`),
  );

  return payload?.rows ?? [];
}

export async function writeMetricsRowsForDate(reportDate: string, rows: MetricsDailyRow[]) {
  return writeMarketingJson(path.join("experiments", `metrics-${reportDate}.json`), {
    reportDate,
    rowCount: rows.length,
    rows,
  });
}

export async function writeOrganicQueue(payload: MarketingOrganicQueueRequest) {
  const currentPath = await writeMarketingJson(path.join("queues", "today-organic-queue.json"), payload);
  const historyPath = await writeMarketingJson(path.join("queues", "history", `organic-${payload.date}.json`), payload);

  return { currentPath, historyPath };
}

export async function writePaidQueue(payload: MarketingPaidQueueRequest) {
  const currentPath = await writeMarketingJson(path.join("queues", "today-paid-nominations.json"), payload);
  const historyPath = await writeMarketingJson(path.join("queues", "history", `paid-${payload.date}.json`), payload);

  return { currentPath, historyPath };
}

export async function writeWeeklySynthesisReport(input: MarketingWeeklySynthesisRequest) {
  const lines = [
    "# Weekly Synthesis",
    "",
    "## Period",
    "",
    `${input.periodStart} to ${input.periodEnd}`,
  ];

  if (input.occasion) {
    lines.push("", "## Occasion Focus", "", input.occasion);
  }

  const sections: Array<[string, string[]]> = [
    ["Top Assets", input.topAssets],
    ["Top Learnings", input.topLearnings],
    ["Kill", input.kills],
    ["Scale", input.scaleRecommendations],
  ];

  for (const [title, values] of sections) {
    lines.push("", `## ${title}`, "");

    if (values.length === 0) {
      lines.push("- None");
      continue;
    }

    for (const value of values) {
      lines.push(`- ${value}`);
    }
  }

  const relativePath = path.join("reports", `weekly-synthesis-${input.periodEnd}.md`);
  await writeMarketingMarkdown(relativePath, lines.join("\n"));

  return relativePath;
}

export function createProviderBatchId(prefix: string) {
  return createMarketingRequestId(prefix);
}
