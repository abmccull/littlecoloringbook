import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@littlecolorbook/db";
import { runBatchSubmitLuluJob } from "@littlecolorbook/jobs";
import { z } from "zod";
import { authorizeInternalJobRequest, dispatchInternalJob } from "../../../../../lib/internal-jobs";
import { isLuluShippingConfigured } from "../../../../../lib/lulu";

const batchSubmitLuluSchema = z.object({
  dryRun: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = batchSubmitLuluSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid batch Lulu submission request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }

    return NextResponse.json({
      accepted: true,
      dryRun: parsed.data.dryRun ?? false,
      job: "batch-submit-lulu",
      mode: "dev-skip",
      processed: 0,
      submitted: 0,
      skipped: 0,
      failed: 0,
      results: [],
      reason: "database_not_configured",
    });
  }

  if (!isLuluShippingConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Lulu configuration is incomplete." }, { status: 503 });
    }

    return NextResponse.json({
      accepted: true,
      dryRun: parsed.data.dryRun ?? false,
      job: "batch-submit-lulu",
      mode: "dev-skip",
      processed: 0,
      submitted: 0,
      skipped: 0,
      failed: 0,
      results: [],
      reason: "lulu_not_configured",
    });
  }

  try {
    const result = await runBatchSubmitLuluJob(
      { dryRun: parsed.data.dryRun },
      {
        submitPrintOrder: async ({ lineItems, orderId }) =>
          dispatchInternalJob<{ status?: string; providerJobId?: string }>({
            path: "/api/internal/jobs/submit-lulu",
            body: {
              orderId,
              lineItems,
            },
          }),
      },
    );

    return NextResponse.json({ ...result, mode: "live" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Batch Lulu submission failed",
      },
      { status: 500 },
    );
  }
}
