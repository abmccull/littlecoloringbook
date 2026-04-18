import { NextRequest, NextResponse } from "next/server";
import { GraphClient } from "@littlecolorbook/meta";
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

  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "META_SYSTEM_USER_TOKEN not set" }, { status: 503 });
  }

  const client = new GraphClient({
    accessToken: token,
    version: process.env.META_GRAPH_API_VERSION ?? "v22.0",
  });

  try {
    const me = await client.get<{ id: string; name?: string }>("me", { fields: "id,name" });
    const accounts = await client.get<{ data: AdAccountRow[] }>("me/adaccounts", {
      fields: "id,name,account_status,currency,timezone_name",
    });

    return NextResponse.json({
      ok: true,
      token_subject: me,
      ad_accounts: accounts.data ?? [],
      rate_limit_headers: client.rateLimitHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
