import "server-only";

import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "./stripe";

/**
 * Canonical sequence coupon registry. If any of these promotion codes
 * is missing in Stripe, provisionMissingSequenceCoupons will create a
 * coupon + promotion code combo that matches the expected config.
 */
export const SEQUENCE_COUPONS = [
  { code: "FIRSTBOOK10", percentOff: 10, name: "First Book 10 off" },
  { code: "REPEAT15", percentOff: 15, name: "Second Book 15 off" },
  { code: "COMEBACK20", percentOff: 20, name: "Win-Back 20 off" },
  { code: "FINISHORDER10", percentOff: 10, name: "Finish Your Order 10 off" },
] as const;

export type SequenceCouponCode = (typeof SEQUENCE_COUPONS)[number]["code"];

type VerificationResult = {
  code: SequenceCouponCode;
  status: "exists" | "created" | "error";
  promotionCodeId?: string;
  couponId?: string;
  error?: string;
};

async function findPromotionCode(stripe: Stripe, code: string) {
  const list = await stripe.promotionCodes.list({ code, limit: 1, active: true });
  return list.data[0] ?? null;
}

function extractCouponId(existing: Stripe.PromotionCode): string | undefined {
  const promotion = (existing as unknown as { promotion?: { coupon?: string | { id?: string } } }).promotion;
  if (!promotion?.coupon) return undefined;
  return typeof promotion.coupon === "string" ? promotion.coupon : promotion.coupon.id;
}

async function ensureCoupon(
  stripe: Stripe,
  spec: { code: string; percentOff: number; name: string },
): Promise<VerificationResult> {
  try {
    const existing = await findPromotionCode(stripe, spec.code);
    if (existing) {
      return {
        code: spec.code as SequenceCouponCode,
        status: "exists",
        promotionCodeId: existing.id,
        couponId: extractCouponId(existing),
      };
    }

    const coupon = await stripe.coupons.create({
      name: spec.name,
      percent_off: spec.percentOff,
      duration: "once",
    });

    const promo = await stripe.promotionCodes.create({
      code: spec.code,
      promotion: { type: "coupon", coupon: coupon.id },
      active: true,
    });

    return {
      code: spec.code as SequenceCouponCode,
      status: "created",
      promotionCodeId: promo.id,
      couponId: coupon.id,
    };
  } catch (error) {
    return {
      code: spec.code as SequenceCouponCode,
      status: "error",
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * Verify all sequence coupons exist in Stripe; create missing ones.
 * Call at admin deploys, or from a boot-time assertion in staging.
 */
export async function provisionMissingSequenceCoupons(): Promise<VerificationResult[]> {
  if (!isStripeConfigured()) {
    return SEQUENCE_COUPONS.map((spec) => ({
      code: spec.code,
      status: "error",
      error: "stripe_not_configured",
    }));
  }

  const stripe = getStripe();
  const results: VerificationResult[] = [];
  for (const spec of SEQUENCE_COUPONS) {
    const r = await ensureCoupon(stripe, spec);
    results.push(r);
  }
  return results;
}
