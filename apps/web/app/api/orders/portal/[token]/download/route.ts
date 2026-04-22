import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, downloadObjectStream, objectExists } from "@littlecolorbook/shared/storage";

const downloadReadyStatuses = new Set([
  "pdf_ready",
  "awaiting_print_submission",
  "submitted_to_lulu",
  "in_production",
  "shipped",
  "delivered",
]);

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!downloadReadyStatuses.has(summary.order.status)) {
    return NextResponse.json({ error: "PDF is not ready yet" }, { status: 404 });
  }

  const candidatePaths = [summary.assets.downloadPdfPath, summary.assets.interiorPdfPath].filter(
    (value): value is string => Boolean(value),
  );

  if (candidatePaths.length === 0) {
    return NextResponse.json({ error: "PDF is not ready yet" }, { status: 404 });
  }

  if (!getIntegrationStatus().gcsConfigured) {
    return NextResponse.json(
      {
        error: "Storage is not configured yet",
        objectPath: candidatePaths[0],
      },
      { status: 503 },
    );
  }

  for (const objectPath of candidatePaths) {
    try {
      const streamable = await downloadObjectStream({ bucket: "exports", objectPath });

      if (streamable) {
        return new NextResponse(streamable.stream, {
          status: 200,
          headers: {
            "Content-Type": streamable.contentType ?? "application/pdf",
            "Content-Disposition": `attachment; filename="${summary.order.id}.pdf"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
    } catch (error) {
      console.error("portal download: stream failed, checking fallback candidates", error);
    }
  }

  for (const objectPath of candidatePaths) {
    if (await objectExists({ bucket: "exports", objectPath })) {
      const signed = await createSignedDownloadUrl({
        bucket: "exports",
        objectPath,
        expiresInMinutes: 20,
      });

      return NextResponse.redirect(signed.url);
    }
  }

  return NextResponse.json({ error: "PDF is not ready yet" }, { status: 404 });
}
