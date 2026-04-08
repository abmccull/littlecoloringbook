import { NextRequest, NextResponse } from "next/server";
import { recordSupportAction } from "@littlecolorbook/db";
import { z } from "zod";
import { isClerkConfigured, requireAdminApiSession } from "../../../../../../lib/auth";
import { deliverLifecycleEmail } from "../../../../../../lib/lifecycle-email";

const sendEmailSchema = z.object({
  template: z.enum(["order-paid", "pdf-ready", "print-submitted", "order-shipped", "order-delivered"]),
  force: z.boolean().optional(),
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
  const parsed = sendEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email request", issues: parsed.error.flatten() }, { status: 400 });
  }

  await recordSupportAction({
    orderId,
    actionType: "send_email",
    notes: `Template: ${parsed.data.template}`,
    createdBy: session?.email ?? null,
    payload: { force: parsed.data.force ?? false },
  });

  try {
    const result = await deliverLifecycleEmail({
      orderId,
      template: parsed.data.template,
      force: parsed.data.force,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lifecycle email failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
