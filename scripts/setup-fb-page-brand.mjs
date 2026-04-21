#!/usr/bin/env node
// One-off: finishes setting up the Little Color Book FB Page.
// 1. Upload + set profile photo
// 2. Upload + set cover photo
// 3. Set About Us copy
// 4. Publish 4 seed posts today (immediate + spread across evening)

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const PAGE_ID = process.env.META_PAGE_ID;
const TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || "v22.0"}`;

if (!PAGE_ID || !TOKEN) { console.error("Missing META_PAGE_ID or META_PAGE_ACCESS_TOKEN"); process.exit(1); }

async function post(url, body) {
  const res = await fetch(url, { method: "POST", body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function uploadImageToPhotos(imagePath, { message, scheduledUnix, published = "true" } = {}) {
  const buf = await readFile(imagePath);
  const fd = new FormData();
  fd.append("source", new Blob([buf], { type: "image/png" }), path.basename(imagePath));
  if (message) fd.append("message", message);
  fd.append("published", String(published));
  if (scheduledUnix) fd.append("scheduled_publish_time", String(scheduledUnix));
  fd.append("access_token", TOKEN);
  return post(`${API}/${PAGE_ID}/photos`, fd);
}

async function jsonPost(endpoint, params) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(params)) fd.append(k, String(v));
  fd.append("access_token", TOKEN);
  return post(`${API}${endpoint}`, fd);
}

// ── 1. Profile photo ────────────────────────────────────────────────────────
console.log("1. Uploading profile photo...");
try {
  const buf = await readFile("campaigns/fb-page-warmup/brand/profile-photo.png");
  const fd = new FormData();
  fd.append("source", new Blob([buf], { type: "image/png" }), "profile-photo.png");
  fd.append("access_token", TOKEN);
  const res = await post(`${API}/${PAGE_ID}/picture`, fd);
  console.log(`   ✓ profile: ${JSON.stringify(res)}`);
} catch (e) { console.error(`   ✗ profile: ${e.message}`); }

// ── 2. Cover photo ──────────────────────────────────────────────────────────
console.log("2. Uploading cover photo...");
try {
  const upload = await uploadImageToPhotos("campaigns/fb-page-warmup/brand/cover-photo.png", { published: "false" });
  const photoId = upload.id;
  const setRes = await jsonPost(`/${PAGE_ID}`, { cover: photoId, no_feed_story: "true" });
  console.log(`   ✓ cover set: photo_id=${photoId} result=${JSON.stringify(setRes)}`);
} catch (e) { console.error(`   ✗ cover: ${e.message}`); }

// ── 3. About Us ─────────────────────────────────────────────────────────────
console.log("3. Setting About Us...");
try {
  const about = "Personalized coloring books made from your favorite photos. Screen-free wins tonight, keepsakes for later.";
  const description = [
    "Little Color Book turns the photos already on your phone into personalized coloring pages.",
    "",
    "Upload a favorite photo. We generate a clean, printable page. Your kid colors themselves, their dog, their grandma — whoever's in the shot.",
    "",
    "The sample is free. Try one at littlecolorbook.com.",
  ].join("\n");
  const res = await jsonPost(`/${PAGE_ID}`, { about, description, website: "https://littlecolorbook.com" });
  console.log(`   ✓ about set: ${JSON.stringify(res)}`);
} catch (e) { console.error(`   ✗ about: ${e.message}`); }

// ── 4. Four seed posts today ────────────────────────────────────────────────
console.log("4. Publishing seed posts...");
const NOW = Math.floor(Date.now() / 1000);
const SEEDS = [
  {
    image: "campaigns/fb-page-warmup/images/44-pets-VzG64C5T7p4.png",
    scheduledUnix: null, // immediate
    caption: "Hi — we're Little Color Book.\n\nWe turn favorite photos into personalized coloring pages kids actually want to use. Your dog, your family, your kid's best friend — any photo, any page.\n\nA free sample is live at littlecolorbook.com. Would love to see what you make.",
  },
  {
    image: "campaigns/fb-page-warmup/images/04-family-uA3eOWuQqOc.png",
    scheduledUnix: NOW + 2 * 60 * 60 + 15 * 60, // +2h15m
    caption: "The easiest personal activity hiding in your camera roll.\n\nPick a favorite photo → we turn it into a coloring page → your kid colors themselves onto it. No account, no catch. littlecolorbook.com",
  },
  {
    image: "campaigns/fb-page-warmup/images/37-pets-nwe2qgAhT4k.png",
    scheduledUnix: NOW + 4 * 60 * 60 + 30 * 60, // +4h30m
    caption: "Real pets. Real photos. Real coloring pages.\n\nNot generic templates — actually made from your dog's photo. Try one free at littlecolorbook.com.",
  },
  {
    image: "campaigns/fb-page-warmup/images/20-kids-n9R0MN3XGvY.png",
    scheduledUnix: NOW + 6 * 60 * 60 + 45 * 60, // +6h45m
    caption: "Screen-free activity tonight. Keepsake you'll want to keep later.\n\nUpload one favorite photo — littlecolorbook.com — and we'll send you back a clean, printable page in a minute.",
  },
];

const posted = [];
for (let i = 0; i < SEEDS.length; i++) {
  const s = SEEDS[i];
  try {
    const res = await uploadImageToPhotos(s.image, {
      message: s.caption,
      scheduledUnix: s.scheduledUnix,
      published: s.scheduledUnix ? "false" : "true",
    });
    const when = s.scheduledUnix
      ? new Date(s.scheduledUnix * 1000).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
      : "now";
    console.log(`   ✓ post ${i + 1} (${when}): id=${res.id} post_id=${res.post_id ?? "-"}`);
    posted.push({ slot: i + 1, when, ...res });
  } catch (e) {
    console.error(`   ✗ post ${i + 1}: ${e.message}`);
  }
}

await writeFile("campaigns/fb-page-warmup/brand-setup-manifest.json", JSON.stringify({ completedAt: new Date().toISOString(), posted }, null, 2));
console.log("Done. Manifest → campaigns/fb-page-warmup/brand-setup-manifest.json");
