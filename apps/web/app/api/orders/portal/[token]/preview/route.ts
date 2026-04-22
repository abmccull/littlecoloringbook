import { NextRequest, NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pageNumber = Number.parseInt(request.nextUrl.searchParams.get("pageNumber") ?? "", 10);
  const objectPath =
    Number.isFinite(pageNumber) && pageNumber > 0
      ? summary.pageIssues.find((issue) => issue.pageNumber === pageNumber)?.previewObjectPath ?? null
      : summary.assets.previewPath;

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
