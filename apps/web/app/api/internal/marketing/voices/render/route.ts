import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { marketingVoiceRenderRequestSchema } from "@littlecolorbook/shared";
import { createProviderBatchId } from "../../../../../../lib/marketing-api";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { queueMarketingPayload } from "../../../../../../lib/marketing-files";
import { renderVoiceWithElevenLabs } from "../../../../../../lib/marketing-runtime";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = marketingVoiceRenderRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid voice render request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const audioAssetId = createProviderBatchId("audio");
  const queuedAt = new Date().toISOString();

  if (getIntegrationStatus().elevenLabsConfigured) {
    const executed = await renderVoiceWithElevenLabs(parsed.data);
    return NextResponse.json(executed, { status: 200 });
  }

  await queueMarketingPayload(path.join("provider-requests", "elevenlabs"), audioAssetId, {
    audioAssetId,
    provider: "elevenlabs",
    queuedAt,
    status: "queued",
    ...parsed.data,
  });

  return NextResponse.json(
    {
      accepted: true,
      audioAssetId,
      audioUrl: null,
      durationMs: null,
      provider: "elevenlabs",
      createdAt: queuedAt,
      status: "queued",
    },
    { status: 202 },
  );
}
