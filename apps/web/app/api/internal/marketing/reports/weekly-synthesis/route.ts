import { NextRequest, NextResponse } from "next/server";
import { marketingWeeklySynthesisRequestSchema } from "@littlecolorbook/shared";
import { writeWeeklySynthesisReport } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { resolveMarketingPath } from "../../../../../../lib/marketing-files";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingWeeklySynthesisRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid weekly synthesis request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const relativePath = await writeWeeklySynthesisReport(parsed.data);

  return NextResponse.json({
    accepted: true,
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    reportPath: resolveMarketingPath(relativePath),
    relativePath,
  });
}
