import { NextRequest, NextResponse } from "next/server";
import {
  createAssetRecords,
  createGenerationJobRecord,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
  listUploadsForOrder,
  seedGenerationPages,
  setGenerationJobStatus,
  setGenerationPageStatus,
  setOrderStatus,
} from "@littlecolorbook/db";
import { buildGenerationPlan, getPipelineRenderSettings, materializeGenerationPlan } from "@littlecolorbook/pipeline";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { uploadObject } from "@littlecolorbook/shared/storage";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

const processSampleSchema = z.object({
  orderId: z.string().trim().min(1),
  uploadIds: z.array(z.string().trim().min(1)).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = processSampleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid sample processing request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const summary = await getOrderPortalSummaryByOrderId(parsed.data.orderId);

  if (isDatabaseConfigured() && !summary) {
    return NextResponse.json({ accepted: false, error: "Order not found" }, { status: 404 });
  }

  const uploads = await listUploadsForOrder(parsed.data.orderId);
  const uploadedUploads = uploads.filter((upload) => upload.status === "uploaded");
  const selectedUploads = parsed.data.uploadIds?.length
    ? uploadedUploads.filter((upload) => parsed.data.uploadIds?.includes(upload.id))
    : uploadedUploads;

  if (selectedUploads.length === 0) {
    return NextResponse.json({ accepted: false, error: "No completed uploads are available for the sample job." }, { status: 409 });
  }

  const integrations = getIntegrationStatus();

  if (!integrations.geminiConfigured || !integrations.gcsConfigured) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Gemini image generation and GCS storage must be configured before sample processing can run.",
      },
      { status: 503 },
    );
  }

  const plan = buildGenerationPlan({
    deliveryMode: "pdf",
    designCount: 1,
    jobKind: "sample",
    orderId: parsed.data.orderId,
    sourceUploadIds: selectedUploads.map((upload) => upload.id),
  });
  const renderSettings = getPipelineRenderSettings("pdf", "sample");

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        accepted: false,
        error: "DATABASE_URL must be configured before sample processing can run.",
      },
      { status: 503 },
    );
  }

  await setOrderStatus(parsed.data.orderId, "generating", "generation.sample_started", {
    model: renderSettings.model,
    targetPages: plan.targetPages,
    uploadCount: selectedUploads.length,
  });

  const assets = await createAssetRecords(
    plan.pages.flatMap((page) => [
      {
        orderId: parsed.data.orderId,
        kind: "generated_page" as const,
        objectPath: page.generatedImagePath,
        mimeType: "image/png",
        pageNumber: page.pageNumber,
      },
      {
        orderId: parsed.data.orderId,
        kind: "preview" as const,
        objectPath: page.previewImagePath,
        mimeType: "image/jpeg",
        pageNumber: page.pageNumber,
      },
    ]),
  );

  const generatedAssetByPath = new Map(
    assets.filter((asset) => asset.kind === "generated_page").map((asset) => [asset.objectPath, asset.id]),
  );

  const job = await createGenerationJobRecord({
    orderId: parsed.data.orderId,
    kind: "sample",
    targetPages: plan.targetPages,
    model: renderSettings.model,
  });

  const seededPages = await seedGenerationPages(
    job.id,
    plan.pages.map((page) => ({
      pageNumber: page.pageNumber,
      uploadId: page.sourceUploadId,
      assetId: generatedAssetByPath.get(page.generatedImagePath) ?? null,
    })),
  );

  await setGenerationJobStatus(job.id, "running", "generation.sample_running", {
    model: renderSettings.model,
    targetPages: plan.targetPages,
  });

  try {
    const materialized = await materializeGenerationPlan({
      childFirstName: summary?.order.childFirstName ?? null,
      dedicationText: summary?.order.dedicationText ?? null,
      plan,
      selectedOfferCode: summary?.order.selectedOfferCode ?? null,
      uploads: selectedUploads.map((upload) => ({
        id: upload.id,
        contentType: upload.contentType,
        fileName: upload.fileName,
        objectPath: upload.objectPath,
      })),
    });

    for (const asset of materialized.assets) {
      await uploadObject({
        bucket: "exports",
        objectPath: asset.objectPath,
        body: asset.body,
        contentType: asset.contentType,
        cacheControl: "private, max-age=300",
      });
    }

    await setOrderStatus(parsed.data.orderId, "qa_review", "generation.sample_materialized", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

    for (const page of seededPages) {
      await setGenerationPageStatus(page.id, "approved", "generation.sample_page_approved", {
        pageNumber: page.pageNumber,
      });
    }

    await setGenerationJobStatus(job.id, "completed", "generation.sample_completed", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

    await setOrderStatus(parsed.data.orderId, "pdf_ready", "sample.ready", {
      model: materialized.model,
      previewCount: plan.targetPages,
    });

    try {
      await deliverLifecycleEmail({
        orderId: parsed.data.orderId,
        template: "pdf-ready",
      });
    } catch {
      // Email failure should not block sample delivery
    }

    return NextResponse.json({
      accepted: true,
      databaseConfigured: true,
      generationJobId: job.id,
      job: "process-sample",
      materialized: true,
      model: materialized.model,
      plan,
      provider: materialized.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sample generation failure";

    await setGenerationJobStatus(job.id, "failed", "generation.sample_failed", {
      message,
      model: renderSettings.model,
    });
    await setOrderStatus(parsed.data.orderId, "failed", "generation.sample_failed", {
      message,
      model: renderSettings.model,
    });

    return NextResponse.json(
      {
        accepted: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
