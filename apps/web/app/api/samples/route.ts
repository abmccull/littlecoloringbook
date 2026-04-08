import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrderDraft, isDatabaseConfigured } from "@littlecolorbook/db";

const createSampleSchema = z.object({
  email: z.string().email(),
  childFirstName: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSampleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid sample request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const result = await createOrderDraft({
    email: parsed.data.email,
    orderType: "sample",
    deliveryMode: "sample",
    selectedOfferCode: "sample-free",
    designCount: 1,
    childFirstName: parsed.data.childFirstName ?? null,
    dedicationText: null,
    subtotalCents: 0,
    shippingCents: 0,
    totalCents: 0,
  });

  return NextResponse.json({
    id: result.order.id,
    status: result.order.status,
    type: result.order.orderType,
    email: result.customer.email,
    childFirstName: result.order.childFirstName,
    portalToken: result.portalToken,
    portalUrl: result.portalUrl,
    processingUrl: `/sample/processing?token=${encodeURIComponent(result.portalToken)}`,
    readyUrl: `/sample/${result.portalToken}`,
    databaseConfigured: result.databaseConfigured,
    jobQueued: false,
  });
}
