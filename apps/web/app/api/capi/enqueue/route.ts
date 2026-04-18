import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertCapiEvent, isDatabaseConfigured } from "@littlecolorbook/db";
import { enqueueCapiEvent } from "@littlecolorbook/queue";

const userDataSchema = z.object({
  em: z.array(z.string()).optional(),
  ph: z.array(z.string()).optional(),
  fn: z.array(z.string()).optional(),
  ln: z.array(z.string()).optional(),
  db: z.array(z.string()).optional(),
  ge: z.array(z.string()).optional(),
  ct: z.array(z.string()).optional(),
  st: z.array(z.string()).optional(),
  zp: z.array(z.string()).optional(),
  country: z.array(z.string()).optional(),
  external_id: z.array(z.string()).optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  client_ip_address: z.string().optional(),
  client_user_agent: z.string().optional(),
});

const enqueueCapiEventSchema = z.object({
  event_name: z.string().min(1),
  event_time: z.number().int().positive(),
  event_id: z.string().uuid(),
  action_source: z.string().min(1),
  event_source_url: z.string().optional(),
  user_data: userDataSchema,
  custom_data: z.record(z.string(), z.unknown()).optional(),
  opt_out: z.boolean().optional(),
});

function buildUserDataFingerprint(userData: z.infer<typeof userDataSchema>): string {
  const stable = JSON.stringify(userData, Object.keys(userData).sort());
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (origin === appUrl) return true;
  try {
    const { hostname } = new URL(origin);
    // Accept apex + any subdomain of the product domain. Covers www,
    // staging.www, vercel preview deploys under the apex, etc.
    if (hostname === "littlecolorbook.com" || hostname.endsWith(".littlecolorbook.com")) return true;
    // Local dev
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  } catch {
    return false;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = enqueueCapiEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = parsed.data;

  const payloadJson: Record<string, unknown> = {
    event_name: event.event_name,
    event_time: event.event_time,
    event_id: event.event_id,
    action_source: event.action_source,
    user_data: event.user_data,
  };

  if (event.event_source_url) payloadJson.event_source_url = event.event_source_url;
  if (event.custom_data) payloadJson.custom_data = event.custom_data;
  if (event.opt_out !== undefined) payloadJson.opt_out = event.opt_out;

  const userDataFingerprint = buildUserDataFingerprint(event.user_data);

  if (isDatabaseConfigured()) {
    const row = await insertCapiEvent({
      id: `capi_${event.event_id.replace(/-/g, "")}`,
      eventId: event.event_id,
      eventName: event.event_name,
      eventTime: new Date(event.event_time * 1000),
      actionSource: event.action_source,
      userDataFingerprint,
      payloadJson,
    });

    if (row) {
      enqueueCapiEvent(row.id).catch((err: unknown) => {
        console.error("[capi/enqueue] failed to enqueue job", err);
      });
    }
  }

  return NextResponse.json({ accepted: true }, { status: 202 });
}
