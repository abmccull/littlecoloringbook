import { NextRequest, NextResponse } from "next/server";
import { isJobRunnerError, runProcessCapiEventJob } from "@littlecolorbook/jobs";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

const processCapiEventSchema = z.object({
  capiEventId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = processCapiEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid CAPI processing request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await runProcessCapiEventJob({
      capiEventId: parsed.data.capiEventId,
    });

    if ("failed" in result && result.failed) {
      return NextResponse.json(
        {
          accepted: false,
          ...result,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      accepted: true,
      ...result,
    });
  } catch (error) {
    if (isJobRunnerError(error)) {
      return NextResponse.json(
        {
          accepted: false,
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        accepted: false,
        error: error instanceof Error ? error.message : "Unknown CAPI processing failure",
      },
      { status: 500 },
    );
  }
}
