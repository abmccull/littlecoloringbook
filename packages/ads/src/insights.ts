import type { GraphClient } from "@littlecolorbook/meta";
import type { AdsInsightsField } from "./types";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_MS = 60_000;

type InsightsLevel = "ad" | "adset" | "campaign" | "account";

type FetchAdsInsightsInput = {
  client: GraphClient;
  entityId: string;
  level: InsightsLevel;
  datePreset: string;
  fields: AdsInsightsField[];
  filtering?: Array<{ field: string; operator: string; value: unknown }>;
  breakdowns?: string[];
};

type AsyncInsightsJobStartResult = {
  report_run_id: string;
};

type AsyncInsightsJobStatus = {
  id: string;
  async_status: string;
  async_percent_completion: number;
};

type InsightsDataResult = {
  data: Record<string, unknown>[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAdsInsights(input: FetchAdsInsightsInput): Promise<Record<string, unknown>[]> {
  const { client, entityId, level, datePreset, fields, filtering, breakdowns } = input;

  const startBody: Record<string, unknown> = {
    level,
    date_preset: datePreset,
    fields: fields.join(","),
    async: true,
  };

  if (filtering && filtering.length > 0) startBody.filtering = JSON.stringify(filtering);
  if (breakdowns && breakdowns.length > 0) startBody.breakdowns = breakdowns.join(",");

  const jobStart = await client.post<AsyncInsightsJobStartResult>(`${entityId}/insights`, startBody);
  const reportRunId = jobStart.report_run_id;

  if (!reportRunId) {
    throw new Error("fetchAdsInsights: report_run_id missing from async job start response");
  }

  const startedAt = Date.now();

  while (true) {
    await sleep(POLL_INTERVAL_MS);

    const statusResult = await client.get<AsyncInsightsJobStatus>(reportRunId);

    if (statusResult.async_status === "Job Completed") {
      break;
    }

    if (statusResult.async_status === "Job Failed") {
      throw new Error(`Insights async job ${reportRunId} failed`);
    }

    if (Date.now() - startedAt > MAX_POLL_MS) {
      throw new Error(`Insights async job ${reportRunId} did not complete within ${MAX_POLL_MS}ms (last status: ${statusResult.async_status})`);
    }
  }

  const result = await client.get<InsightsDataResult>(`${reportRunId}/insights`, {
    fields: fields.join(","),
  });

  return result.data ?? [];
}
