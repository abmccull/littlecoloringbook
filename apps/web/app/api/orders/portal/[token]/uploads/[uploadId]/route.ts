import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, downloadObjectStream, objectExists } from "@littlecolorbook/shared/storage";

function safeInlineFilename(value: string) {
  return value.replaceAll('"', "");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; uploadId: string }> },
) {
  const { token, uploadId } = await context.params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const upload = summary.uploads.find((item) => item.id === uploadId);

  if (!upload || upload.status !== "uploaded") {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  if (!getIntegrationStatus().gcsConfigured) {
    return NextResponse.json(
      {
        error: "Storage is not configured yet",
        objectPath: upload.objectPath,
      },
      { status: 503 },
    );
  }

  try {
    const streamable = await downloadObjectStream({ bucket: "uploads", objectPath: upload.objectPath });

    if (streamable) {
      return new NextResponse(streamable.stream, {
        status: 200,
        headers: {
          "Content-Type": streamable.contentType ?? "image/jpeg",
          "Content-Disposition": `inline; filename="${safeInlineFilename(upload.fileName)}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }
  } catch (error) {
    console.error("portal upload image: stream failed, checking signed fallback", error);
  }

  if (await objectExists({ bucket: "uploads", objectPath: upload.objectPath })) {
    const signed = await createSignedDownloadUrl({
      bucket: "uploads",
      objectPath: upload.objectPath,
      expiresInMinutes: 20,
    });

    return NextResponse.redirect(signed.url);
  }

  return NextResponse.json({ error: "Upload not found" }, { status: 404 });
}
