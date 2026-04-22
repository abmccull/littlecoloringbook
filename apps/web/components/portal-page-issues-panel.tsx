"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UploadDropzone } from "./upload-dropzone";

type PageIssue = {
  id: string;
  pageNumber: number;
  uploadId: string | null;
  uploadFileName: string | null;
  qaFlags: string[];
  canApprove: boolean;
  previewObjectPath: string | null;
};

type PortalPageIssuesPanelProps = {
  orderId: string;
  portalToken: string;
  pageIssues: PageIssue[];
};

function getIssueCopy(issue: PageIssue) {
  if (issue.qaFlags.includes("oversaturated_black")) {
    return "The line work came out too dark and would feel muddy on the coloring page.";
  }

  if (issue.qaFlags.includes("largest_dark_component")) {
    return "One dark area took over too much of the page, so it would not color cleanly.";
  }

  if (issue.qaFlags.includes("noisy_background") || issue.qaFlags.includes("speckle_noise")) {
    return "The background turned into too much visual noise for a clean coloring page.";
  }

  if (issue.qaFlags.includes("provider_noise")) {
    return "The renderer kept too much texture and clutter in the final line art.";
  }

  return "This photo did not turn into a clean enough coloring page on the first pass.";
}

async function readPayload(response: Response) {
  const raw = await response.text();

  if (!raw) {
    return {} as { error?: string };
  }

  return JSON.parse(raw) as { error?: string };
}

export function PortalPageIssuesPanel({ orderId, portalToken, pageIssues }: PortalPageIssuesPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyPageId, setBusyPageId] = useState<string | null>(null);
  const [feedbackByPageId, setFeedbackByPageId] = useState<Record<string, string>>({});

  async function approvePage(pageId: string) {
    setBusyPageId(pageId);
    setFeedbackByPageId((current) => ({ ...current, [pageId]: "Approving this page..." }));

    try {
      const response = await fetch(`/api/orders/portal/${portalToken}/pages/${pageId}/approve`, {
        method: "POST",
      });
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "We could not approve that page yet.");
      }

      setFeedbackByPageId((current) => ({
        ...current,
        [pageId]: "Approved. We are checking whether your PDF can be finalized now.",
      }));
      router.refresh();
    } catch (error) {
      setFeedbackByPageId((current) => ({
        ...current,
        [pageId]: error instanceof Error ? error.message : "We could not approve that page yet.",
      }));
    } finally {
      setBusyPageId(null);
    }
  }

  async function replacePage(pageId: string, uploadId: string | null) {
    if (!uploadId) {
      setFeedbackByPageId((current) => ({
        ...current,
        [pageId]: "The replacement photo uploaded, but we could not attach it to that page yet.",
      }));
      return;
    }

    setBusyPageId(pageId);
    setFeedbackByPageId((current) => ({ ...current, [pageId]: "Replacing this photo and redrawing the page..." }));

    try {
      const response = await fetch(`/api/orders/portal/${portalToken}/pages/${pageId}/replace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uploadId }),
      });
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "We could not redraw that page yet.");
      }

      setFeedbackByPageId((current) => ({
        ...current,
        [pageId]: "Replacement received. We are checking whether your PDF can be finalized now.",
      }));
      router.refresh();
    } catch (error) {
      setFeedbackByPageId((current) => ({
        ...current,
        [pageId]: error instanceof Error ? error.message : "We could not redraw that page yet.",
      }));
    } finally {
      setBusyPageId(null);
    }
  }

  return (
    <section className="section">
      <div className="section-copy">
        <span className="pill pill-coral">Needs your choice</span>
        <h2>We caught a few pages before delivery.</h2>
        <p className="lede">
          The rest of the book kept rendering. Choose whether to keep the flagged page as-is or swap in a different
          photo for that slot.
        </p>
      </div>
      <div className="detail-grid">
        {pageIssues.map((issue) => (
          <article className="surface detail-card page-issue-card" key={issue.id}>
            <div className="stack-tight">
              <span className="pill pill-sun">Page {issue.pageNumber}</span>
              <strong>{issue.uploadFileName ?? "Original photo"}</strong>
              <p className="muted">{getIssueCopy(issue)}</p>
            </div>

            <div className="page-issue-compare">
              {issue.uploadId ? (
                <div className="stack-tight">
                  <span className="mini-note">Original photo</span>
                  <img
                    alt={`Original photo for page ${issue.pageNumber}`}
                    className="page-issue-preview"
                    src={`/api/orders/portal/${portalToken}/uploads/${issue.uploadId}`}
                  />
                </div>
              ) : null}

              {issue.previewObjectPath && issue.canApprove ? (
                <div className="stack-tight">
                  <span className="mini-note">Flagged coloring page</span>
                  <img
                    alt={`Preview of flagged page ${issue.pageNumber}`}
                    className="page-issue-preview"
                    src={`/api/orders/portal/${portalToken}/preview?pageNumber=${issue.pageNumber}`}
                  />
                </div>
              ) : null}
            </div>

            {issue.canApprove ? (
              <button
                className="button button-secondary"
                disabled={isPending || busyPageId === issue.id}
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await approvePage(issue.id);
                  });
                }}
              >
                {busyPageId === issue.id ? "Working..." : "Keep This Page As-Is"}
              </button>
            ) : null}

            <UploadDropzone
              title={`Replace page ${issue.pageNumber}`}
              hint="Upload one new photo and we will redraw only this page."
              entityType="order"
              entityId={orderId}
              portalToken={portalToken}
              buttonLabel="Upload Replacement Photo"
              onUploadComplete={(upload) => {
                startTransition(async () => {
                  await replacePage(issue.id, upload.uploadId);
                });
              }}
            />

            {feedbackByPageId[issue.id] ? (
              <div className="status-banner status-banner-progress">
                <div className="stack-tight">
                  <strong>Page {issue.pageNumber}</strong>
                  <p>{feedbackByPageId[issue.id]}</p>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
