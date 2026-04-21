import { NextRequest, NextResponse } from "next/server";
import { getOrderById, listUploadsForOrder, setOrderStatus } from "@littlecolorbook/db";
import { z } from "zod";
import { enqueueInternalJob } from "../../../../../lib/internal-jobs";

const startSampleSchema = z.object({
  uploadIds: z.array(z.string().trim().min(1)).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = startSampleSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid sample start request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const order = await getOrderById(orderId);

  if (!order) {
    return NextResponse.json({ error: "Sample order not found" }, { status: 404 });
  }

  if (order.orderType !== "sample") {
    return NextResponse.json({ error: "Only sample orders can use this endpoint" }, { status: 400 });
  }

  const uploads = await listUploadsForOrder(orderId);
  const uploadedUploads = uploads.filter((upload) => upload.status === "uploaded");
  const requestedUploadIds = new Set(parsed.data.uploadIds ?? []);
  const selectedUploads = requestedUploadIds.size > 0
    ? uploadedUploads.filter((upload) => requestedUploadIds.has(upload.id))
    : uploadedUploads;

  if (selectedUploads.length === 0) {
    return NextResponse.json({ error: "Upload at least one completed photo before starting the sample." }, { status: 409 });
  }

  let jobQueued = false;
  let dispatchMode: "direct" | "postgres" | null = null;
  const allowDirectFallback = process.env.NODE_ENV !== "production";

  try {
    const queued = await enqueueInternalJob({
      job: "process-sample",
      payload: {
        orderId,
      },
      fallbackToDirectOnQueueError: allowDirectFallback,
    });
    jobQueued = queued.accepted;
    dispatchMode = queued.mode;
  } catch (error) {
    console.error("Failed to queue sample processing", error);
    return NextResponse.json({ error: "We could not start the sample. Please try again." }, { status: 500 });
  }

  // For the async (Postgres) path the worker runs the job after we
  // return — flip the order into preprocessing so the portal shows the
  // correct state immediately. For the synchronous direct path, the
  // dispatched job has already transitioned state itself.
  const asyncDispatch = dispatchMode === "postgres";
  if (jobQueued && asyncDispatch) {
    await setOrderStatus(orderId, "preprocessing", "generation.sample_requested", {
      uploadCount: selectedUploads.length,
      requestedUploadIds: Array.from(requestedUploadIds),
    });
  }

  return NextResponse.json({
    accepted: jobQueued,
    jobQueued,
    orderId,
    status: asyncDispatch ? "preprocessing" : order.status,
    uploadCount: selectedUploads.length,
    mode: dispatchMode,
  });
}
