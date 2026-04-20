import { NextRequest, NextResponse } from "next/server";
import { GraphClient } from "@littlecolorbook/meta";
import { getMetaEnv } from "@littlecolorbook/shared/env";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdAccountRow = {
  id: string;
  name?: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
};

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const env = getMetaEnv();
  if (!env.systemUserToken) {
    return NextResponse.json({ error: "META_SYSTEM_USER_TOKEN not set" }, { status: 503 });
  }

  const client = new GraphClient({
    accessToken: env.systemUserToken,
    version: env.graphApiVersion,
  });

  const config = {
    pixelId: env.pixelId,
    datasetId: env.datasetId,
    pageId: env.pageId,
    pageAccessTokenConfigured: Boolean(env.pageAccessToken),
    testEventCodeConfigured: Boolean(env.testEventCode),
    graphApiVersion: env.graphApiVersion,
  };

  const checks: Record<string, unknown> = {};
  let ok = true;

  try {
    checks.token_subject = await client.get<{ id: string; name?: string }>("me", { fields: "id,name" });
    checks.ad_accounts = (
      await client.get<{ data: AdAccountRow[] }>("me/adaccounts", {
        fields: "id,name,account_status,currency,timezone_name",
      })
    ).data ?? [];
  } catch (error) {
    ok = false;
    checks.system_user_error = error instanceof Error ? error.message : "unknown";
  }

  if (env.datasetId) {
    try {
      checks.dataset = await client.get<{ id: string; name?: string }>(env.datasetId, { fields: "id,name" });
    } catch (error) {
      ok = false;
      checks.dataset_error = error instanceof Error ? error.message : "unknown";
    }
  }

  if (env.pageId && env.pageAccessToken) {
    try {
      const pageClient = new GraphClient({
        accessToken: env.pageAccessToken,
        version: env.graphApiVersion,
      });
      checks.page = await pageClient.get<{ id: string; name?: string }>(env.pageId, { fields: "id,name" });
    } catch (error) {
      ok = false;
      checks.page_error = error instanceof Error ? error.message : "unknown";
    }
  }

  return NextResponse.json(
    {
      ok,
      config,
      checks,
      rate_limit_headers: client.rateLimitHeaders,
    },
    { status: ok ? 200 : 502 },
  );
}
