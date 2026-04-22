import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { renderPartyKitPdf } from "@littlecolorbook/pdf-templates";

// Streams "The Coloring Party Kit" bonus PDF — a 3-page printable set
// (cover sheet + coloring tips + fillable About-the-Artist page),
// personalized with the child's first name when the order has one.
//
// Gate: paid, non-sample orders only. Samples are a lead magnet and
// don't earn the bonus stack.
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

  const buffer = await renderPartyKitPdf({
    childFirstName: summary.order.childFirstName ?? null,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="coloring-party-kit.pdf"`,
      // Regenerated per-request but stable for a given order — safe to
      // cache at the edge for an hour.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
