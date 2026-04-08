import { NextRequest, NextResponse } from "next/server";
import { createUploadPlaceholder, isDatabaseConfigured } from "@littlecolorbook/db";
import { z } from "zod";
import { buildAssetPath, createSignedUploadUrl, sanitizeObjectName } from "@littlecolorbook/shared/storage";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";

const presignRequestSchema = z.object({
  entityType: z.enum(["sample", "order"]),
  entityId: z.string().min(1),
  uploadKind: z.enum(["original", "reference"]).default("original"),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = presignRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid upload request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const integrations = getIntegrationStatus();

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  if (!integrations.gcsConfigured) {
    return NextResponse.json(
      {
        error: "Google Cloud Storage is not configured",
      },
      { status: 503 },
    );
  }

  const safeFileName = sanitizeObjectName(parsed.data.fileName);
  const objectPath = buildAssetPath([
    parsed.data.entityType === "sample" ? "samples" : "orders",
    parsed.data.entityId,
    parsed.data.uploadKind,
    `${Date.now()}-${safeFileName}`,
  ]);

  await createUploadPlaceholder({
    orderId: parsed.data.entityId,
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
    objectPath,
    kind: parsed.data.uploadKind,
  });

  const signedUpload = await createSignedUploadUrl({
    bucket: "uploads",
    objectPath,
    contentType: parsed.data.contentType,
  });

  return NextResponse.json({
    objectPath,
    bucket: "uploads",
    databaseConfigured: isDatabaseConfigured(),
    ...signedUpload,
  });
}
