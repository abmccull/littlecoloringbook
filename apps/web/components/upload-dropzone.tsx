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
  queued: "Waiting",
  uploading: "Uploading",
  uploaded: "Ready",
  error: "Needs attention",
};

type PresignResponse = {
  objectPath: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

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
      throw new Error(("error" in presignPayload && presignPayload.error) || "Could not create an upload URL.");
    }

    const uploadResponse = await fetch(presignPayload.url, {
      method: presignPayload.method,
      headers: presignPayload.headers,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}. Confirm bucket CORS and credentials.`);
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
      throw new Error("Upload finalization failed.");
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
        const message = error instanceof Error ? error.message : "Upload failed.";
        trackEvent("upload_file_failed", {
          entityType,
          entityId,
          fileName: file.name,
        });
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

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      {uploads.length > 0 ? (
        <div className="surface upload-results">
          <span className="pill pill-sky">Photos added</span>
          <div className="upload-results-list">
            {uploads.map((item) => (
              <div className="upload-result" key={item.id}>
                <div>
                  <strong>{item.fileName}</strong>
                  {item.objectPath ? <p className="muted">Ready for your book</p> : item.error ? <p className="muted">{item.error}</p> : null}
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
