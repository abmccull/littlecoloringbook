#!/usr/bin/env node
// Pull real Lulu production + shipping costs for the spiral-bound coloring
// book SKU across 30 / 50 / 100 page tiers, quantity 1, shipped to a US
// address. Prints per-tier line-item cost so we can replace the 40%
// placeholder in apps/web/lib/metrics.ts + refund-tier.ts with reality.

import { config as loadEnv } from "dotenv";
loadEnv();

const KEY = process.env.LULU_CLIENT_KEY;
const SECRET = process.env.LULU_CLIENT_SECRET;
const BASE = (process.env.LULU_API_BASE_URL || "https://api.lulu.com").replace(/\/$/, "");
const TOKEN_URL = process.env.LULU_AUTH_TOKEN_URL;
const POD_PACKAGE_ID = process.env.LULU_POD_PACKAGE_ID;

if (!KEY || !SECRET || !TOKEN_URL || !POD_PACKAGE_ID) {
  console.error("Missing Lulu env vars. Need LULU_CLIENT_KEY, LULU_CLIENT_SECRET, LULU_AUTH_TOKEN_URL, LULU_POD_PACKAGE_ID.");
  process.exit(1);
}

const PAGE_TIERS = [30, 50, 100];
const QUANTITY = 1;
const SHIPPING_LEVELS = ["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"];
const SHIPPING_ADDRESS = {
  name: "Test Customer",
  street1: "123 Main St",
  city: "New York",
  state_code: "NY",
  country_code: "US",
  postcode: "10001",
  phone_number: "5555555555",
};

async function getAccessToken() {
  const basic = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await r.json();
  if (!r.ok || !payload.access_token) {
    console.error("Lulu token error:", r.status, payload);
    process.exit(1);
  }
  return payload.access_token;
}

async function quote(token, pageCount, shippingLevel) {
  const r = await fetch(`${BASE}/print-job-cost-calculations/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      line_items: [{ page_count: pageCount, pod_package_id: POD_PACKAGE_ID, quantity: QUANTITY }],
      shipping_address: SHIPPING_ADDRESS,
      shipping_option: shippingLevel,
    }),
  });
  const payload = await r.json();
  if (!r.ok) {
    return { error: `HTTP ${r.status}: ${JSON.stringify(payload).slice(0, 200)}` };
  }
  return payload;
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function extractCosts(payload) {
  // Lulu wraps things inconsistently; grab the common keys.
  const lineItemCostsArr = Array.isArray(payload.line_item_costs) ? payload.line_item_costs : [];
  const lineItem = lineItemCostsArr[0] || {};
  const production =
    toNum(lineItem.total_cost_excl_discounts) ??
    toNum(lineItem.cost_excl_discounts) ??
    toNum(lineItem.total_cost_excl_tax) ??
    toNum(lineItem.total_cost_incl_tax);
  const perPage = toNum(lineItem.unit_price) ?? toNum(lineItem.line_item_cost);
  const shippingCost = toNum(payload.shipping_cost?.total_cost_excl_tax) ?? toNum(payload.shipping_cost?.total_cost_incl_tax);
  const totalInclTax = toNum(payload.total_cost_incl_tax);
  const totalExclTax = toNum(payload.total_cost_excl_tax);
  const fees = toNum(payload.fees?.total_cost_excl_tax) ?? toNum(payload.fees?.total_cost_incl_tax) ?? 0;
  const tax = toNum(payload.total_tax);
  return { production, perPage, shippingCost, totalExclTax, totalInclTax, fees, tax, lineItem, raw: payload };
}

(async () => {
  console.log(`Lulu cost quote — POD: ${POD_PACKAGE_ID}`);
  console.log(`Ship to: ${SHIPPING_ADDRESS.city}, ${SHIPPING_ADDRESS.state_code} ${SHIPPING_ADDRESS.postcode}`);
  console.log();

  const token = await getAccessToken();

  for (const pageCount of PAGE_TIERS) {
    console.log(`=== ${pageCount} pages × qty ${QUANTITY} ===`);
    const byLevel = {};
    for (const level of SHIPPING_LEVELS) {
      const p = await quote(token, pageCount, level);
      if (p.error) {
        console.log(`  ${level.padEnd(14)}: ${p.error}`);
        byLevel[level] = { error: p.error };
        continue;
      }
      const c = extractCosts(p);
      byLevel[level] = c;
      const prod = c.production != null ? `$${c.production.toFixed(2)}` : "n/a";
      const ship = c.shippingCost != null ? `$${c.shippingCost.toFixed(2)}` : "n/a";
      const tot = c.totalInclTax != null ? `$${c.totalInclTax.toFixed(2)}` : "n/a";
      console.log(`  ${level.padEnd(14)}  production=${prod.padEnd(8)} shipping=${ship.padEnd(8)} total_incl_tax=${tot}`);
    }

    // Production cost is stable across shipping levels. Pull the first non-null one.
    const productionCost = Object.values(byLevel).find((v) => v.production != null)?.production;
    if (productionCost != null) {
      console.log(`  → Production cost (book-only, no shipping): $${productionCost.toFixed(2)}`);
    }
    console.log();
  }

  // Also dump the full raw response for 100pg MAIL so we can see every field.
  console.log("--- raw response shape (100pg MAIL) ---");
  const rawProbe = await quote(token, 100, "MAIL");
  console.log(JSON.stringify(rawProbe, null, 2));
})().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
