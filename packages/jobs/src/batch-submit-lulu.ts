import {
  isDatabaseConfigured,
  listPrintSubmissionCandidates,
} from "@littlecolorbook/db";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";
import { JobRunnerError } from "./errors";

type SubmitPrintLineItem = {
  coverUrl: string;
  interiorUrl: string;
  quantity: number;
  title: string;
};

type SubmitPrintOrderResult = {
  providerJobId?: string;
  status?: string;
};

type BatchSubmitLuluJobInput = {
  dryRun?: boolean;
};

type BatchSubmitLuluJobOptions = {
  submitPrintOrder: (input: { lineItems: SubmitPrintLineItem[]; orderId: string }) => Promise<SubmitPrintOrderResult | null | undefined>;
};

type BatchOrderResult = {
  orderId: string;
  status: "submitted" | "skipped" | "failed";
  providerJobId?: string | null;
  reason?: string;
};

export async function runBatchSubmitLuluJob(
  input: BatchSubmitLuluJobInput,
  options: BatchSubmitLuluJobOptions,
): Promise<{
  accepted: true;
  dryRun: boolean;
  job: "batch-submit-lulu";
  processed: number;
  submitted: number;
  skipped: number;
  failed: number;
  results: BatchOrderResult[];
}> {
  if (!isDatabaseConfigured()) {
    throw new JobRunnerError("DATABASE_URL must be configured before batch Lulu submission can run.", 503);
  }

  const candidates = await listPrintSubmissionCandidates();

  const dryRun = input.dryRun ?? false;
  const results: BatchOrderResult[] = [];

  for (const candidate of candidates) {
    const { orderId, interiorPdfPath, coverPdfPaths, copyNames, childFirstName } = candidate;

    if (!interiorPdfPath || coverPdfPaths.length === 0) {
      results.push({
        orderId,
        status: "skipped",
        reason: "Missing interior or cover PDF assets",
      });
      continue;
    }

    if (dryRun) {
      results.push({
        orderId,
        status: "skipped",
        reason: "dry_run",
      });
      continue;
    }

    try {
      const [interiorSigned, ...coverSignedUrls] = await Promise.all([
        createSignedDownloadUrl({
          bucket: "exports",
          objectPath: interiorPdfPath,
          expiresInMinutes: 180,
        }),
        ...coverPdfPaths.map((objectPath) =>
          createSignedDownloadUrl({
            bucket: "exports",
            objectPath,
            expiresInMinutes: 180,
          }),
        ),
      ]);

      const submission = await options.submitPrintOrder({
        orderId,
        lineItems: coverSignedUrls.map((coverSigned, index) => {
          const copyName = copyNames?.[index] ?? childFirstName ?? null;
          const title = copyName
            ? `${copyName}'s memory coloring book`
            : "littlecolorbook.com memory coloring book";

          return {
            coverUrl: coverSigned.url,
            interiorUrl: interiorSigned.url,
            quantity: 1,
            title,
          };
        }),
      });

      results.push({
        orderId,
        status: "submitted",
        providerJobId: submission?.providerJobId ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown batch Lulu submission failure";
      console.error(`Batch Lulu submission failed for order ${orderId}:`, error);
      results.push({
        orderId,
        status: "failed",
        reason: message,
      });
    }
  }

  const submitted = results.filter((r) => r.status === "submitted").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return {
    accepted: true,
    dryRun,
    job: "batch-submit-lulu" as const,
    processed: candidates.length,
    submitted,
    skipped,
    failed,
    results,
  };
}
