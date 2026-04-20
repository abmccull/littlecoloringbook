import { NextRequest, NextResponse } from "next/server";
import { getMetaEnv } from "@littlecolorbook/shared/env";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { getOrganicPostById, updateOrganicPostStatus } from "@littlecolorbook/db";
import { publishFbPagePhoto, publishFbPageCarousel } from "@littlecolorbook/social";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const post = await getOrganicPostById(id);
  if (!post) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: `Organic post ${id} not found` } }, { status: 404 });
  }

  if (post.status === "published") {
    return NextResponse.json({ error: { code: "ALREADY_PUBLISHED", message: "Post is already published" } }, { status: 409 });
  }

  if (post.status === "publishing") {
    return NextResponse.json({ error: { code: "ALREADY_PUBLISHING", message: "Post is currently being published" } }, { status: 409 });
  }

  if (post.status === "canceled") {
    return NextResponse.json({ error: { code: "CANCELED", message: "Cannot publish a canceled post" } }, { status: 422 });
  }

  const metaEnv = getMetaEnv();
  const pageAccessToken = metaEnv.pageAccessToken;
  const pageId = metaEnv.pageId;

  if (!pageAccessToken || !pageId) {
    return NextResponse.json({ error: { code: "CONFIGURATION_ERROR", message: "META_PAGE_ACCESS_TOKEN and META_PAGE_ID must be configured" } }, { status: 503 });
  }

  if (post.platform === "ig") {
    return NextResponse.json({ error: { code: "IG_PUBLISHING_UNAVAILABLE", message: "IG publishing is not yet enabled — instagram_content_publish scope required" } }, { status: 422 });
  }

  if (post.format !== "single_image" && post.format !== "carousel") {
    return NextResponse.json({ error: { code: "FORMAT_UNSUPPORTED", message: `Format '${post.format}' is not supported yet — single_image and carousel are implemented` } }, { status: 422 });
  }

  if (!post.imageAssetIds || post.imageAssetIds.length === 0) {
    return NextResponse.json({ error: { code: "NO_IMAGE", message: "Post has no imageAssetIds" } }, { status: 422 });
  }

  if (post.format === "carousel" && post.imageAssetIds.length < 2) {
    return NextResponse.json({ error: { code: "CAROUSEL_NEEDS_TWO", message: "Carousel format requires at least 2 imageAssetIds" } }, { status: 422 });
  }

  await updateOrganicPostStatus(id, "publishing", {
    publishingAttempts: (post.publishingAttempts ?? 0) + 1,
  });

  try {
    if (post.format === "carousel") {
      // Resolve each asset to a public URL. Treat asset ids that are
      // already absolute URLs as-is; treat the rest as GCS object paths
      // in the exports bucket (where rendered creative images live).
      const imageUrls = await Promise.all(
        post.imageAssetIds.map(async (assetId) => {
          if (/^https?:\/\//i.test(assetId)) return assetId;
          const { url } = await createSignedDownloadUrl({
            bucket: "exports",
            objectPath: assetId,
            expiresInMinutes: 15,
          });
          return url;
        }),
      );

      const result = await publishFbPageCarousel({
        pageId,
        accessToken: pageAccessToken,
        imageUrls,
        caption: post.caption,
        apiVersion: metaEnv.graphApiVersion,
      });

      await updateOrganicPostStatus(id, "published", {
        metaFbPostId: result.post_id || result.id,
        publishedAt: new Date(),
      });

      return NextResponse.json({ ok: true, metaFbPostId: result.post_id || result.id, format: "carousel", slideCount: imageUrls.length });
    }

    const result = await publishFbPagePhoto({
      pageId,
      accessToken: pageAccessToken,
      imagePath: post.imageAssetIds[0],
      caption: post.caption,
      apiVersion: metaEnv.graphApiVersion,
    });

    await updateOrganicPostStatus(id, "published", {
      metaFbPostId: result.post_id || result.id,
      publishedAt: new Date(),
    });

    return NextResponse.json({ ok: true, metaFbPostId: result.post_id || result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publish error";
    await updateOrganicPostStatus(id, "failed", { errorMessage: message });
    return NextResponse.json({ error: { code: "PUBLISH_FAILED", message } }, { status: 502 });
  }
}
