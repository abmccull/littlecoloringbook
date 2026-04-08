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
import { createSignedDownloadUrl, uploadObject } from "@littlecolorbook/shared/storage";
import { z } from "zod";
import { authorizeInternalJobRequest, dispatchInternalJob } from "../../../../../lib/internal-jobs";

const processPaidOrderSchema = z.object({
  orderId: z.string().trim().min(1),
  uploadIds: z.array(z.string().trim().min(1)).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = processPaidOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid paid-order processing request",
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
    return NextResponse.json({ accepted: false, error: "No completed uploads are available for the paid generation job." }, { status: 409 });
  }

  const integrations = getIntegrationStatus();

  if (!integrations.geminiConfigured || !integrations.gcsConfigured) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Gemini image generation and GCS storage must be configured before paid order processing can run.",
      },
      { status: 503 },
    );
  }

  const deliveryMode = summary?.order.deliveryMode === "print" ? "print" : "pdf";
  const designCount = summary?.order.designCount ?? 30;
  const plan = buildGenerationPlan({
    deliveryMode,
    designCount,
    jobKind: "full_book",
    orderId: parsed.data.orderId,
    sourceUploadIds: selectedUploads.map((upload) => upload.id),
  });
  const renderSettings = getPipelineRenderSettings(deliveryMode, "full_book");

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        accepted: false,
        error: "DATABASE_URL must be configured before paid order processing can run.",
      },
      { status: 503 },
    );
  }

  await setOrderStatus(parsed.data.orderId, "preprocessing", "generation.full_book_requested", {
    deliveryMode,
    model: renderSettings.model,
    targetPages: plan.targetPages,
    uploadCount: selectedUploads.length,
  });

  const assets = await createAssetRecords([
    ...plan.pages.flatMap((page) => [
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
    {
      orderId: parsed.data.orderId,
      kind: "interior_pdf" as const,
      objectPath: plan.pdf.interiorPdfPath,
      mimeType: "application/pdf",
    },
    {
      orderId: parsed.data.orderId,
      kind: "download_pdf" as const,
      objectPath: plan.pdf.downloadPdfPath,
      mimeType: "application/pdf",
    },
    ...(plan.pdf.coverPdfPath
      ? [
          {
            orderId: parsed.data.orderId,
            kind: "cover_pdf" as const,
            objectPath: plan.pdf.coverPdfPath,
            mimeType: "application/pdf",
          },
        ]
      : []),
  ]);

  const generatedAssetByPath = new Map(
    assets.filter((asset) => asset.kind === "generated_page").map((asset) => [asset.objectPath, asset.id]),
  );

  const job = await createGenerationJobRecord({
    orderId: parsed.data.orderId,
    kind: "full_book",
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

  await setOrderStatus(parsed.data.orderId, "generating", "generation.full_book_started", {
    deliveryMode,
    model: renderSettings.model,
    targetPages: plan.targetPages,
  });
  await setGenerationJobStatus(job.id, "running", "generation.full_book_running", {
    deliveryMode,
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

    await setOrderStatus(parsed.data.orderId, "qa_review", "generation.full_book_materialized", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

    for (const page of seededPages) {
      await setGenerationPageStatus(page.id, "approved", "generation.full_book_page_approved", {
        pageNumber: page.pageNumber,
      });
    }

    await setOrderStatus(parsed.data.orderId, "assembling_pdf", "generation.pdf_assembly_completed", {
      model: materialized.model,
      pdfAssetCount: materialized.assets.filter((asset) => asset.contentType === "application/pdf").length,
    });

    await setGenerationJobStatus(job.id, "completed", "generation.full_book_completed", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

    let finalStatus: "awaiting_print_submission" | "pdf_ready" | "submitted_to_lulu" =
      deliveryMode === "print" ? "awaiting_print_submission" : "pdf_ready";

    await setOrderStatus(parsed.data.orderId, finalStatus, deliveryMode === "print" ? "print.assets_ready" : "pdf.ready", {
      deliveryMode,
      model: materialized.model,
      previewCount: plan.targetPages,
    });

    if (deliveryMode === "print" && plan.pdf.coverPdfPath) {
      const [interiorSigned, coverSigned] = await Promise.all([
        createSignedDownloadUrl({
          bucket: "exports",
          objectPath: plan.pdf.interiorPdfPath,
          expiresInMinutes: 180,
        }),
        createSignedDownloadUrl({
          bucket: "exports",
          objectPath: plan.pdf.coverPdfPath,
          expiresInMinutes: 180,
        }),
      ]);

      try {
        const luluSubmission = await dispatchInternalJob<{ status?: string; providerJobId?: string }>( {
          path: "/api/internal/jobs/submit-lulu",
          body: {
            orderId: parsed.data.orderId,
            interiorUrl: interiorSigned.url,
            coverUrl: coverSigned.url,
            title: summary?.order.childFirstName
              ? `${summary.order.childFirstName}'s memory coloring book`
              : "littlecolorbook.com memory coloring book",
          },
        });

        if (luluSubmission?.status === "submitted_to_lulu") {
          finalStatus = "submitted_to_lulu";
        }
      } catch (error) {
        console.error("Failed to auto-submit print order to Lulu", error);
      }
    }

    return NextResponse.json({
      accepted: true,
      databaseConfigured: true,
      finalStatus,
      generationJobId: job.id,
      job: "process-paid-order",
      materialized: true,
      model: materialized.model,
      plan,
      provider: materialized.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown paid-order generation failure";

    await setGenerationJobStatus(job.id, "failed", "generation.full_book_failed", {
      message,
      model: renderSettings.model,
    });
    await setOrderStatus(parsed.data.orderId, "failed", "generation.full_book_failed", {
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
