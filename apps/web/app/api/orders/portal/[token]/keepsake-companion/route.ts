import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { renderKeepsakeCompanionPdf } from "@littlecolorbook/pdf-templates";

// Streams the "Keepsake Companion" bonus PDF - a printable add-on that
// makes the finished book feel more like a family keepsake and gift.
//
// Gate: paid, non-sample orders only. Samples are a lead magnet and
// do not earn the full bonus stack.
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

  const buffer = await renderKeepsakeCompanionPdf({
    childFirstName: summary.order.childFirstName ?? null,
    customerFirstName: summary.customer?.firstName ?? null,
    dedicationText: summary.order.dedicationText ?? null,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="keepsake-companion.pdf"',
      "Cache-Control": "private, max-age=3600",
    },
  });
}
