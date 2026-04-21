import { NextRequest, NextResponse } from "next/server";
import { getCreativeAssetById } from "@littlecolorbook/db";
import type { CreativeAssetTagsJson } from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";

// Audience values accepted from the query string
type AudienceTag = "family" | "kids" | "pets";

const ALLOWED_AUDIENCE_TAGS = new Set<AudienceTag>(["family", "kids", "pets"]);

const CURATED_EXAMPLE_IDS = {
  family: [
    "4ced8c5194f7a889be961396ed",
    "86b9a1d1e482de2c3125906ffe",
    "4c1ffdfe4e1241330842228249",
    "822a431585c21c98f4ece71f1c",
    "68abb7d2bd035269f68243daa1",
    "36e047415297e3495651a50b5e",
    "70f18422e076622826fe7e13e7",
  ],
  kids: [
    "be55aa2db00b0cab24119798ac",
    "59dd7c3c351e8426997fa6f56c",
    "766a8de85b2685561591164f29",
    "b6983441ce6f0db0e6c8cdc1cb",
  ],
  pets: [
    "ae9cac5e1489d50a0b3108c7a2",
    "569ce281c1777251fb0de84115",
    "1513367cbdea53a919d694488c",
    "130aed082efb75b3e43a667a4c",
  ],
} as const;

const CURATED_ALL_IDS = [
  ...CURATED_EXAMPLE_IDS.family,
  ...CURATED_EXAMPLE_IDS.kids,
  ...CURATED_EXAMPLE_IDS.pets,
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const audienceParam = searchParams.get("audience");
  const limitParam = searchParams.get("limit");

  const audience =
    audienceParam && ALLOWED_AUDIENCE_TAGS.has(audienceParam as AudienceTag)
      ? (audienceParam as AudienceTag)
      : undefined;
  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "12", 10) || 12), 24);
  const curatedIds = audience ? CURATED_EXAMPLE_IDS[audience] : CURATED_ALL_IDS;
  const assets = (
    await Promise.all(curatedIds.slice(0, limit).map((id: string) => getCreativeAssetById(id)))
  ).filter((asset): asset is NonNullable<typeof asset> => {
    return Boolean(
      asset &&
        asset.source === "pipeline_test_batch" &&
        asset.kind === "hero_image" &&
        asset.complianceStatus === "passed" &&
        asset.gcsObject,
    );
  });

  const { gcsConfigured } = getIntegrationStatus();

  // Build signed download URLs when GCS is available; fall back to null url otherwise.
  const examples = await Promise.all(
    assets.map(async (asset: (typeof assets)[number]) => {
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
  const displayable = examples.filter(
    (ex): ex is (typeof examples)[number] & { url: string } => ex.url !== null,
  );

  return NextResponse.json(
    { examples: displayable },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
