"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useState } from "react";
import { SampleProcessingPanel } from "./sample-processing-panel";
import { UploadDropzone } from "./upload-dropzone";

type SampleUploadFlowProps = {
  orderId: string;
  readyHref: string;
  status: string;
  serverUploadCount: number;
  initialUploads: Array<{
    id: string;
    fileName: string;
    status: "uploaded" | "failed";
  }>;
};

export function SampleUploadFlow({ orderId, readyHref, status, serverUploadCount, initialUploads }: SampleUploadFlowProps) {
  const router = useRouter();
  const [clientUploadCount, setClientUploadCount] = useState(serverUploadCount);

  const effectiveUploadCount = Math.max(serverUploadCount, clientUploadCount);

  const handleUploadStatsChange = useCallback(
    (stats: { total: number; uploaded: number; failed: number; isUploading: boolean }) => {
      setClientUploadCount(stats.uploaded);

      if (stats.uploaded > 0 && !stats.isUploading) {
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [router],
  );

  const isProcessing = status === "preprocessing" || status === "generating" || status === "qa_review";
  const isReady = status === "pdf_ready";
  const showUpload = effectiveUploadCount === 0 && !isProcessing && !isReady;
  const showUploaded = effectiveUploadCount > 0 && !isProcessing && !isReady;

  return (
    <div className="sample-upload-flow">
      {showUpload ? (
        <UploadDropzone
          title="Upload one favorite photo"
          hint="Action shots, siblings together, vacation favorites, close-up portraits, and pet photos all work well. Pick one photo with a clear main subject."
          entityType="sample"
          entityId={orderId}
          buttonLabel="Choose My Photo"
          onUploadStatsChange={handleUploadStatsChange}
        />
      ) : null}

      {showUploaded ? (
        <div className="upload-results-compact">
          <span className="pill pill-mint">Photo added</span>
          <div className="upload-results-list">
            {initialUploads
              .filter((u) => u.status === "uploaded")
              .map((upload) => (
                <div className="upload-result" key={upload.id}>
                  <strong>{upload.fileName}</strong>
                  <span className="pill pill-mint pill-sm">Ready</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <SampleProcessingPanel orderId={orderId} readyHref={readyHref} status={status} uploadCount={effectiveUploadCount} />
    </div>
  );
}
