#!/usr/bin/env node
/**
 * Applies CORS rules to the uploads bucket so browsers can PUT directly
 * to signed URLs from littlecolorbook.com. Safe to re-run — the SDK
 * replaces the bucket's CORS config with whatever we pass.
 *
 * Requires GCS_* env vars (same ones the app uses).
 */
import { Storage } from "@google-cloud/storage";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });

const projectId = process.env.GCS_PROJECT_ID;
const clientEmail = process.env.GCS_CLIENT_EMAIL;
const privateKey = (process.env.GCS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const uploadsBucket = process.env.GCS_BUCKET_UPLOADS;

if (!projectId || !clientEmail || !privateKey || !uploadsBucket) {
  console.error("Missing GCS env vars. Need GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY, GCS_BUCKET_UPLOADS.");
  process.exit(1);
}

const ORIGINS = [
  "https://littlecolorbook.com",
  "https://www.littlecolorbook.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const CORS = [
  {
    origin: ORIGINS,
    method: ["PUT", "POST", "GET", "HEAD"],
    responseHeader: [
      "Content-Type",
      "x-goog-content-length-range",
      "x-goog-resumable",
      "Authorization",
    ],
    maxAgeSeconds: 3600,
  },
];

const storage = new Storage({
  projectId,
  credentials: { client_email: clientEmail, private_key: privateKey },
});

const bucket = storage.bucket(uploadsBucket);

try {
  await bucket.setCorsConfiguration(CORS);
  const [metadata] = await bucket.getMetadata();
  console.log(`✓ Applied CORS to gs://${uploadsBucket}`);
  console.log(JSON.stringify(metadata.cors, null, 2));
} catch (error) {
  console.error(`✗ Failed to apply CORS: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
