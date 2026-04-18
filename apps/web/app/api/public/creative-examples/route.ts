import { NextRequest, NextResponse } from "next/server";
import { listCreativeAssets } from "@littlecolorbook/db";
import type { CreativeAssetTagsJson } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";

// Audience values accepted from the query string
const ALLOWED_AUDIENCE_TAGS = new Set(["family", "kids", "pets"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const audienceParam = searchParams.get("audience");
  const limitParam = searchParams.get("limit");

  const audience = audienceParam && ALLOWED_AUDIENCE_TAGS.has(audienceParam) ? audienceParam : undefined;
  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "12", 10) || 12), 24);

  const assets = await listCreativeAssets({
    source: "pipeline_test_batch",
    kind: "hero_image",
    complianceStatus: "passed",
    tagsQuery: audience ? { audience_tag: audience } : undefined,
    limit,
  });

  const { gcsConfigured } = getIntegrationStatus();

  // Build signed download URLs when GCS is available; fall back to null url otherwise.
  const examples = await Promise.all(
    assets.map(async (asset) => {
      let url: string | null = null;

      if (gcsConfigured && asset.gcsObject) {
        try {
          const signed = await createSignedDownloadUrl({
            bucket: asset.gcsBucket === "uploads" ? "uploads" : "exports",
            objectPath: asset.gcsObject,
            expiresInMinutes: 5,
          });
          url = signed.url;
        } catch {
          // Non-fatal — item will be omitted by the client if url is null
          url = null;
        }
      }

      return {
        id: asset.id,
        url,
        audience_tag: (asset.tagsJson as CreativeAssetTagsJson).audience_tag ?? null,
      };
    }),
  );

  // Drop items with no URL so the client carousel only receives displayable images
  const displayable = examples.filter((ex): ex is typeof ex & { url: string } => ex.url !== null);

  return NextResponse.json(
    { examples: displayable },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
