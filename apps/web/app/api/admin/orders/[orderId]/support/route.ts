import { NextRequest, NextResponse } from "next/server";
import { recordSupportAction, setOrderStatus } from "@littlecolorbook/db";
import { z } from "zod";
import { isClerkConfigured, requireAdminApiSession } from "../../../../../../lib/auth";

const supportSchema = z.object({
  reason: z.string().trim().min(1).max(500),
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
  const parsed = supportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support request", issues: parsed.error.flatten() }, { status: 400 });
  }

  await recordSupportAction({
    orderId,
    actionType: "mark_support_required",
    notes: parsed.data.reason,
    createdBy: session?.email ?? null,
  });
  await setOrderStatus(orderId, "support_required", "support.marked_required", {
    reason: parsed.data.reason,
    createdBy: session?.email ?? null,
  });

  return NextResponse.json({ ok: true, orderId, status: "support_required" });
}
