import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrderDraft, isDatabaseConfigured } from "@littlecolorbook/db";
import { defaultOffer, getOfferByCode } from "@littlecolorbook/shared";

const createOrderSchema = z.object({
  email: z.string().email().optional(),
  orderType: z.enum(["pdf", "print"]).default("pdf"),
  deliveryMode: z.enum(["pdf", "print"]).optional(),
  selectedOffer: z.string().default(defaultOffer),
  designCount: z.number().int().positive().optional(),
  childFirstName: z.string().trim().min(1).max(80).optional(),
  dedicationText: z.string().trim().max(240).optional(),
  subtotalCents: z.number().int().nonnegative().optional(),
  shippingCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid order request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const selectedOffer = getOfferByCode(parsed.data.selectedOffer);
  const email = parsed.data.email ?? "guest@littlecolorbook.local";
  const deliveryMode = parsed.data.deliveryMode ?? parsed.data.orderType;
  const subtotalCents = parsed.data.subtotalCents ?? selectedOffer.subtotalCents;
  const shippingCents = parsed.data.shippingCents ?? 0;
  const result = await createOrderDraft({
    email,
    orderType: parsed.data.orderType,
    deliveryMode,
    selectedOfferCode: selectedOffer.code,
    designCount: parsed.data.designCount ?? selectedOffer.designs,
    childFirstName: parsed.data.childFirstName ?? null,
    dedicationText: parsed.data.dedicationText ?? null,
    subtotalCents,
    shippingCents,
    totalCents: parsed.data.totalCents ?? subtotalCents + shippingCents,
  });

  return NextResponse.json({
    id: result.order.id,
    status: result.order.status,
    orderType: result.order.orderType,
    deliveryMode: result.order.deliveryMode,
    selectedOffer: result.order.selectedOfferCode,
    designCount: result.order.designCount,
    subtotalCents: result.order.subtotalCents,
    shippingCents: result.order.shippingCents,
    totalCents: result.order.totalCents,
    portalToken: result.portalToken,
    portalUrl: result.portalUrl,
    databaseConfigured: result.databaseConfigured,
  });
}
