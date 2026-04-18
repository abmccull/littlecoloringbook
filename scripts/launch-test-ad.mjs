#!/usr/bin/env node
/**
 * One-off manual script to test the full ad launch flow.
 * Fires a single real ad (paused) against the Meta sandbox/live account.
 *
 * Usage:
 *   node scripts/launch-test-ad.mjs [--dry-run]
 *
 * --dry-run  Skips all Meta API calls and prints what would happen.
 *
 * Prerequisites: META_* env vars in .env
 */

import { readFile } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env") });

const DRY_RUN = process.argv.includes("--dry-run");

const GRAPH_API_BASE = "https://graph.facebook.com";

// ─── Config ────────────────────────────────────────────────────────────────────

const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const RAW_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const PAGE_ID = process.env.META_PAGE_ID;
const PIXEL_ID = process.env.META_PIXEL_ID;
const API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v22.0";

const ACCOUNT_ID = RAW_ACCOUNT_ID?.startsWith("act_") ? RAW_ACCOUNT_ID.slice(4) : RAW_ACCOUNT_ID;

const IMAGE_PATH = resolve(process.cwd(), "campaigns/fb-page-warmup/images/44-pets-VzG64C5T7p4.png");
const LINK_URL = "https://littlecoloringbook.com/free-sample";

// ─── Validate env ──────────────────────────────────────────────────────────────

if (!TOKEN || !ACCOUNT_ID || !PAGE_ID) {
  console.error("ERROR: Missing META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID, or META_PAGE_ID in .env");
  process.exit(1);
}

if (!PIXEL_ID) {
  console.warn("WARN: META_PIXEL_ID not set — promoted_object (pixel) will be omitted.");
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function graphPost(path, body) {
  const url = `${GRAPH_API_BASE}/${API_VERSION}/${path}`;
  const payload = { ...body, access_token: TOKEN };
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] POST ${url}`);
    console.log("  Body:", JSON.stringify(payload, null, 2).split("\n").slice(0, 10).join("\n"));
    return { id: `dry-run-${Math.random().toString(36).slice(2, 10)}` };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Non-JSON: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(`Graph API error (${res.status}): ${JSON.stringify(parsed?.error ?? parsed)}`);
  return parsed;
}

async function uploadImage(imagePath) {
  const imageBuffer = await readFile(imagePath);
  const filename = basename(imagePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Multipart POST adimages — file: ${filename}`);
    return { hash: "dry-run-hash-abc123" };
  }

  const form = new FormData();
  form.append("access_token", TOKEN);
  form.append("filename", new Blob([imageBuffer], { type: mimeType }), filename);

  const url = `${GRAPH_API_BASE}/${API_VERSION}/act_${ACCOUNT_ID}/adimages`;
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Non-JSON: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(`adimages upload failed: ${JSON.stringify(parsed?.error ?? parsed)}`);

  const images = parsed.images ?? {};
  const firstKey = Object.keys(images)[0];
  const hash = firstKey ? images[firstKey]?.hash : null;
  if (!hash) throw new Error(`No hash in adimages response: ${text.slice(0, 300)}`);
  return { hash };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const adsManagerBase = `https://www.facebook.com/adsmanager/manage/campaigns?act=${ACCOUNT_ID}`;

console.log("=".repeat(60));
console.log("Little Color Book — Test Ad Launch Script");
console.log(DRY_RUN ? "MODE: DRY-RUN (no real API calls)" : "MODE: LIVE");
console.log("=".repeat(60));
console.log();

// Step 1: Campaign
console.log("Step 1/5: Creating campaign...");
const campaign = await graphPost(`act_${ACCOUNT_ID}/campaigns`, {
  name: "LCB Test Launch",
  objective: "OUTCOME_SALES",
  status: "PAUSED",
  special_ad_categories: [],
});
console.log(`  Campaign ID: ${campaign.id}`);
console.log();

// Step 2: Upload image
console.log("Step 2/5: Uploading image...");
console.log(`  Path: ${IMAGE_PATH}`);
const { hash: imageHash } = await uploadImage(IMAGE_PATH);
console.log(`  Image hash: ${imageHash}`);
console.log();

// Step 3: Ad creative
console.log("Step 3/5: Creating ad creative...");
const creative = await graphPost(`act_${ACCOUNT_ID}/adcreatives`, {
  name: "LCB Test Creative",
  object_story_spec: {
    page_id: PAGE_ID,
    link_data: {
      link: LINK_URL,
      message: "What if your kids could color memories, not cartoons?\n\nLittle Color Book turns your favorite family photos into hand-crafted coloring page art. Perfect for rainy days, road trips, and quiet afternoons.",
      image_hash: imageHash,
      call_to_action: { type: "SHOP_NOW", value: { link: LINK_URL } },
    },
  },
});
console.log(`  Creative ID: ${creative.id}`);
console.log();

// Step 4: Ad set
console.log("Step 4/5: Creating ad set ($5/day, US 25-55)...");
const adSetBody = {
  campaign_id: campaign.id,
  name: "LCB Test Ad Set — US/CA/UK/AU 25-70",
  daily_budget: 500,
  optimization_goal: "OFFSITE_CONVERSIONS",
  billing_event: "IMPRESSIONS",
  targeting: {
    geo_locations: { countries: ["US", "CA", "GB", "AU"] },
    age_min: 25,
    age_max: 70,
  },
  status: "PAUSED",
};
if (PIXEL_ID) {
  adSetBody.promoted_object = { pixel_id: PIXEL_ID, custom_event_type: "PURCHASE" };
}
const adSet = await graphPost(`act_${ACCOUNT_ID}/adsets`, adSetBody);
console.log(`  Ad Set ID: ${adSet.id}`);
console.log();

// Step 5: Ad
console.log("Step 5/5: Creating ad (PAUSED)...");
const ad = await graphPost(`act_${ACCOUNT_ID}/ads`, {
  adset_id: adSet.id,
  name: "LCB Test Ad — 44 Pets",
  creative: { creative_id: creative.id },
  status: "PAUSED",
});
console.log(`  Ad ID: ${ad.id}`);
console.log();

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("DONE" + (DRY_RUN ? " (DRY-RUN)" : ""));
console.log();
console.log("Meta IDs:");
console.log(`  Campaign:  ${campaign.id}`);
console.log(`  Ad Set:    ${adSet.id}`);
console.log(`  Creative:  ${creative.id}`);
console.log(`  Ad:        ${ad.id}`);
console.log();
console.log("Ads Manager links:");
console.log(`  Campaigns: ${adsManagerBase}`);
console.log(`  Ad Set:    https://www.facebook.com/adsmanager/manage/adsets?act=${ACCOUNT_ID}&campaign_ids=[${campaign.id}]`);
console.log(`  Ad:        https://www.facebook.com/adsmanager/manage/ads?act=${ACCOUNT_ID}&adset_ids=[${adSet.id}]`);
console.log();
console.log("All assets created as PAUSED. Flip status to ACTIVE in Ads Manager when ready.");
console.log("=".repeat(60));
