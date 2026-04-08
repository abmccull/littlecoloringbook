import { NextResponse } from "next/server";
import { APP_NAME } from "@littlecolorbook/shared";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: APP_NAME,
    timestamp: new Date().toISOString(),
    integrations: getIntegrationStatus(),
  });
}
