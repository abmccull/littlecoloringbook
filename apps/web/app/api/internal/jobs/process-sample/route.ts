export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { isJobRunnerError, runProcessSampleJob } from "@littlecolorbook/jobs";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

const processSampleSchema = z.object({
  orderId: z.string().trim().min(1),
  uploadIds: z.array(z.string().trim().min(1)).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = processSampleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid sample processing request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await runProcessSampleJob(
      {
        orderId: parsed.data.orderId,
        uploadIds: parsed.data.uploadIds,
      },
      {
        sendLifecycleEmail: deliverLifecycleEmail,
      },
    );

    return NextResponse.json(result);
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
        error: error instanceof Error ? error.message : "Unknown sample generation failure",
      },
      { status: 500 },
    );
  }
}
