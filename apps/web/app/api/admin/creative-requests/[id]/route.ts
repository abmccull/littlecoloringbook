import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";
import { getCreativeRequestById, markCreativeRequestRejected } from "@littlecolorbook/db";

// ─── GET — single creative request detail ─────────────────────────────────────

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const row = await getCreativeRequestById(id);
  if (!row) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Creative request ${id} not found` } },
      { status: 404 },
    );
  }

  return NextResponse.json({ creativeRequest: row });
}

// ─── POST — admin cancel action ───────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  // Only support /cancel action via the body or searchParam
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action !== "cancel") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Unknown action. Supported actions: cancel" } },
      { status: 400 },
    );
  }

  const row = await getCreativeRequestById(id);
  if (!row) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Creative request ${id} not found` } },
      { status: 404 },
    );
  }

  if (row.status !== "pending") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Cannot cancel a request with status '${row.status}'. Only pending requests can be canceled.` } },
      { status: 409 },
    );
  }

  const updated = await markCreativeRequestRejected({
    id,
    reason: "admin_canceled",
    rejectedAt: new Date(),
  });

  return NextResponse.json({ ok: true, creativeRequest: updated });
}
