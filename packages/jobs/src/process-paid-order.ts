import {
  createAssetRecords,
  createGenerationJobRecord,
  getAssetsByIds,
  getGenerationPageById,
  getLatestGenerationJobForOrder,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
  listUploadsForOrder,
  listGenerationPagesForJob,
  recordSupportAction,
  seedGenerationPages,
  setGenerationJobStatus,
  setGenerationPageStatus,
  setOrderStatus,
  updateGenerationPageUpload,
} from "@littlecolorbook/db";
import {
  buildGenerationPlan,
  getPipelineRenderSettings,
  materializeBookPdfAssets,
  materializeGenerationPlan,
  materializeSingleGenerationPage,
  pipelineCleanupVersion,
  pipelinePromptVersion,
} from "@littlecolorbook/pipeline";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, downloadObject, uploadObject } from "@littlecolorbook/shared/storage";
import { JobRunnerError } from "./errors";

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

type PaidLifecycleTemplate = "pdf-ready" | "review-required";

type ProcessPaidOrderJobOptions = {
  submitPrintOrder?: (input: { lineItems: SubmitPrintLineItem[]; orderId: string }) => Promise<SubmitPrintOrderResult | null | undefined>;
  sendLifecycleEmail?: (input: { orderId: string; template: PaidLifecycleTemplate }) => Promise<unknown>;
};

function buildApprovedPageDetails(pageResult: {
  cleanupVersion: string;
  costBreakdown: unknown;
  costCents: number;
  imageSize: string;
  model: string;
  pageNumber: number;
  promptVersion: string;
  provider: string;
  qaFlags: string[];
  qaMetrics: Record<string, unknown>;
  qaScore: number;
  renderAttempts: number;
}) {
  return {
    cleanupVersion: pageResult.cleanupVersion,
    costBreakdown: pageResult.costBreakdown,
    costCents: pageResult.costCents,
    imageSize: pageResult.imageSize,
    model: pageResult.model,
    pageNumber: pageResult.pageNumber,
    promptVersion: pageResult.promptVersion,
    provider: pageResult.provider,
    qaFlags: pageResult.qaFlags,
    qaMetrics: pageResult.qaMetrics,
    qaScore: pageResult.qaScore,
    renderAttempts: pageResult.renderAttempts,
  };
}

function buildFailedPageDetails(pageFailure: {
  cleanupVersion: string;
  costBreakdown: unknown;
  costCents: number;
  imageSize: string | null;
  message: string;
  model: string | null;
  pageNumber: number;
  promptVersion: string;
  provider: string | null;
  qaFlags: string[];
  qaMetrics: Record<string, unknown> | null;
  qaScore: number | null;
  renderAttempts: number;
  previewAvailable: boolean;
}) {
  return {
    cleanupVersion: pageFailure.cleanupVersion,
    costBreakdown: pageFailure.costBreakdown,
    costCents: pageFailure.costCents,
    imageSize: pageFailure.imageSize,
    message: pageFailure.message,
    model: pageFailure.model,
    pageNumber: pageFailure.pageNumber,
    promptVersion: pageFailure.promptVersion,
    provider: pageFailure.provider,
    qaFlags: pageFailure.qaFlags,
    qaMetrics: pageFailure.qaMetrics,
    qaScore: pageFailure.qaScore,
    renderAttempts: pageFailure.renderAttempts,
    previewAvailable: pageFailure.previewAvailable,
  };
}

async function finalizePaidOrderIfReady(
  orderId: string,
  options: Pick<ProcessPaidOrderJobOptions, "sendLifecycleEmail"> = {},
) {
  const summary = await getOrderPortalSummaryByOrderId(orderId);

  if (!summary) {
    throw new JobRunnerError("Order not found", 404);
  }

  const job = await getLatestGenerationJobForOrder(orderId, "full_book");

  if (!job) {
    throw new JobRunnerError("Generation job not found for finalization.", 404);
  }

  const pages = await listGenerationPagesForJob(job.id);
  const unresolvedPages = pages.filter((page) => page.status !== "approved");

  if (unresolvedPages.length > 0) {
    return {
      finalized: false,
      finalStatus: summary.order.status,
      remainingFailedPages: unresolvedPages.filter((page) => page.status === "failed").length,
    };
  }

  const deliveryMode = summary.order.deliveryMode === "print" ? "print" : "pdf";
  const sourceUploadIds = pages.map((page) => page.uploadId).filter((uploadId): uploadId is string => Boolean(uploadId));
  const plan = buildGenerationPlan({
    coverCount: summary.order.quantity,
    deliveryMode,
    designCount: summary.order.designCount,
    jobKind: "full_book",
    orderId,
    sourceUploadIds,
  });
  const pageAssets = await getAssetsByIds(pages.map((page) => page.assetId).filter((assetId): assetId is string => Boolean(assetId)));
  const pageAssetById = new Map(pageAssets.map((asset) => [asset.id, asset]));
  const pageBuffers = await Promise.all(
    pages.map(async (page) => {
      const asset = page.assetId ? pageAssetById.get(page.assetId) : null;

      if (!asset) {
        throw new JobRunnerError(`Missing generated page asset for page ${page.pageNumber}.`, 409);
      }

      return downloadObject({
        bucket: "exports",
        objectPath: asset.objectPath,
      });
    }),
  );

  const pdfAssets = await materializeBookPdfAssets({
    childFirstName: summary.order.childFirstName ?? null,
    copyNames: summary.order.copyNames ?? null,
    coverStyle: summary.order.coverStyle ?? "storybook",
    dedicationText: summary.order.dedicationText ?? null,
    occasion: (summary.order.occasion as never) ?? null,
    occasionContext: (summary.order.occasionContext as never) ?? null,
    plan,
    quantity: summary.order.quantity,
    pageBuffers,
  });

  await setOrderStatus(orderId, "assembling_pdf", "generation.pdf_assembly_completed", {
    model: job.model ?? null,
    pdfAssetCount: pdfAssets.filter((asset) => asset.contentType === "application/pdf").length,
  });

  for (const asset of pdfAssets) {
    await uploadObject({
      bucket: "exports",
      objectPath: asset.objectPath,
      body: asset.body,
      contentType: asset.contentType,
      cacheControl: "private, max-age=300",
    });
  }

  const finalStatus: "awaiting_print_submission" | "pdf_ready" = deliveryMode === "print" ? "awaiting_print_submission" : "pdf_ready";

  await setGenerationJobStatus(job.id, "completed", "generation.full_book_completed", {
    acceptedPageCount: pages.length,
    failedPageCount: 0,
    cleanupVersion: pages[0]?.cleanupVersion ?? pipelineCleanupVersion,
    flaggedPages: pages
      .filter((page) => Array.isArray(page.qaFlags) && page.qaFlags.length > 0)
      .map((page) => ({
        pageNumber: page.pageNumber,
        qaFlags: page.qaFlags ?? [],
      })),
    model: job.model,
    promptVersion: pages[0]?.promptVersion ?? pipelinePromptVersion,
    provider: job.provider,
  });

  await setOrderStatus(orderId, finalStatus, deliveryMode === "print" ? "print.assets_ready" : "pdf.ready", {
    deliveryMode,
    model: job.model ?? null,
    previewCount: plan.targetPages,
  });

  if (deliveryMode !== "print" && options.sendLifecycleEmail) {
    try {
      await options.sendLifecycleEmail({
        orderId,
        template: "pdf-ready",
      });
    } catch (error) {
      console.error("process-paid-order: pdf-ready email failed (non-fatal)", error);
    }
  }

  return {
    finalized: true,
    finalStatus,
    remainingFailedPages: 0,
  };
}

export async function approvePaidOrderGenerationPage(
  input: {
    orderId: string;
    generationPageId: string;
  },
  options: Pick<ProcessPaidOrderJobOptions, "sendLifecycleEmail"> = {},
) {
  const page = await getGenerationPageById(input.generationPageId);

  if (!page) {
    throw new JobRunnerError("Generation page not found.", 404);
  }

  if (!page.qaMetrics) {
    throw new JobRunnerError("This page does not have an approve-as-is preview. Replace the source photo instead.", 409);
  }

  await setGenerationPageStatus(page.id, "approved", "generation.full_book_page_approved_by_customer", {
    approvedBy: "customer",
    cleanupVersion: page.cleanupVersion ?? pipelineCleanupVersion,
    costCents: page.costCents ?? 0,
    model: page.model ?? null,
    pageNumber: page.pageNumber,
    promptVersion: page.promptVersion ?? pipelinePromptVersion,
    provider: page.provider ?? null,
    qaFlags: page.qaFlags ?? [],
    qaMetrics: page.qaMetrics ?? null,
    qaScore: page.qaScore ?? null,
    renderAttempts: page.renderAttempts,
  });

  const finalized = await finalizePaidOrderIfReady(input.orderId, options);

  if (!finalized.finalized) {
    await setOrderStatus(input.orderId, "support_required", "generation.customer_review_required", {
      remainingFailedPages: finalized.remainingFailedPages,
      triggeredBy: "customer_approval",
    });
  }

  return finalized;
}

export async function replacePaidOrderGenerationPage(
  input: {
    orderId: string;
    generationPageId: string;
    uploadId: string;
  },
  options: Pick<ProcessPaidOrderJobOptions, "sendLifecycleEmail"> = {},
) {
  const summary = await getOrderPortalSummaryByOrderId(input.orderId);

  if (!summary) {
    throw new JobRunnerError("Order not found", 404);
  }

  const page = await getGenerationPageById(input.generationPageId);

  if (!page) {
    throw new JobRunnerError("Generation page not found.", 404);
  }

  const job = await getLatestGenerationJobForOrder(input.orderId, "full_book");

  if (!job || job.id !== page.generationJobId) {
    throw new JobRunnerError("The selected page is no longer part of the active generation job.", 409);
  }

  const uploads = await listUploadsForOrder(input.orderId);
  const replacementUpload = uploads.find((upload) => upload.id === input.uploadId && upload.status === "uploaded");

  if (!replacementUpload) {
    throw new JobRunnerError("Replacement upload not found.", 404);
  }

  const pages = await listGenerationPagesForJob(job.id);
  const sourceUploadIds = pages
    .map((currentPage) => (currentPage.id === page.id ? input.uploadId : currentPage.uploadId))
    .filter((uploadId): uploadId is string => Boolean(uploadId));

  const deliveryMode = summary.order.deliveryMode === "print" ? "print" : "pdf";
  const plan = buildGenerationPlan({
    coverCount: summary.order.quantity,
    deliveryMode,
    designCount: summary.order.designCount,
    jobKind: "full_book",
    orderId: input.orderId,
    sourceUploadIds,
  });
  const plannedPage = plan.pages.find((planned) => planned.pageNumber === page.pageNumber);

  if (!plannedPage) {
    throw new JobRunnerError("Could not find the planned page for rerender.", 404);
  }

  await recordSupportAction({
    orderId: input.orderId,
    actionType: "replace_page",
    pageNumber: page.pageNumber,
    notes: `Customer replaced the source photo for page ${page.pageNumber}.`,
    createdBy: "customer",
    payload: {
      generationPageId: page.id,
      uploadId: input.uploadId,
    },
  });

  await updateGenerationPageUpload(page.id, input.uploadId, {
    uploadFileName: replacementUpload.fileName,
    triggeredBy: "customer",
  });
  await setOrderStatus(input.orderId, "generating", "generation.page_rerender_started", {
    pageNumber: page.pageNumber,
    replacementUploadId: input.uploadId,
    uploadFileName: replacementUpload.fileName,
    triggeredBy: "customer",
  });

  const outcome = await materializeSingleGenerationPage({
    childFirstName: summary.order.childFirstName ?? null,
    deliveryMode,
    jobKind: "full_book",
    page: plannedPage,
    upload: {
      id: replacementUpload.id,
      contentType: replacementUpload.contentType,
      fileName: replacementUpload.fileName,
      objectPath: replacementUpload.objectPath,
    },
  });

  for (const asset of outcome.assets) {
    await uploadObject({
      bucket: "exports",
      objectPath: asset.objectPath,
      body: asset.body,
      contentType: asset.contentType,
      cacheControl: "private, max-age=300",
    });
  }

  if (outcome.pageResult) {
    await setGenerationPageStatus(page.id, "approved", "generation.full_book_page_approved", {
      ...buildApprovedPageDetails(outcome.pageResult),
      triggeredBy: "customer_replacement",
      uploadFileName: replacementUpload.fileName,
    });
  } else if (outcome.pageFailure) {
    await setGenerationPageStatus(page.id, "failed", "generation.full_book_page_failed", {
      ...buildFailedPageDetails(outcome.pageFailure),
      triggeredBy: "customer_replacement",
      uploadFileName: replacementUpload.fileName,
    });
  }

  const finalized = await finalizePaidOrderIfReady(input.orderId, options);

  if (!finalized.finalized) {
    await setGenerationJobStatus(job.id, "failed", "generation.full_book_partial_review_required", {
      acceptedPageCount: pages.filter((currentPage) => currentPage.id !== page.id && currentPage.status === "approved").length + (outcome.pageResult ? 1 : 0),
      failedPageCount: finalized.remainingFailedPages,
      model: outcome.model ?? job.model,
      provider: outcome.provider ?? job.provider,
    });
    await setOrderStatus(input.orderId, "support_required", "generation.customer_review_required", {
      remainingFailedPages: finalized.remainingFailedPages,
      pageNumber: page.pageNumber,
    });
  }

  return finalized;
}

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
      allowPageFailures: true,
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

    const pageResultByNumber = new Map(materialized.pageResults.map((page) => [page.pageNumber, page]));
    const pageFailureByNumber = new Map(materialized.pageFailures.map((page) => [page.pageNumber, page]));

    for (const page of seededPages) {
      const pageResult = pageResultByNumber.get(page.pageNumber);

      if (pageResult) {
        await setGenerationPageStatus(page.id, "approved", "generation.full_book_page_approved", buildApprovedPageDetails(pageResult));
        continue;
      }

      const pageFailure = pageFailureByNumber.get(page.pageNumber);

      if (pageFailure) {
        await setGenerationPageStatus(page.id, "failed", "generation.full_book_page_failed", buildFailedPageDetails(pageFailure));
      }
    }

    if (materialized.pageFailures.length > 0) {
      await setGenerationJobStatus(job.id, "failed", "generation.full_book_partial_review_required", {
        acceptedPageCount: materialized.pageResults.length,
        failedPageCount: materialized.pageFailures.length,
        cleanupVersion: materialized.pageResults[0]?.cleanupVersion ?? pipelineCleanupVersion,
        flaggedPages: materialized.pageFailures.map((page) => ({
          pageNumber: page.pageNumber,
          qaFlags: page.qaFlags,
          message: page.message,
          previewAvailable: page.previewAvailable,
        })),
        model: materialized.model,
        promptVersion: materialized.pageResults[0]?.promptVersion ?? pipelinePromptVersion,
        provider: materialized.provider,
      });

      await setOrderStatus(input.orderId, "support_required", "generation.customer_review_required", {
        approvedPageCount: materialized.pageResults.length,
        failedPageCount: materialized.pageFailures.length,
        failedPages: materialized.pageFailures.map((page) => ({
          pageNumber: page.pageNumber,
          message: page.message,
          qaFlags: page.qaFlags,
          previewAvailable: page.previewAvailable,
        })),
      });

      if (options.sendLifecycleEmail) {
        try {
          await options.sendLifecycleEmail({
            orderId: input.orderId,
            template: "review-required",
          });
        } catch (error) {
          console.error("process-paid-order: review-required email failed (non-fatal)", error);
        }
      }

      return {
        accepted: true,
        databaseConfigured: true,
        finalStatus: "support_required" as const,
        generationJobId: job.id,
        job: "process-paid-order" as const,
        materialized: true,
        model: materialized.model,
        partialReviewRequired: true,
        plan,
        provider: materialized.provider,
      };
    }

    await setOrderStatus(input.orderId, "qa_review", "generation.full_book_materialized", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

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
