import { NextResponse } from "next/server";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import type { OrderStatus } from "@littlecolorbook/db";

// ─── Status label map ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Getting your photo ready",
  awaiting_payment: "Getting your photo ready",
  paid: "Getting your photo ready",
  preprocessing: "Finding the best lines",
  generating: "Drawing your page",
  qa_review: "Final touches",
  assembling_pdf: "Final touches",
  pdf_ready: "Ready!",
  awaiting_print_submission: "Ready!",
  submitted_to_lulu: "Ready!",
  in_production: "Ready!",
  shipped: "Ready!",
  delivered: "Ready!",
  failed: "Something went wrong",
  support_required: "Under review",
  refunded: "Refunded",
};

const STATUS_PROGRESS: Record<OrderStatus, number> = {
  draft: 5,
  awaiting_payment: 5,
  paid: 5,
  preprocessing: 25,
  generating: 55,
  qa_review: 85,
  assembling_pdf: 90,
  pdf_ready: 100,
  awaiting_print_submission: 100,
  submitted_to_lulu: 100,
  in_production: 100,
  shipped: 100,
  delivered: 100,
  failed: 0,
  support_required: 0,
  refunded: 0,
};

// ─── Estimated seconds remaining heuristic ───────────────────────────────────
// Total typical duration is ~75 s. We subtract elapsed time in-flight.

const TYPICAL_TOTAL_SECONDS = 75;

function estimateSecondsRemaining(status: OrderStatus, createdAt: Date): number {
  if (status === "pdf_ready") return 0;
  if (status === "failed" || status === "support_required") return 0;

  const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
  const progressFraction = (STATUS_PROGRESS[status] ?? 5) / 100;
  // How many seconds a job at this progress fraction would have taken
  const estimatedElapsed = progressFraction * TYPICAL_TOTAL_SECONDS;
  const remaining = Math.max(0, TYPICAL_TOTAL_SECONDS - Math.max(elapsedSeconds, estimatedElapsed));
  return Math.round(remaining);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { order } = summary;
  const status = order.status as OrderStatus;

  const previewUrl =
    status === "pdf_ready" && summary.assets.previewPath
      ? `/api/orders/portal/${token}/preview`
      : null;

  return NextResponse.json(
    {
      orderId: order.id,
      status,
      statusLabel: STATUS_LABEL[status] ?? "Processing",
      progressPercent: STATUS_PROGRESS[status] ?? 5,
      estimatedSecondsRemaining: estimateSecondsRemaining(status, order.createdAt),
      previewUrl,
    },
    {
      headers: {
        // No caching — callers poll every 3 s and need fresh data
        "Cache-Control": "no-store",
      },
    },
  );
}
