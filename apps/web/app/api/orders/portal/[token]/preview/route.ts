import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const objectPath = summary.assets.previewPath;

  if (!objectPath) {
    return NextResponse.json({ error: "Preview is not ready yet" }, { status: 404 });
  }

  if (!getIntegrationStatus().gcsConfigured) {
    return NextResponse.json(
      {
        error: "Storage is not configured yet",
        objectPath,
      },
      { status: 503 },
    );
  }

  const signed = await createSignedDownloadUrl({
    bucket: "exports",
    objectPath,
    expiresInMinutes: 20,
  });

  return NextResponse.redirect(signed.url);
}
