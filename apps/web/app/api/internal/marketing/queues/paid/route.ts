import { NextRequest, NextResponse } from "next/server";
import { marketingPaidQueueRequestSchema } from "@littlecolorbook/shared";
import { writePaidQueue } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingPaidQueueRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid paid queue request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const paths = await writePaidQueue(parsed.data);

  return NextResponse.json({
    accepted: true,
    date: parsed.data.date,
    assetCount: parsed.data.assets.length,
    notes: parsed.data.notes ?? null,
    ...paths,
  });
}
