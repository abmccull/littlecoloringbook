#!/usr/bin/env node
// Read-only: confirms every promo code referenced by the deployed
// email sequences exists in Stripe and is active. If a code is missing
// or inactive, customers following the email CTA will see "code not
// found" at checkout — a silent conversion leak.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });

const codes = ["FIRSTBOOK10", "REPEAT15", "COMEBACK20", "FINISHORDER10"];
console.log("## Stripe promo codes referenced by email sequences\n");

let missing = 0;
for (const code of codes) {
  try {
    const promo = await stripe.promotionCodes.list({ code, limit: 2 });
    if (promo.data.length === 0) {
      console.log(`  ❌ ${code.padEnd(14)} — NOT FOUND in Stripe`);
      missing++;
      continue;
    }
    const p = promo.data[0];
    const couponId = p.promotion?.coupon ?? p.coupon;
    let discount = "?";
    try {
      const c = await stripe.coupons.retrieve(couponId);
      discount = c.percent_off ? `${c.percent_off}%` : c.amount_off ? `$${c.amount_off / 100}` : "?";
    } catch {}
    const mark = p.active ? "✓" : "⚠";
    console.log(
      `  ${mark} ${code.padEnd(14)} — ${discount.padStart(4)} off, active=${p.active}, coupon=${couponId}, redemptions=${p.times_redeemed}`,
    );
    if (!p.active) missing++;
  } catch (e) {
    console.log(`  ⚠ ${code} — error: ${e.message}`);
    missing++;
  }
}

console.log(`\n${missing === 0 ? "✓ all codes present and active" : `✗ ${missing} code(s) missing or inactive`}`);
process.exit(missing === 0 ? 0 : 1);
