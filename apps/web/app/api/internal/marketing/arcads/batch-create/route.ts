import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { marketingArcadsBatchCreateRequestSchema } from "@littlecolorbook/shared";
import { createProviderBatchId } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { queueMarketingPayload } from "../../../../../../lib/marketing-files";
import { createArcadsBatch } from "../../../../../../lib/marketing-runtime";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingArcadsBatchCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid Arcads batch request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const batchId = createProviderBatchId("arcads");
  const queuedAt = new Date().toISOString();

  if (getIntegrationStatus().arcadsConfigured) {
    const executed = await createArcadsBatch(parsed.data);
    return NextResponse.json(executed, { status: 200 });
  }

  await queueMarketingPayload(path.join("provider-requests", "arcads"), batchId, {
    batchId,
    provider: "arcads",
    queuedAt,
    status: "queued",
    ...parsed.data,
  });

  return NextResponse.json(
    {
      accepted: true,
      batchId,
      provider: "arcads",
      queuedVariants: parsed.data.variants.length,
      createdAt: queuedAt,
      status: "queued",
    },
    { status: 202 },
  );
}
