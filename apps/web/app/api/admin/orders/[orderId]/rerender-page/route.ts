import { NextRequest, NextResponse } from "next/server";
import { recordSupportAction, setOrderStatus } from "@littlecolorbook/db";
import { z } from "zod";
import { isClerkConfigured, requireAdminApiSession } from "../../../../../../lib/auth";

const rerenderSchema = z.object({
  pageNumber: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const session = await requireAdminApiSession();

  if (!session) {
    return NextResponse.json(
      { error: isClerkConfigured() ? "Unauthorized" : "Admin auth is not configured." },
      { status: isClerkConfigured() ? 401 : 503 },
    );
  }

  const { orderId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = rerenderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rerender request", issues: parsed.error.flatten() }, { status: 400 });
  }

  await recordSupportAction({
    orderId,
    actionType: "rerender_page",
    pageNumber: parsed.data.pageNumber,
    notes: parsed.data.reason ?? null,
    createdBy: session?.email ?? null,
  });
  await setOrderStatus(orderId, "support_required", "support.page_rerender_requested", {
    pageNumber: parsed.data.pageNumber,
    reason: parsed.data.reason ?? null,
    createdBy: session?.email ?? null,
  });

  return NextResponse.json({ ok: true, orderId, pageNumber: parsed.data.pageNumber, status: "support_required" });
}
