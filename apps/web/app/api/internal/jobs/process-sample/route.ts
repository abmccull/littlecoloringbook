export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { isJobRunnerError, runProcessSampleJob } from "@littlecolorbook/jobs";
import { getOrderById } from "@littlecolorbook/db";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";
import { enrollInWelcome } from "../../../../../lib/sequence-enrollment";

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

    // Welcome-sequence enrollment. Runs after sample delivery is
    // initiated — the first email in the sequence IS the sample delivery
    // email in the copy plan, but that's transactional and already fired
    // via deliverLifecycleEmail('pdf-ready'). The sequence steps 2-5
    // (Day 2, 5, 9, 14) are what this enrollment schedules.
    try {
      const order = await getOrderById(parsed.data.orderId);
      if (order?.customerId) {
        await enrollInWelcome({ customerId: order.customerId });
      }
    } catch (error) {
      console.error("process-sample: enrollInWelcome failed (non-fatal)", error);
    }

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
