"use client";

import { useRef, useState } from "react";
import { trackEvent } from "./analytics-provider";

type UploadDropzoneProps = {
  title: string;
  hint: string;
  entityType: "sample" | "order";
  entityId: string;
  allowMultiple?: boolean;
  uploadKind?: "original" | "reference";
  buttonLabel?: string;
};

type UploadItem = {
  fileName: string;
  status: "queued" | "uploading" | "uploaded" | "error";
  objectPath?: string;
  error?: string;
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
}: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setUploads(files.map((file) => ({ fileName: file.name, status: "queued" })));

    let completedCount = 0;

    for (const file of files) {
      setUploads((current) =>
        current.map((item) =>
          item.fileName === file.name ? { ...item, status: "uploading", error: undefined } : item,
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
            item.fileName === file.name ? { ...item, status: "uploaded", objectPath } : item,
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
            item.fileName === file.name ? { ...item, status: "error", error: message } : item,
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
      <div className="upload-dropzone">
        <div>
          <p className="upload-kicker">Drop photos here</p>
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
          <p className="muted">{allowMultiple ? "Supports multi-photo upload" : "One photo at a time"}</p>
        </div>
      </div>

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      {uploads.length > 0 ? (
        <div className="surface upload-results">
          <span className="pill">Upload status</span>
          <div className="upload-results-list">
            {uploads.map((item) => (
              <div className="upload-result" key={`${item.fileName}-${item.objectPath ?? item.status}`}>
                <div>
                  <strong>{item.fileName}</strong>
                  {item.objectPath ? <p className="muted">{item.objectPath}</p> : null}
                </div>
                <span className={`upload-state upload-state-${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
