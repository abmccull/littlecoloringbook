import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrderPortalSummary,
  isDatabaseConfigured,
  setOrderStatus,
  updateOrderCustomization,
} from "@littlecolorbook/db";
import { enqueueInternalJob } from "../../../../../lib/internal-jobs";

const startGenerationSchema = z.object({
  portalToken: z.string().trim().min(1),
  childFirstName: z.string().trim().max(80).optional(),
  coverStyle: z.string().trim().optional(),
  dedicationText: z.string().trim().max(240).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = startGenerationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const summary = await getOrderPortalSummary(parsed.data.portalToken);

  if (!summary || summary.order.id !== orderId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (summary.order.status !== "paid") {
    return NextResponse.json(
      { error: `Order is not in a paid state. Current status: ${summary.order.status}` },
      { status: 409 },
    );
  }

  const uploadedCount = summary.uploads.filter((u) => u.status === "uploaded").length;

  if (uploadedCount === 0) {
    return NextResponse.json(
      { error: "Upload at least one photo before starting generation." },
      { status: 422 },
    );
  }

  const hasCustomizationFields =
    parsed.data.childFirstName !== undefined ||
    parsed.data.coverStyle !== undefined ||
    parsed.data.dedicationText !== undefined;

  if (hasCustomizationFields) {
    await updateOrderCustomization({
      orderId,
      childFirstName: parsed.data.childFirstName ?? undefined,
      coverStyle: parsed.data.coverStyle ?? undefined,
      dedicationText: parsed.data.dedicationText ?? undefined,
    });
  }

  let jobQueued = false;
  let dispatchMode: "queue" | "direct" | null = null;

  try {
    const queued = await enqueueInternalJob({
      job: "process-paid-order",
      payload: { orderId },
      fallbackToDirectOnQueueError: true,
    });
    jobQueued = queued.accepted;
    dispatchMode = queued.mode;
  } catch (error) {
    console.error("Failed to queue paid order processing", error);
    return NextResponse.json(
      { error: "We could not start generation. Please try again or contact support." },
      { status: 500 },
    );
  }

  if (jobQueued && dispatchMode === "queue") {
    await setOrderStatus(orderId, "preprocessing", "order.generation_started", {
      uploadedCount,
      triggeredBy: "setup_page",
    });
  }

  return NextResponse.json({
    orderId,
    status: dispatchMode === "queue" ? "preprocessing" : summary.order.status,
    uploadedCount,
    jobQueued,
    mode: dispatchMode,
  });
}
