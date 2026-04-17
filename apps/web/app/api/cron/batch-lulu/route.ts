import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest, enqueueInternalJob } from "../../../../lib/internal-jobs";

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await enqueueInternalJob({
      job: "batch-submit-lulu",
      payload: {},
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
