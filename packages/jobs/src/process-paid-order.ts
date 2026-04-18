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
import {
  buildGenerationPlan,
  getPipelineRenderSettings,
  materializeGenerationPlan,
  pipelineCleanupVersion,
  pipelinePromptVersion,
} from "@littlecolorbook/pipeline";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, uploadObject } from "@littlecolorbook/shared/storage";
import { JobRunnerError } from "./errors";

function estimateGeminiPageCostCents(deliveryMode: "pdf" | "print", attempts: number) {
  const perImage = Number(process.env.GEMINI_COST_CENTS_PER_IMAGE ?? "4");
  const sizeMultiplier = deliveryMode === "print" ? 2 : 1; // 2048x2048 print vs 1024x1024 PDF
  return Math.max(1, Math.round(perImage * sizeMultiplier * Math.max(1, attempts)));
}

type SubmitPrintLineItem = {
  coverUrl: string;
  interiorUrl: string;
  quantity: number;
  title: string;
};

type SubmitPrintOrderResult = {
  providerJobId?: string;
  status?: string;
};

type ProcessPaidOrderJobInput = {
  orderId: string;
  uploadIds?: string[];
};

type PaidLifecycleTemplate = "pdf-ready";

type ProcessPaidOrderJobOptions = {
  submitPrintOrder?: (input: { lineItems: SubmitPrintLineItem[]; orderId: string }) => Promise<SubmitPrintOrderResult | null | undefined>;
  sendLifecycleEmail?: (input: { orderId: string; template: PaidLifecycleTemplate }) => Promise<unknown>;
};

export async function runProcessPaidOrderJob(input: ProcessPaidOrderJobInput, options: ProcessPaidOrderJobOptions = {}) {
  const summary = await getOrderPortalSummaryByOrderId(input.orderId);

  if (isDatabaseConfigured() && !summary) {
    throw new JobRunnerError("Order not found", 404);
  }

  const uploads = await listUploadsForOrder(input.orderId);
  const uploadedUploads = uploads.filter((upload) => upload.status === "uploaded");
  const selectedUploads = input.uploadIds?.length
    ? uploadedUploads.filter((upload) => input.uploadIds?.includes(upload.id))
    : uploadedUploads;

  if (selectedUploads.length === 0) {
    throw new JobRunnerError("No completed uploads are available for the paid generation job.", 409);
  }

  const integrations = getIntegrationStatus();

  if (!integrations.rendererConfigured || !integrations.gcsConfigured) {
    throw new JobRunnerError("A configured renderer and GCS storage are required before paid order processing can run.", 503);
  }

  const deliveryMode = summary?.order.deliveryMode === "print" ? "print" : "pdf";
  const designCount = summary?.order.designCount ?? 30;
  const quantity = summary?.order.quantity ?? 1;
  const plan = buildGenerationPlan({
    coverCount: quantity,
    deliveryMode,
    designCount,
    jobKind: "full_book",
    orderId: input.orderId,
    sourceUploadIds: selectedUploads.map((upload) => upload.id),
  });
  const renderSettings = getPipelineRenderSettings(deliveryMode, "full_book");

  if (!isDatabaseConfigured()) {
    throw new JobRunnerError("DATABASE_URL must be configured before paid order processing can run.", 503);
  }

  await setOrderStatus(input.orderId, "preprocessing", "generation.full_book_requested", {
    deliveryMode,
    model: renderSettings.model,
    targetPages: plan.targetPages,
    uploadCount: selectedUploads.length,
  });

  const assets = await createAssetRecords([
    ...plan.pages.flatMap((page) => [
      {
        orderId: input.orderId,
        kind: "generated_page" as const,
        objectPath: page.generatedImagePath,
        mimeType: "image/png",
        pageNumber: page.pageNumber,
      },
      {
        orderId: input.orderId,
        kind: "preview" as const,
        objectPath: page.previewImagePath,
        mimeType: "image/jpeg",
        pageNumber: page.pageNumber,
      },
    ]),
    {
      orderId: input.orderId,
      kind: "interior_pdf" as const,
      objectPath: plan.pdf.interiorPdfPath,
      mimeType: "application/pdf",
    },
    {
      orderId: input.orderId,
      kind: "download_pdf" as const,
      objectPath: plan.pdf.downloadPdfPath,
      mimeType: "application/pdf",
    },
    ...(plan.pdf.coverPdfPaths.length > 0
      ? plan.pdf.coverPdfPaths.map((objectPath) => ({
          orderId: input.orderId,
          kind: "cover_pdf" as const,
          objectPath,
          mimeType: "application/pdf",
        }))
      : []),
  ]);

  const generatedAssetByPath = new Map(
    assets.filter((asset) => asset.kind === "generated_page").map((asset) => [asset.objectPath, asset.id]),
  );

  const job = await createGenerationJobRecord({
    cleanupVersion: pipelineCleanupVersion,
    fallbackModel: renderSettings.fallbackModel,
    fallbackProvider: renderSettings.fallbackProvider,
    orderId: input.orderId,
    kind: "full_book",
    promptVersion: pipelinePromptVersion,
    provider: renderSettings.provider,
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

  await setOrderStatus(input.orderId, "generating", "generation.full_book_started", {
    deliveryMode,
    model: renderSettings.model,
    targetPages: plan.targetPages,
  });
  await setGenerationJobStatus(job.id, "running", "generation.full_book_running", {
    cleanupVersion: pipelineCleanupVersion,
    deliveryMode,
    fallbackModel: renderSettings.fallbackModel,
    fallbackProvider: renderSettings.fallbackProvider,
    model: renderSettings.model,
    promptVersion: pipelinePromptVersion,
    provider: renderSettings.provider,
    targetPages: plan.targetPages,
  });

  try {
    const materialized = await materializeGenerationPlan({
      childFirstName: summary?.order.childFirstName ?? null,
      copyNames: summary?.order.copyNames ?? null,
      coverStyle: summary?.order.coverStyle ?? "storybook",
      dedicationText: summary?.order.dedicationText ?? null,
      plan,
      quantity,
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

    await setOrderStatus(input.orderId, "qa_review", "generation.full_book_materialized", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

    const pageResultByNumber = new Map(materialized.pageResults.map((page) => [page.pageNumber, page]));

    for (const page of seededPages) {
      const pageResult = pageResultByNumber.get(page.pageNumber);

      await setGenerationPageStatus(page.id, "approved", "generation.full_book_page_approved", {
        pageNumber: page.pageNumber,
        ...(pageResult
          ? {
              cleanupVersion: pageResult.cleanupVersion,
              model: pageResult.model,
              promptVersion: pageResult.promptVersion,
              provider: pageResult.provider,
              qaFlags: pageResult.qaFlags,
              qaMetrics: pageResult.qaMetrics,
              qaScore: pageResult.qaScore,
              renderAttempts: pageResult.renderAttempts,
              costCents: estimateGeminiPageCostCents(deliveryMode, pageResult.renderAttempts),
            }
          : {}),
      });
    }

    await setOrderStatus(input.orderId, "assembling_pdf", "generation.pdf_assembly_completed", {
      model: materialized.model,
      pdfAssetCount: materialized.assets.filter((asset) => asset.contentType === "application/pdf").length,
    });

    await setGenerationJobStatus(job.id, "completed", "generation.full_book_completed", {
      acceptedPageCount: materialized.pageResults.length,
      assetCount: materialized.assets.length,
      averageQaScore:
        materialized.pageResults.length > 0
          ? Number((materialized.pageResults.reduce((sum, page) => sum + page.qaScore, 0) / materialized.pageResults.length).toFixed(1))
          : null,
      cleanupVersion: materialized.pageResults[0]?.cleanupVersion ?? null,
      flaggedPages: materialized.pageResults
        .filter((page) => page.qaFlags.length > 0)
        .map((page) => ({
          pageNumber: page.pageNumber,
          qaFlags: page.qaFlags,
        })),
      model: materialized.model,
      promptVersion: materialized.pageResults[0]?.promptVersion ?? null,
      provider: materialized.provider,
    });

    let finalStatus: "awaiting_print_submission" | "pdf_ready" | "submitted_to_lulu" =
      deliveryMode === "print" ? "awaiting_print_submission" : "pdf_ready";

    await setOrderStatus(input.orderId, finalStatus, deliveryMode === "print" ? "print.assets_ready" : "pdf.ready", {
      deliveryMode,
      model: materialized.model,
      previewCount: plan.targetPages,
    });

    if (deliveryMode !== "print" && options.sendLifecycleEmail) {
      try {
        await options.sendLifecycleEmail({
          orderId: input.orderId,
          template: "pdf-ready",
        });
      } catch (error) {
        console.error("process-paid-order: pdf-ready email failed (non-fatal)", error);
      }
    }

    if (deliveryMode === "print" && plan.pdf.coverPdfPaths.length > 0 && options.submitPrintOrder) {
      const [interiorSigned, ...coverSignedUrls] = await Promise.all([
        createSignedDownloadUrl({
          bucket: "exports",
          objectPath: plan.pdf.interiorPdfPath,
          expiresInMinutes: 180,
        }),
        ...plan.pdf.coverPdfPaths.map((objectPath) =>
          createSignedDownloadUrl({
            bucket: "exports",
            objectPath,
            expiresInMinutes: 180,
          }),
        ),
      ]);

      try {
        const luluSubmission = await options.submitPrintOrder({
          orderId: input.orderId,
          lineItems: coverSignedUrls.map((coverSigned, index) => {
            const copyName = summary?.order.copyNames?.[index] ?? summary?.order.childFirstName ?? null;
            const title = copyName ? `${copyName}'s memory coloring book` : "littlecolorbook.com memory coloring book";

            return {
              coverUrl: coverSigned.url,
              interiorUrl: interiorSigned.url,
              quantity: 1,
              title,
            };
          }),
        });

        if (luluSubmission?.status === "submitted_to_lulu") {
          finalStatus = "submitted_to_lulu";
        }
      } catch (error) {
        console.error("Failed to auto-submit print order to Lulu", error);
      }
    }

    return {
      accepted: true,
      databaseConfigured: true,
      finalStatus,
      generationJobId: job.id,
      job: "process-paid-order" as const,
      materialized: true,
      model: materialized.model,
      plan,
      provider: materialized.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown paid-order generation failure";

    await setGenerationJobStatus(job.id, "failed", "generation.full_book_failed", {
      cleanupVersion: pipelineCleanupVersion,
      failedPageCount: 1,
      fallbackModel: renderSettings.fallbackModel,
      fallbackProvider: renderSettings.fallbackProvider,
      message,
      model: renderSettings.model,
      promptVersion: pipelinePromptVersion,
      provider: renderSettings.provider,
    });
    await setOrderStatus(input.orderId, "failed", "generation.full_book_failed", {
      message,
      model: renderSettings.model,
    });

    throw new JobRunnerError(message, 500);
  }
}
