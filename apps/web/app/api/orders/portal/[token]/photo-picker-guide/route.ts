import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { renderPhotoPickerGuidePdf } from "@littlecolorbook/pdf-templates";

// Streams the "Best Photo Picker Guide" bonus PDF — a one-page static
// checklist. Content is identical for every customer; gate is still
// the portal token so bonus links can't be shared without an order.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (summary.order.orderType === "sample") {
    return NextResponse.json({ error: "Bonus available on paid orders only" }, { status: 403 });
  }

  const buffer = await renderPhotoPickerGuidePdf();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="best-photo-picker-guide.pdf"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
