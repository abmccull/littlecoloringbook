import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  isDatabaseConfigured,
  listConsentedSamplesForIngestion,
  markOrderFeatureIngested,
} from "@littlecolorbook/db";
import { downloadObject, uploadObject } from "@littlecolorbook/shared/storage";

const EXPORTS_BUCKET = "exports" as const;
const UPLOADS_BUCKET = "uploads" as const;
const BATCH_LIMIT = 50;

/**
 * Nightly cron that ingests consented sample pairs into the creative
 * library. For each order where feature_consent=true and feature_
 * ingested_at IS NULL:
 *   1. Copy the source photo from uploads/<...> to
 *      exports/creative-library/samples/<orderId>/source.<ext>
 *   2. Copy the generated coloring page to
 *      exports/creative-library/samples/<orderId>/coloring.png
 *   3. Stamp orders.feature_ingested_at so the order isn't picked up
 *      again on the next run.
 *
 * Idempotent across retries — if storage copy succeeds but the DB
 * stamp fails, the next run re-copies (cheap, PUT overwrites).
 *
 * Vision-level tagging (scene type, emotion, child recognition risk
 * via semantic-tags) is left to a downstream step so the cron can stay
 * fast; tagging runs async after ingestion so the creative library
 * becomes searchable as tags land.
 */
export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const samples = await listConsentedSamplesForIngestion({ limit: BATCH_LIMIT });

  let processed = 0;
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ orderId: string; error: string }> = [];

  for (const sample of samples) {
    processed++;

    if (!sample.sourceObjectPath || !sample.coloringObjectPath) {
      // Missing one half of the pair — treat as skipped, don't mark
      // ingested so a later run picks it up if the other asset lands.
      skipped++;
      continue;
    }

    try {
      const sourceBuf = await downloadObject({
        bucket: UPLOADS_BUCKET,
        objectPath: sample.sourceObjectPath,
      });
      const coloringBuf = await downloadObject({
        bucket: EXPORTS_BUCKET,
        objectPath: sample.coloringObjectPath,
      });

      // Preserve the source extension. We store .jpg even if the
      // upload was .png — downstream compositors read content-type
      // from the response, not the filename.
      const sourceExt = (sample.sourceObjectPath.split(".").pop() ?? "jpg").toLowerCase();
      const safeExt = sourceExt === "png" ? "png" : "jpg";
      const sourceContentType = safeExt === "png" ? "image/png" : "image/jpeg";

      const destPrefix = `creative-library/samples/${sample.orderId}`;
      await uploadObject({
        bucket: EXPORTS_BUCKET,
        objectPath: `${destPrefix}/source.${safeExt}`,
        body: sourceBuf,
        contentType: sourceContentType,
        cacheControl: "public, max-age=31536000",
      });
      await uploadObject({
        bucket: EXPORTS_BUCKET,
        objectPath: `${destPrefix}/coloring.png`,
        body: coloringBuf,
        contentType: "image/png",
        cacheControl: "public, max-age=31536000",
      });

      await markOrderFeatureIngested(sample.orderId);
      ingested++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ orderId: sample.orderId, error: message });
      console.error(`ingest-consented-samples: failed for order ${sample.orderId}:`, error);
    }
  }

  return NextResponse.json({
    received: true,
    processed,
    ingested,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
}
