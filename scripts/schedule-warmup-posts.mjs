#!/usr/bin/env node
// Schedules warm-up posts on the Little Color Book FB Page using the
// Graph API. Safe by default: runs a dry preview unless --go is passed.
//
// Reads plan from: campaigns/fb-page-warmup/scheduled-posts.json
// Writes results to: campaigns/fb-page-warmup/posted-manifest.json
// Auth: META_PAGE_ID + META_PAGE_ACCESS_TOKEN from .env

import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const PAGE_ID = process.env.META_PAGE_ID;
const TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v22.0";

if (!PAGE_ID || !TOKEN) {
  console.error("Missing META_PAGE_ID or META_PAGE_ACCESS_TOKEN in .env");
  process.exit(1);
}

const cli = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? "true"] : null;
}).filter(Boolean));

const GO = cli.go === "true";
const PLAN_PATH = cli.plan || "campaigns/fb-page-warmup/scheduled-posts.json";
const MANIFEST_PATH = cli.manifest || "campaigns/fb-page-warmup/posted-manifest.json";
const TZ = cli.tz || "America/New_York";
// Default start = tomorrow in the chosen TZ
function defaultStartDate(tz) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(tomorrow); // YYYY-MM-DD
}
const START_DATE = cli["start-date"] || defaultStartDate(TZ);

// Convert local (tz) date+time to unix seconds
function tzLocalToUnix(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offsetMinutes = tzOffsetMinutes(tz, new Date(naiveUtcMs));
  return Math.floor((naiveUtcMs - offsetMinutes * 60 * 1000) / 1000);
}

function tzOffsetMinutes(tz, atInstant) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
  const part = dtf.formatToParts(atInstant).find((p) => p.type === "timeZoneName");
  if (!part) return 0;
  const m = part.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3] || "0", 10);
  return sign * (h * 60 + min);
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

async function uploadScheduledPhoto({ imagePath, message, scheduledUnix }) {
  const buf = await readFile(imagePath);
  const blob = new Blob([buf], { type: "image/png" });
  const fd = new FormData();
  fd.append("source", blob, path.basename(imagePath));
  fd.append("message", message);
  fd.append("published", "false");
  fd.append("scheduled_publish_time", String(scheduledUnix));
  fd.append("access_token", TOKEN);
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/photos`;
  const res = await fetch(url, { method: "POST", body: fd });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg + (body?.error?.error_subcode ? ` (subcode ${body.error.error_subcode})` : ""));
  }
  return body;
}

(async () => {
  const plan = JSON.parse(await readFile(PLAN_PATH, "utf8"));
  const posts = plan.posts;
  const nowUnix = Math.floor(Date.now() / 1000);
  const earliestAllowed = nowUnix + 10 * 60; // Graph API requires ≥10 min lead

  console.log(`Plan: ${posts.length} posts from ${PLAN_PATH}`);
  console.log(`Page: ${PAGE_ID}`);
  console.log(`Start date: ${START_DATE} (${TZ})`);
  console.log(`Mode: ${GO ? "LIVE — POSTING" : "DRY RUN (pass --go to actually schedule)"}`);
  console.log("");

  const manifest = { scheduledAt: new Date().toISOString(), startDate: START_DATE, tz: TZ, entries: [] };
  let warnings = 0;

  for (const p of posts) {
    const date = addDays(START_DATE, p.day_offset);
    const unix = tzLocalToUnix(date, p.time, TZ);
    const humanLocal = new Date(unix * 1000).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const tooSoon = unix < earliestAllowed;
    const relPath = p.image;
    const absPath = path.resolve(relPath);
    let sizeOk = false;
    try { sizeOk = (await stat(absPath)).size > 0; } catch {}

    const caption = p.captions.primary;
    const captionLen = caption.length;

    console.log(`Slot ${p.slot} — ${humanLocal}`);
    console.log(`  image: ${relPath}${sizeOk ? "" : "  MISSING"}`);
    console.log(`  unix:  ${unix}${tooSoon ? "  TOO SOON (<10min lead)" : ""}`);
    console.log(`  purpose: ${p.purpose}`);
    console.log(`  caption (${captionLen} chars): ${caption.split("\n")[0].slice(0, 90)}...`);

    if (tooSoon || !sizeOk) {
      warnings++;
      manifest.entries.push({ slot: p.slot, status: "skipped", reason: tooSoon ? "too_soon" : "image_missing", image: relPath, scheduledUnix: unix });
      console.log("  -> SKIP\n");
      continue;
    }

    if (!GO) {
      manifest.entries.push({ slot: p.slot, status: "previewed", image: relPath, scheduledUnix: unix, humanLocal });
      console.log("  -> (dry run)\n");
      continue;
    }

    try {
      const resp = await uploadScheduledPhoto({ imagePath: absPath, message: caption, scheduledUnix: unix });
      console.log(`  -> posted id=${resp.id}${resp.post_id ? ` post_id=${resp.post_id}` : ""}`);
      manifest.entries.push({ slot: p.slot, status: "scheduled", image: relPath, scheduledUnix: unix, humanLocal, metaId: resp.id, metaPostId: resp.post_id || null });
    } catch (e) {
      console.log(`  -> ERROR: ${e.message}`);
      manifest.entries.push({ slot: p.slot, status: "failed", image: relPath, scheduledUnix: unix, humanLocal, error: e.message });
      warnings++;
    }
    console.log("");
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Manifest -> ${MANIFEST_PATH}`);

  const ok = manifest.entries.filter((e) => e.status === "scheduled" || e.status === "previewed").length;
  const failed = manifest.entries.filter((e) => e.status === "failed" || e.status === "skipped").length;
  console.log(`${ok} ${GO ? "scheduled" : "previewed"}, ${failed} ${GO ? "failed/skipped" : "skipped"}`);

  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error("fatal:", e); process.exit(1); });
