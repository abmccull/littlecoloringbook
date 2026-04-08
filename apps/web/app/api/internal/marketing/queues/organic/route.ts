import { NextRequest, NextResponse } from "next/server";
import { marketingOrganicQueueRequestSchema } from "@littlecolorbook/shared";
import { writeOrganicQueue } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingOrganicQueueRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid organic queue request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const paths = await writeOrganicQueue(parsed.data);

  return NextResponse.json({
    accepted: true,
    date: parsed.data.date,
    assetCount: parsed.data.assets.length,
    publishWindowCount: parsed.data.publishWindows.length,
    ...paths,
  });
}
