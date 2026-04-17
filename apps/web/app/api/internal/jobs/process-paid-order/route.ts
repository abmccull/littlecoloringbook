export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { isJobRunnerError, runProcessPaidOrderJob } from "@littlecolorbook/jobs";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";

const processPaidOrderSchema = z.object({
  orderId: z.string().trim().min(1),
  uploadIds: z.array(z.string().trim().min(1)).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = processPaidOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid paid-order processing request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await runProcessPaidOrderJob(
      {
        orderId: parsed.data.orderId,
        uploadIds: parsed.data.uploadIds,
      },
      // Print orders are batched daily via the batch-submit-lulu cron job.
      // Do not pass submitPrintOrder here so print orders land in
      // awaiting_print_submission. PDF-only orders trigger pdf-ready
      // email as soon as the interior PDF is assembled.
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
        error: error instanceof Error ? error.message : "Unknown paid-order generation failure",
      },
      { status: 500 },
    );
  }
}
