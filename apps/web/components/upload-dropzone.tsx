"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "./analytics-provider";

type UploadDropzoneProps = {
  title: string;
  hint: string;
  entityType: "sample" | "order";
  entityId: string;
  allowMultiple?: boolean;
  uploadKind?: "original" | "reference";
  buttonLabel?: string;
  initialUploads?: Array<{
    fileName: string;
    objectPath?: string;
    status: "uploaded" | "failed";
  }>;
  onUploadStatsChange?: (stats: {
    total: number;
    uploaded: number;
    failed: number;
    isUploading: boolean;
  }) => void;
};

type UploadItem = {
  id: string;
  fileName: string;
  status: "queued" | "uploading" | "uploaded" | "error";
  objectPath?: string;
  error?: string;
};

const uploadStateLabels: Record<UploadItem["status"], string> = {
  queued: "Queued",
  uploading: "Uploading",
  uploaded: "Ready",
  error: "Try again",
};

type PresignResponse = {
  objectPath: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

function getUploadFailureMessage(status: number) {
  if (status === 401 || status === 403) {
    return "We couldn't upload that photo just now. Choose it again and try one more time.";
  }

  if (status === 413) {
    return "That photo is too large to send as-is. Choose a smaller one and try again.";
  }

  if (status === 415) {
    return "That photo format did not come through cleanly. Choose a different photo and try again.";
  }

  return "We couldn't upload that photo. Please choose it again and try once more.";
}

function getCustomerUploadErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "We couldn't upload that photo. Please choose it again and try once more.";
  }

  return error.message;
}

export function UploadDropzone({
  title,
  hint,
  entityType,
  entityId,
  allowMultiple = false,
  uploadKind = "original",
  buttonLabel = "Choose Photos",
  initialUploads = [],
  onUploadStatsChange,
}: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>(
    initialUploads.map((upload, index) => ({
      id: `${upload.objectPath ?? upload.fileName}-${index}`,
      fileName: upload.fileName,
      objectPath: upload.objectPath,
      status: upload.status === "failed" ? "error" : "uploaded",
    })),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    onUploadStatsChange?.({
      total: uploads.length,
      uploaded: uploads.filter((item) => item.status === "uploaded").length,
      failed: uploads.filter((item) => item.status === "error").length,
      isUploading,
    });
  }, [isUploading, onUploadStatsChange, uploads]);

  async function uploadFile(file: File) {
    const presignResponse = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entityType,
        entityId,
        uploadKind,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });

    const presignPayload = (await presignResponse.json()) as PresignResponse | { error?: string };

    if (!presignResponse.ok || !("url" in presignPayload)) {
      throw new Error("We couldn't start that upload. Please try again.");
    }

    const uploadResponse = await fetch(presignPayload.url, {
      method: presignPayload.method,
      headers: Object.keys(presignPayload.headers).length > 0 ? presignPayload.headers : undefined,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(getUploadFailureMessage(uploadResponse.status));
    }

    const completeResponse = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entityType,
        entityId,
        objectPath: presignPayload.objectPath,
      }),
    });

    if (!completeResponse.ok) {
      throw new Error("Your photo uploaded, but we couldn't save it to your book yet. Please try once more.");
    }

    return presignPayload.objectPath;
  }

  async function handleSelectedFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return;
    }

    trackEvent("upload_batch_started", {
      entityType,
      entityId,
      fileCount: files.length,
      uploadKind,
    });

    setErrorMessage(null);
    setIsUploading(true);
    const queuedUploads = files.map((file, index) => ({
      id: `${file.name}-${Date.now()}-${index}`,
      fileName: file.name,
      status: "queued" as const,
    }));
    setUploads((current) => [...current, ...queuedUploads]);

    let completedCount = 0;

    for (const [index, file] of files.entries()) {
      const uploadId = queuedUploads[index]?.id;

      setUploads((current) =>
        current.map((item) =>
          item.id === uploadId ? { ...item, status: "uploading", error: undefined } : item,
        ),
      );

      try {
        const objectPath = await uploadFile(file);
        completedCount += 1;
        trackEvent("upload_file_completed", {
          entityType,
          entityId,
          fileName: file.name,
        });
        setUploads((current) =>
          current.map((item) =>
            item.id === uploadId ? { ...item, status: "uploaded", objectPath } : item,
          ),
        );
      } catch (error) {
        const message = getCustomerUploadErrorMessage(error);
        trackEvent("upload_file_failed", {
          entityType,
          entityId,
          fileName: file.name,
        });
        console.error("Upload failed", error);
        setErrorMessage(message);
        setUploads((current) =>
          current.map((item) =>
            item.id === uploadId ? { ...item, status: "error", error: message } : item,
          ),
        );
      }
    }

    trackEvent("upload_batch_completed", {
      entityType,
      entityId,
      fileCount: files.length,
      completedCount,
    });

    setIsUploading(false);
  }

  return (
    <div className="upload-stack">
      <div
        className={`upload-dropzone${isDragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.currentTarget === event.target) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
          void handleSelectedFiles(event.dataTransfer.files);
        }}
      >
        <div className="upload-dropzone-copy">
          <p className="upload-kicker">{allowMultiple ? "Drop favorite photos here" : "Drop your favorite photo here"}</p>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
        <div className="upload-actions">
          <input
            ref={fileInputRef}
            hidden
            accept="image/*"
            multiple={allowMultiple}
            type="file"
            onChange={(event) => {
              void handleSelectedFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <button
            className="button button-secondary"
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? "Uploading..." : buttonLabel}
          </button>
          <p className="muted">{allowMultiple ? "Add several at once from your camera roll" : "One photo is all we need to start"}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="status-banner status-banner-warning">
          <div className="stack-tight">
            <strong>That photo did not make it through.</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <div className="surface upload-results">
          <div className="upload-results-header">
            <span className="pill pill-sky">
              {uploads.length === 1 ? "Photo added" : "Photos added"}
            </span>
            <p className="mini-note">
              {uploads.some((item) => item.status === "error")
                ? "Any photo marked try again just needs to be chosen one more time."
                : "The clearest favorites are the best ones to keep at the top of the stack."}
            </p>
          </div>
          <div className="upload-results-list">
            {uploads.map((item) => (
              <div className="upload-result" key={item.id}>
                <div className="upload-result-copy">
                  <strong>{item.fileName}</strong>
                  {item.objectPath ? (
                    <p className="muted">Ready for your book</p>
                  ) : item.error ? (
                    <p className="muted">{item.error}</p>
                  ) : null}
                </div>
                <span className={`upload-state upload-state-${item.status}`}>{uploadStateLabels[item.status]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
