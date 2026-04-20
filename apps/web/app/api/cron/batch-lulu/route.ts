import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest, dispatchInternalJob } from "../../../../lib/internal-jobs";

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await dispatchInternalJob<{
      accepted?: boolean;
      dryRun?: boolean;
      job?: string;
      mode?: string;
      processed?: number;
      submitted?: number;
      skipped?: number;
      failed?: number;
      results?: unknown[];
    }>({
      path: "/api/internal/jobs/batch-submit-lulu",
      body: {},
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to enqueue batch Lulu submission",
      },
      { status: 500 },
    );
  }
}
