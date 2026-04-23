import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdminOrderDetail,
  getDatabase,
  getLatestGenerationJobForOrder,
  listGenerationPagesForJob,
  listUploadsForOrder,
  orderEvents,
} from "@littlecolorbook/db";
import { buildColoringPromptMinimal, getPipelineRenderSettings } from "@littlecolorbook/pipeline";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl, objectExists } from "@littlecolorbook/shared/storage";
import { and, desc, eq } from "drizzle-orm";
import { requireAdminSession } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_TIME_ZONE = "America/Denver";

function formatDate(value: Date | string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ADMIN_TIME_ZONE,
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatMoney(cents: number | null | undefined) {
  if (typeof cents !== "number") return "n/a";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getFailureKind(message: string | null, hasQaMetrics: boolean) {
  if (!message) {
    return hasQaMetrics ? "qa_rejected" : "unknown";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("quota exceeded") || normalized.includes("generate_requests_per_model")) {
    return "provider_quota";
  }

  if (normalized.includes("high demand")) {
    return "provider_capacity";
  }

  if (normalized.includes("failed qa")) {
    return "qa_rejected";
  }

  return "renderer_error";
}

function getFailureLabel(kind: string) {
  switch (kind) {
    case "provider_quota":
      return "Provider quota";
    case "provider_capacity":
      return "Provider capacity";
    case "qa_rejected":
      return "QA rejected";
    case "renderer_error":
      return "Renderer error";
    default:
      return "Unknown";
  }
}

async function signObjectIfExists(bucket: "uploads" | "exports", objectPath: string | null) {
  if (!objectPath || !getIntegrationStatus().gcsConfigured) {
    return { exists: false, url: null as string | null };
  }

  const exists = await objectExists({ bucket, objectPath }).catch(() => false);

  if (!exists) {
    return { exists: false, url: null as string | null };
  }

  const signed = await createSignedDownloadUrl({
    bucket,
    objectPath,
    expiresInMinutes: 30,
  });

  return { exists: true, url: signed.url };
}

type PageFailureEvent = {
  message: string | null;
  createdAt: Date;
  previewAvailable: boolean;
  rawDetails: Record<string, unknown> | null;
};

export default async function AdminGenerationDebugPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireAdminSession();
  const { orderId } = await params;

  const [orderDetail, job] = await Promise.all([
    getAdminOrderDetail(orderId),
    getLatestGenerationJobForOrder(orderId, "full_book"),
  ]);

  if (!orderDetail || !job) {
    notFound();
  }

  const [pages, uploads, rawEvents] = await Promise.all([
    listGenerationPagesForJob(job.id),
    listUploadsForOrder(orderId),
    getDatabase().query.orderEvents.findMany({
      where: and(eq(orderEvents.orderId, orderId), eq(orderEvents.eventType, "generation.full_book_page_failed")),
      orderBy: [desc(orderEvents.createdAt)],
    }),
  ]);

  const uploadById = new Map(uploads.map((upload) => [upload.id, upload]));
  const failureEventByPageKey = new Map<string, PageFailureEvent>();

  for (const event of rawEvents) {
    const generationJobId = typeof event.details?.generationJobId === "string" ? event.details.generationJobId : null;
    const generationPageId = typeof event.details?.generationPageId === "string" ? event.details.generationPageId : null;
    const pageNumber = typeof event.details?.pageNumber === "number" ? event.details.pageNumber : null;

    if (generationJobId !== job.id) {
      continue;
    }

    const key = generationPageId ?? (pageNumber !== null ? `page-${pageNumber}` : null);

    if (!key || failureEventByPageKey.has(key)) {
      continue;
    }

    failureEventByPageKey.set(key, {
      message: typeof event.details?.message === "string" ? event.details.message : null,
      createdAt: event.createdAt,
      previewAvailable: event.details?.previewAvailable === true,
      rawDetails: event.details ?? null,
    });
  }

  const resolvedRenderSettings = getPipelineRenderSettings(orderDetail.order.deliveryMode === "print" ? "print" : "pdf", "full_book");
  const promptText = buildColoringPromptMinimal();
  const offer = getOfferByCode(orderDetail.order.selectedOfferCode);

  const pageDebugRows = await Promise.all(
    pages.map(async (page) => {
      const upload = page.uploadId ? uploadById.get(page.uploadId) ?? null : null;
      const previewPath = `orders/${orderId}/pages/${page.pageNumber}/preview.jpg`;
      const generatedPath = `orders/${orderId}/pages/${page.pageNumber}/generated.png`;
      const failureEvent =
        failureEventByPageKey.get(page.id) ??
        failureEventByPageKey.get(`page-${page.pageNumber}`) ??
        null;
      const [sourceAsset, previewAsset, generatedAsset] = await Promise.all([
        signObjectIfExists("uploads", upload?.objectPath ?? null),
        signObjectIfExists("exports", previewPath),
        signObjectIfExists("exports", generatedPath),
      ]);
      const failureKind = getFailureKind(failureEvent?.message ?? null, Boolean(page.qaMetrics));

      return {
        id: page.id,
        pageNumber: page.pageNumber,
        status: page.status,
        uploadFileName: upload?.fileName ?? null,
        uploadObjectPath: upload?.objectPath ?? null,
        sourceUrl: sourceAsset.url,
        sourceExists: sourceAsset.exists,
        previewUrl: previewAsset.url,
        previewExists: previewAsset.exists,
        generatedUrl: generatedAsset.url,
        generatedExists: generatedAsset.exists,
        model: page.model,
        promptVersion: page.promptVersion,
        cleanupVersion: page.cleanupVersion,
        renderAttempts: page.renderAttempts,
        costCents: page.costCents,
        qaScore: page.qaScore,
        qaFlags: page.qaFlags ?? [],
        qaMetrics: page.qaMetrics,
        failureMessage: failureEvent?.message ?? null,
        failureKind,
        failureLabel: getFailureLabel(failureKind),
        failureAt: failureEvent?.createdAt ?? null,
        failureRawDetails: failureEvent?.rawDetails ?? null,
      };
    }),
  );

  const failedPages = pageDebugRows.filter((page) => page.status === "failed");
  const approvedPages = pageDebugRows.filter((page) => page.status === "approved");
  const providerQuotaFailures = failedPages.filter((page) => page.failureKind === "provider_quota").length;
  const providerCapacityFailures = failedPages.filter((page) => page.failureKind === "provider_capacity").length;
  const qaRejectedFailures = failedPages.filter((page) => page.failureKind === "qa_rejected").length;
  const rendererFailures = failedPages.filter((page) => page.failureKind === "renderer_error").length;

  return (
    <main className="admin-generation-debug-page">
      <header className="topbar topbar-flow">
        <Link className="topbar-link" href={`/admin?orderId=${orderId}`}>
          Back to admin queue
        </Link>
        <Link className="topbar-link" href="/admin">
          Admin home
        </Link>
      </header>

      <section className="surface admin-generation-debug-hero">
        <div className="section-copy">
          <span className="pill">Generation debug</span>
          <h1>{offer.title}</h1>
          <p className="lede">
            Latest full-book generation for order <code>{orderId}</code>. This view shows the source photo, output
            artifacts, and exact failure mode page by page.
          </p>
        </div>

        <div className="admin-generation-debug-stats">
          <div className="admin-generation-debug-stat">
            <span className="mini-note">Order status</span>
            <strong>{formatStatus(orderDetail.order.status)}</strong>
          </div>
          <div className="admin-generation-debug-stat">
            <span className="mini-note">Job</span>
            <strong>{job.id}</strong>
          </div>
          <div className="admin-generation-debug-stat">
            <span className="mini-note">Model</span>
            <strong>{job.model ?? "Unknown"}</strong>
          </div>
          <div className="admin-generation-debug-stat">
            <span className="mini-note">Prompt</span>
            <strong>{job.promptVersion ?? "Unknown"}</strong>
          </div>
          <div className="admin-generation-debug-stat">
            <span className="mini-note">Approved</span>
            <strong>{approvedPages.length}</strong>
          </div>
          <div className="admin-generation-debug-stat">
            <span className="mini-note">Failed</span>
            <strong>{failedPages.length}</strong>
          </div>
        </div>

        <div className="admin-generation-debug-summary-grid">
          <div className="surface admin-generation-debug-summary-card">
            <span className="mini-note">Resolved render settings</span>
            <strong>{resolvedRenderSettings.model}</strong>
            <p className="muted">
              {orderDetail.order.deliveryMode} / image size {resolvedRenderSettings.imageSize} / provider{" "}
              {resolvedRenderSettings.provider}
            </p>
          </div>
          <div className="surface admin-generation-debug-summary-card">
            <span className="mini-note">Failure buckets</span>
            <strong>{providerCapacityFailures + providerQuotaFailures} provider-side</strong>
            <p className="muted">
              {providerCapacityFailures} capacity / {providerQuotaFailures} quota / {qaRejectedFailures} QA / {rendererFailures} renderer
            </p>
          </div>
          <div className="surface admin-generation-debug-summary-card">
            <span className="mini-note">Latest run</span>
            <strong>{formatDate(job.createdAt)}</strong>
            <p className="muted">Updated {formatDate(job.updatedAt)}</p>
          </div>
        </div>
      </section>

      <section className="surface admin-generation-debug-prompt">
        <div className="section-copy">
          <span className="pill">Prompt in use</span>
          <h2>{job.promptVersion ?? "Unknown prompt version"}</h2>
        </div>
        <pre>{promptText}</pre>
      </section>

      <section className="admin-generation-debug-grid">
        {failedPages.length > 0 ? (
          failedPages.map((page) => (
            <article className="surface admin-generation-debug-card" key={page.id}>
              <div className="admin-generation-debug-card-head">
                <div>
                  <span className="pill pill-coral">Page {page.pageNumber}</span>
                  <h3>{page.uploadFileName ?? "Original photo"}</h3>
                </div>
                <div className="admin-generation-debug-card-status">
                  <span className={`status-pill status-pill-${page.status}`}>{formatStatus(page.status)}</span>
                  <span className="mini-note">{page.failureLabel}</span>
                </div>
              </div>

              <div className="admin-generation-debug-images">
                <div className="admin-generation-debug-image-panel">
                  <span className="mini-note">Source photo</span>
                  {page.sourceUrl ? (
                    <img alt={`Source photo for page ${page.pageNumber}`} className="admin-generation-debug-image" src={page.sourceUrl} />
                  ) : (
                    <div className="admin-generation-debug-image-empty">Source image missing from storage.</div>
                  )}
                </div>
                <div className="admin-generation-debug-image-panel">
                  <span className="mini-note">Preview jpg</span>
                  {page.previewUrl ? (
                    <img alt={`Preview output for page ${page.pageNumber}`} className="admin-generation-debug-image" src={page.previewUrl} />
                  ) : (
                    <div className="admin-generation-debug-image-empty">No preview artifact was produced.</div>
                  )}
                </div>
                <div className="admin-generation-debug-image-panel">
                  <span className="mini-note">Generated png</span>
                  {page.generatedUrl ? (
                    <img alt={`Generated output for page ${page.pageNumber}`} className="admin-generation-debug-image" src={page.generatedUrl} />
                  ) : (
                    <div className="admin-generation-debug-image-empty">No generated artifact was produced.</div>
                  )}
                </div>
              </div>

              <div className="admin-generation-debug-facts">
                <div>
                  <span className="mini-note">Model</span>
                  <strong>{page.model ?? "No render returned"}</strong>
                </div>
                <div>
                  <span className="mini-note">Attempts</span>
                  <strong>{page.renderAttempts}</strong>
                </div>
                <div>
                  <span className="mini-note">Cost</span>
                  <strong>{formatMoney(page.costCents)}</strong>
                </div>
                <div>
                  <span className="mini-note">QA score</span>
                  <strong>{page.qaScore ?? "n/a"}</strong>
                </div>
              </div>

              <div className="admin-generation-debug-message">
                <span className="mini-note">Failure message</span>
                <p>{page.failureMessage ?? "No failure message was recorded."}</p>
              </div>

              <div className="admin-generation-debug-badges">
                {(page.qaFlags.length > 0 ? page.qaFlags : ["no_qa_flags"]).map((flag) => (
                  <span className="pill pill-sun" key={`${page.id}-${flag}`}>
                    {flag}
                  </span>
                ))}
              </div>

              <details className="admin-generation-debug-details">
                <summary>Raw details</summary>
                <div className="admin-generation-debug-details-grid">
                  <div>
                    <span className="mini-note">QA metrics</span>
                    <pre>{formatJson(page.qaMetrics ?? null)}</pre>
                  </div>
                  <div>
                    <span className="mini-note">Failure event payload</span>
                    <pre>{formatJson(page.failureRawDetails)}</pre>
                  </div>
                  <div>
                    <span className="mini-note">Storage paths</span>
                    <pre>
                      {formatJson({
                        generatedExists: page.generatedExists,
                        generatedPath: `orders/${orderId}/pages/${page.pageNumber}/generated.png`,
                        previewExists: page.previewExists,
                        previewPath: `orders/${orderId}/pages/${page.pageNumber}/preview.jpg`,
                        sourceExists: page.sourceExists,
                        sourcePath: page.uploadObjectPath,
                      })}
                    </pre>
                  </div>
                </div>
              </details>
            </article>
          ))
        ) : (
          <div className="surface admin-generation-debug-empty">
            <span className="pill pill-sky">No failed pages</span>
            <h2>This run does not have any failed pages to inspect.</h2>
            <p className="muted">Use the approved-pages section below to spot-check the latest successful output.</p>
          </div>
        )}
      </section>

      <section className="surface admin-generation-debug-approved">
        <div className="section-copy">
          <span className="pill pill-sky">Approved pages</span>
          <h2>{approvedPages.length} pages passed</h2>
          <p className="muted">These are the pages from the latest run that already cleared generation and QA.</p>
        </div>

        <div className="admin-generation-debug-approved-grid">
          {approvedPages.map((page) => (
            <div className="admin-generation-debug-approved-card" key={page.id}>
              <strong>Page {page.pageNumber}</strong>
              {page.previewUrl ? (
                <img alt={`Approved preview for page ${page.pageNumber}`} className="admin-generation-debug-approved-image" src={page.previewUrl} />
              ) : (
                <div className="admin-generation-debug-image-empty">Preview missing.</div>
              )}
              <span className="mini-note">{page.uploadFileName ?? "Original photo"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
