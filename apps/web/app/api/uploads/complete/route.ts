import { NextRequest, NextResponse } from "next/server";
import { getColoringEngineEnv, isColoringEngineConfigured } from "@littlecolorbook/shared/env";
import { isDatabaseConfigured, markUploadCompleted } from "@littlecolorbook/db";
import { createSignedDownloadUrl, objectExists } from "@littlecolorbook/shared/storage";
import { z } from "zod";

const uploadCompleteSchema = z.object({
  objectPath: z.string().min(1),
  entityType: z.enum(["sample", "order"]),
  entityId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = uploadCompleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid upload completion payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const exists = await objectExists({
    bucket: "uploads",
    objectPath: parsed.data.objectPath,
  }).catch(() => false);

  if (!exists) {
    return NextResponse.json(
      {
        error: "We couldn't find that uploaded photo yet. Please choose it again.",
      },
      { status: 409 },
    );
  }

  let sourceAssessment: Record<string, unknown> | null = null;
  let sourceAssessmentError: string | null = null;

  if (isColoringEngineConfigured()) {
    try {
      const env = getColoringEngineEnv();
      const signedDownload = await createSignedDownloadUrl({
        bucket: "uploads",
        objectPath: parsed.data.objectPath,
        expiresInMinutes: 15,
      });
      const assessmentResponse = await fetch(`${env.apiUrl}/v1/assess-source`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_id: `${parsed.data.entityType}:${parsed.data.entityId}:${parsed.data.objectPath}`,
          source_url: signedDownload.url,
        }),
        signal: AbortSignal.timeout(env.timeoutMs),
      });
      const payload = (await assessmentResponse.json().catch(() => null)) as Record<string, unknown> | null;

      if (!assessmentResponse.ok) {
        sourceAssessmentError = typeof payload?.detail === "string" ? payload.detail : `Source assessment failed (${assessmentResponse.status})`;
      } else if (payload) {
        sourceAssessment = payload;
        if (payload.accepted === false) {
          return NextResponse.json(
            {
              error: "This photo is likely to produce a weak coloring page. Please upload a sharper, better-lit image with a larger subject.",
              sourceAssessment,
            },
            { status: 422 },
          );
        }
      }
    } catch (error) {
      sourceAssessmentError = error instanceof Error ? error.message : "Source assessment failed";
    }
  }

  const upload = await markUploadCompleted(parsed.data.entityId, parsed.data.objectPath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Upload completion failed";
    return { error: message };
  });

  if ("error" in upload) {
    return NextResponse.json({ error: upload.error }, { status: 404 });
  }

  return NextResponse.json({
    acknowledged: true,
    status: upload.status,
    objectPath: parsed.data.objectPath,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    databaseConfigured: upload.databaseConfigured,
    sourceAssessment,
    sourceAssessmentError,
  });
}
