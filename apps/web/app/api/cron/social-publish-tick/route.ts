import { NextRequest, NextResponse } from "next/server";
import { getMetaEnv } from "@littlecolorbook/shared/env";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { listDueOrganicPosts, updateOrganicPostStatus } from "@littlecolorbook/db";
import { publishFbPagePhoto } from "@littlecolorbook/social";

const BATCH_LIMIT = 10;
const MAX_ATTEMPTS_BEFORE_FAIL = 3;
const RETRY_DELAY_SECONDS = 5 * 60;
const RATE_LIMIT_DELAY_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const metaEnv = getMetaEnv();
  const pageAccessToken = metaEnv.pageAccessToken;
  const pageId = metaEnv.pageId;
  const apiVersion = metaEnv.graphApiVersion;

  const nowUnix = Math.floor(Date.now() / 1000);
  const duePosts = await listDueOrganicPosts({ nowUnix, limit: BATCH_LIMIT });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let retried = 0;
  let postsPublishedThisRun = 0;

  for (const post of duePosts) {
    processed++;

    // Rate limit: pause after every 4 publishes to stay under ~4/min.
    if (postsPublishedThisRun > 0 && postsPublishedThisRun % 4 === 0) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    if (post.platform === "ig") {
      await updateOrganicPostStatus(post.id, "failed", {
        errorMessage: "IG publishing requires instagram_content_publish scope",
        publishingAttempts: (post.publishingAttempts ?? 0) + 1,
      });
      failed++;
      continue;
    }

    if (post.format !== "single_image") {
      await updateOrganicPostStatus(post.id, "failed", {
        errorMessage: `Format '${post.format}' not yet implemented — only single_image supported in v1`,
        publishingAttempts: (post.publishingAttempts ?? 0) + 1,
      });
      failed++;
      continue;
    }

    if (!post.imageAssetIds || post.imageAssetIds.length === 0) {
      await updateOrganicPostStatus(post.id, "failed", {
        errorMessage: "No imageAssetIds on post",
        publishingAttempts: (post.publishingAttempts ?? 0) + 1,
      });
      failed++;
      continue;
    }

    if (!pageAccessToken || !pageId) {
      await updateOrganicPostStatus(post.id, "failed", {
        errorMessage: "META_PAGE_ACCESS_TOKEN or META_PAGE_ID not configured",
        publishingAttempts: (post.publishingAttempts ?? 0) + 1,
      });
      failed++;
      continue;
    }

    const newAttemptCount = (post.publishingAttempts ?? 0) + 1;
    await updateOrganicPostStatus(post.id, "publishing", { publishingAttempts: newAttemptCount });

    try {
      const result = await publishFbPagePhoto({
        pageId,
        accessToken: pageAccessToken,
        imagePath: post.imageAssetIds[0],
        caption: post.caption,
        apiVersion,
      });

      await updateOrganicPostStatus(post.id, "published", {
        metaFbPostId: result.post_id || result.id,
        publishedAt: new Date(),
        errorMessage: null,
      });

      succeeded++;
      postsPublishedThisRun++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (newAttemptCount >= MAX_ATTEMPTS_BEFORE_FAIL) {
        await updateOrganicPostStatus(post.id, "failed", { errorMessage: message });
        failed++;
      } else {
        const retryAt = new Date((nowUnix + RETRY_DELAY_SECONDS) * 1000);
        await updateOrganicPostStatus(post.id, "scheduled", {
          scheduledAt: retryAt,
          errorMessage: message,
        });
        retried++;
      }
    }
  }

  return NextResponse.json({ processed, succeeded, failed, retried });
}
