import { Storage } from "@google-cloud/storage";
import { getStorageEnv } from "./env";

export type StorageBucketKind = "uploads" | "exports";

export type SignedUploadRequest = {
  bucket: StorageBucketKind;
  objectPath: string;
  contentType: string;
  expiresInMinutes?: number;
};

export type SignedDownloadRequest = {
  bucket: StorageBucketKind;
  objectPath: string;
  expiresInMinutes?: number;
};

export type UploadObjectRequest = {
  bucket: StorageBucketKind;
  objectPath: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  cacheControl?: string;
};

export type DownloadObjectRequest = {
  bucket: StorageBucketKind;
  objectPath: string;
};

let storageClient: Storage | undefined;

function getBucketName(kind: StorageBucketKind) {
  const env = getStorageEnv();
  return kind === "uploads" ? env.uploadsBucket : env.exportsBucket;
}

export function getStorageClient() {
  if (storageClient) {
    return storageClient;
  }

  const env = getStorageEnv();

  storageClient = new Storage({
    projectId: env.projectId,
    credentials: {
      client_email: env.clientEmail,
      private_key: env.privateKey,
    },
  });

  return storageClient;
}

export function sanitizeObjectName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const sanitized = trimmed
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "uploaded-file";
}

export function buildAssetPath(parts: string[]) {
  return parts
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export async function createSignedUploadUrl({
  bucket,
  objectPath,
  contentType,
  expiresInMinutes = 15,
}: SignedUploadRequest) {
  const file = getStorageClient().bucket(getBucketName(bucket)).file(objectPath);
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
    contentType,
  });

  return {
    url,
    expiresAt: new Date(expiresAt).toISOString(),
    method: "PUT" as const,
    headers: {
      "Content-Type": contentType,
    },
  };
}

export async function createSignedDownloadUrl({
  bucket,
  objectPath,
  expiresInMinutes = 60,
}: SignedDownloadRequest) {
  const file = getStorageClient().bucket(getBucketName(bucket)).file(objectPath);
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAt,
  });

  return {
    url,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function uploadObject({
  bucket,
  objectPath,
  body,
  contentType,
  cacheControl,
}: UploadObjectRequest) {
  const file = getStorageClient().bucket(getBucketName(bucket)).file(objectPath);

  await file.save(typeof body === "string" ? Buffer.from(body) : Buffer.from(body), {
    resumable: false,
    metadata: {
      contentType,
      ...(cacheControl ? { cacheControl } : {}),
    },
  });

  return {
    bucket,
    objectPath,
    contentType,
  };
}

export async function downloadObject({ bucket, objectPath }: DownloadObjectRequest) {
  const file = getStorageClient().bucket(getBucketName(bucket)).file(objectPath);
  const [buffer] = await file.download();
  return buffer;
}
