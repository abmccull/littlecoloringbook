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
import { uploadObject } from "@littlecolorbook/shared/storage";
import { JobRunnerError } from "./errors";

type SampleEmailTemplate = "pdf-ready";

type ProcessSampleJobInput = {
  orderId: string;
  uploadIds?: string[];
};

type ProcessSampleJobOptions = {
  sendLifecycleEmail?: (input: { orderId: string; template: SampleEmailTemplate }) => Promise<unknown>;
};

export async function runProcessSampleJob(input: ProcessSampleJobInput, options: ProcessSampleJobOptions = {}) {
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
    throw new JobRunnerError("No completed uploads are available for the sample job.", 409);
  }

  const integrations = getIntegrationStatus();

  if (!integrations.rendererConfigured || !integrations.gcsConfigured) {
    throw new JobRunnerError("A configured renderer and GCS storage are required before sample processing can run.", 503);
  }

  const plan = buildGenerationPlan({
    deliveryMode: "pdf",
    designCount: 1,
    jobKind: "sample",
    orderId: input.orderId,
    sourceUploadIds: selectedUploads.map((upload) => upload.id),
  });
  const renderSettings = getPipelineRenderSettings("pdf", "sample");

  if (!isDatabaseConfigured()) {
    throw new JobRunnerError("DATABASE_URL must be configured before sample processing can run.", 503);
  }

  await setOrderStatus(input.orderId, "generating", "generation.sample_started", {
    model: renderSettings.model,
    targetPages: plan.targetPages,
    uploadCount: selectedUploads.length,
  });

  const assets = await createAssetRecords(
    plan.pages.flatMap((page) => [
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
  );

  const generatedAssetByPath = new Map(
    assets.filter((asset) => asset.kind === "generated_page").map((asset) => [asset.objectPath, asset.id]),
  );

  const job = await createGenerationJobRecord({
    cleanupVersion: pipelineCleanupVersion,
    fallbackModel: renderSettings.fallbackModel,
    fallbackProvider: renderSettings.fallbackProvider,
    orderId: input.orderId,
    kind: "sample",
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

  await setGenerationJobStatus(job.id, "running", "generation.sample_running", {
    cleanupVersion: pipelineCleanupVersion,
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

    await setOrderStatus(input.orderId, "qa_review", "generation.sample_materialized", {
      assetCount: materialized.assets.length,
      model: materialized.model,
      provider: materialized.provider,
    });

    const pageResultByNumber = new Map(materialized.pageResults.map((page) => [page.pageNumber, page]));

    for (const page of seededPages) {
      const pageResult = pageResultByNumber.get(page.pageNumber);

      const sampleCostCents = Math.max(
        1,
        Math.round(Number(process.env.GEMINI_COST_CENTS_PER_IMAGE ?? "4") * Math.max(1, pageResult?.renderAttempts ?? 1)),
      );
      await setGenerationPageStatus(page.id, "approved", "generation.sample_page_approved", {
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
              costCents: sampleCostCents,
            }
          : {}),
      });
    }

    await setGenerationJobStatus(job.id, "completed", "generation.sample_completed", {
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

    await setOrderStatus(input.orderId, "pdf_ready", "sample.ready", {
      model: materialized.model,
      previewCount: plan.targetPages,
    });

    if (options.sendLifecycleEmail) {
      try {
        await options.sendLifecycleEmail({
          orderId: input.orderId,
          template: "pdf-ready",
        });
      } catch {
        // Email failure should not block sample delivery
      }
    }

    return {
      accepted: true,
      databaseConfigured: true,
      generationJobId: job.id,
      job: "process-sample" as const,
      materialized: true,
      model: materialized.model,
      plan,
      provider: materialized.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sample generation failure";

    await setGenerationJobStatus(job.id, "failed", "generation.sample_failed", {
      cleanupVersion: pipelineCleanupVersion,
      failedPageCount: 1,
      fallbackModel: renderSettings.fallbackModel,
      fallbackProvider: renderSettings.fallbackProvider,
      message,
      model: renderSettings.model,
      promptVersion: pipelinePromptVersion,
      provider: renderSettings.provider,
    });
    await setOrderStatus(input.orderId, "failed", "generation.sample_failed", {
      message,
      model: renderSettings.model,
    });

    throw new JobRunnerError(message, 500);
  }
}
