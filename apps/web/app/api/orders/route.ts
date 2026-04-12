import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrderDraft, isDatabaseConfigured } from "@littlecolorbook/db";
import { defaultOffer, getOfferByCode } from "@littlecolorbook/shared";
import { readAttributionSnapshot } from "../../../lib/attribution-cookies";

const createOrderSchema = z.object({
  email: z.string().email().optional(),
  orderType: z.enum(["pdf", "print"]).default("pdf"),
  deliveryMode: z.enum(["pdf", "print"]).optional(),
  acquisitionPath: z.string().trim().optional(),
  entrySource: z.string().trim().optional(),
  utmSource: z.string().trim().optional(),
  utmMedium: z.string().trim().optional(),
  utmCampaign: z.string().trim().optional(),
  utmContent: z.string().trim().optional(),
  utmTerm: z.string().trim().optional(),
  selectedOffer: z.string().default(defaultOffer),
  designCount: z.number().int().positive().optional(),
  quantity: z.number().int().positive().max(5).optional(),
  printQuantity: z.number().int().positive().max(5).optional(),
  bundleSelection: z.string().trim().optional().nullable(),
  bundleOffer: z.string().trim().optional().nullable(),
  coverStyle: z.string().trim().optional().nullable(),
  occasion: z.string().trim().optional().nullable(),
  occasionContext: z
    .object({
      childName: z.string().trim().max(80).optional(),
      age: z.number().int().min(1).max(120).optional(),
      location: z.string().trim().max(120).optional(),
      petName: z.string().trim().max(80).optional(),
      year: z.number().int().optional(),
    })
    .optional()
    .nullable(),
  copyNames: z.array(z.string().trim().max(80).nullable()).max(5).optional().nullable(),
  childFirstName: z.string().trim().min(1).max(80).optional(),
  dedicationText: z.string().trim().max(240).optional(),
  subtotalCents: z.number().int().nonnegative().optional(),
  shippingCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
});

function normalizeBundleSelection(bundleSelection?: string | null, bundleOffer?: string | null) {
  if (bundleSelection) {
    return bundleSelection;
  }

  switch (bundleOffer) {
    case "solo":
      return "single";
    case "sibling_set":
      return "set-of-2";
    case "sibling_trio":
      return "set-of-3";
    default:
      return null;
  }
}

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
  const attribution = readAttributionSnapshot(request);
  const lastTouch = attribution.lastTouch ?? attribution.firstTouch;
  const quantity = parsed.data.quantity ?? parsed.data.printQuantity ?? 1;
  const bundleSelection =
    deliveryMode === "print" ? normalizeBundleSelection(parsed.data.bundleSelection, parsed.data.bundleOffer) : null;
  const result = await createOrderDraft({
    email,
    orderType: parsed.data.orderType,
    deliveryMode,
    visitorId: attribution.visitorId,
    sessionId: attribution.sessionId,
    acquisitionPath: parsed.data.acquisitionPath ?? "unknown",
    entrySource: parsed.data.entrySource ?? null,
    landingPath: attribution.firstTouch?.landingPath ?? lastTouch?.landingPath ?? null,
    firstTouch: attribution.firstTouch,
    lastTouch,
    utmSource: lastTouch?.utmSource ?? parsed.data.utmSource ?? null,
    utmMedium: lastTouch?.utmMedium ?? parsed.data.utmMedium ?? null,
    utmCampaign: lastTouch?.utmCampaign ?? parsed.data.utmCampaign ?? null,
    utmContent: lastTouch?.utmContent ?? parsed.data.utmContent ?? null,
    utmTerm: lastTouch?.utmTerm ?? parsed.data.utmTerm ?? null,
    selectedOfferCode: selectedOffer.code,
    designCount: parsed.data.designCount ?? selectedOffer.designs,
    quantity,
    bundleSelection,
    coverStyle: parsed.data.coverStyle ?? null,
    copyNames: parsed.data.copyNames ?? null,
    childFirstName: parsed.data.childFirstName ?? null,
    dedicationText: parsed.data.dedicationText ?? null,
    shippingCents: parsed.data.shippingCents ?? 0,
    // TODO: persist occasion + occasionContext to DB once schema columns are added
  });

  return NextResponse.json({
    id: result.order.id,
    status: result.order.status,
    orderType: result.order.orderType,
    deliveryMode: result.order.deliveryMode,
    visitorId: result.order.visitorId,
    acquisitionPath: result.order.acquisitionPath,
    entrySource: result.order.entrySource,
    selectedOffer: result.order.selectedOfferCode,
    designCount: result.order.designCount,
    quantity: result.order.quantity,
    bundleSelection: result.order.bundleSelection,
    coverStyle: result.order.coverStyle,
    copyNames: result.order.copyNames,
    subtotalCents: result.order.subtotalCents,
    shippingCents: result.order.shippingCents,
    totalCents: result.order.totalCents,
    portalToken: result.portalToken,
    portalUrl: result.portalUrl,
    databaseConfigured: result.databaseConfigured,
  });
}
