import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured, markUploadCompleted } from "@littlecolorbook/db";
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
  });
}
