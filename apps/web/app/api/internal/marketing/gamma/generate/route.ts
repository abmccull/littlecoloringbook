import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createProviderBatchId } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { queueMarketingPayload } from "../../../../../../lib/marketing-files";
import { createGammaGeneration } from "../../../../../../lib/marketing-runtime";
import { marketingGammaGenerateRequestSchema } from "@littlecolorbook/shared";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingGammaGenerateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid Gamma generation request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (getIntegrationStatus().gammaConfigured) {
    const executed = await createGammaGeneration(parsed.data);
    return NextResponse.json(executed, { status: 200 });
  }

  const generationId = createProviderBatchId("gamma");
  const queuedAt = new Date().toISOString();

  await queueMarketingPayload(path.join("provider-requests", "gamma"), generationId, {
    generationId,
    provider: "gamma",
    queuedAt,
    status: "queued",
    ...parsed.data,
  });

  return NextResponse.json(
    {
      accepted: true,
      generationId,
      provider: "gamma",
      createdAt: queuedAt,
      status: "queued",
    },
    { status: 202 },
  );
}
