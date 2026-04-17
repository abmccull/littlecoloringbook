import { NextResponse } from "next/server";
import { getOrderForCustomer } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, downloadObjectStream } from "@littlecolorbook/shared/storage";
import { getCustomerSession } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;
  const summary = await getOrderForCustomer({ customerId: session.customerId, orderId });

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const objectPath = summary.assets.downloadPdfPath ?? summary.assets.interiorPdfPath;

  if (!objectPath) {
    return NextResponse.json({ error: "PDF is not ready yet" }, { status: 404 });
  }

  if (!getIntegrationStatus().gcsConfigured) {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });
  }

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
    console.error("account download: stream failed, falling back to redirect", error);
  }

  // Fallback: short-lived signed URL redirect. The stream path is preferred
  // so the URL never lands in browser history / referer headers.
  const signed = await createSignedDownloadUrl({ bucket: "exports", objectPath, expiresInMinutes: 5 });
  return NextResponse.redirect(signed.url);
}
