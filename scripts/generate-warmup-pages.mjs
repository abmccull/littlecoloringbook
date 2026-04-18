#!/usr/bin/env node
// One-off: generate 50 warm-up coloring pages from the proof photo library
// in parallel. Mirrors the production Gemini call (prompt + endpoint + retry
// pattern) without routing through the full QA pipeline.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const INPUT_DIR = "marketing/assets/website-proof-photo-library/images";
const OUTPUT_DIR = "campaigns/fb-page-warmup/images";
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const BASE_URL = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";

if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env");
  process.exit(1);
}

// Prompt is a faithful copy of buildColoringPrompt() in
// packages/pipeline/src/index.ts with jobKind=sample, deliveryMode=digital,
// no childFirstName, attempt=0.
function buildPrompt(sourceLabel) {
  return [
    "Convert the provided photo into a premium black-and-white children's coloring book page.",
    "Keep the real people or pets from the photo recognizable.",
    "Composition goal: favor a clean portrait composition over preserving every object from the photo.",
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    "Optimize for the strongest single sellable page, even if that means simplifying or removing more of the original scene.",
    "Use smooth, continuous, closed black contours with medium-thick, consistent line weight.",
    "Faces must stay readable with a few clean lines. Keep the eyes, nose, mouth, hair shape, and clothing silhouette recognizable without adding texture.",
    "Use a pure white background or at most one or two large simple grounding shapes.",
    "Do not add color, gray shading, crosshatching, halftones, stippling, sketch texture, speech bubbles, captions, borders, or text.",
    "Do not leave disconnected stray marks, floating fragments, or tiny noisy details anywhere on the page.",
    "Do not fill dark clothing, shadows, or hair with solid black. Convert dark regions into open outline shapes a child can color.",
    "Keep the image open, simple, friendly, and easy for a child to color, with large colorable areas and clear silhouettes.",
    "If the photo contains multiple people, enlarge and simplify the primary one to three subjects so each face reads clearly at coloring-book scale.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    "The page should look clean on screen and be easy to print at home.",
    `Reference photo label: ${sourceLabel}.`,
    "Return only the finished coloring page image.",
  ].join("\n");
}

async function renderOne(filename) {
  const inputPath = path.join(INPUT_DIR, filename);
  const buffer = await readFile(inputPath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  const body = {
    contents: [{
      parts: [
        { text: buildPrompt(filename) },
        { inlineData: { mimeType, data: buffer.toString("base64") } },
      ],
    }],
    generationConfig: {
      responseModalities: ["Image"],
      imageConfig: { aspectRatio: "3:4" },
    },
  };

  const maxRateLimitRetries = 3;
  let response = null;
  for (let attempt = 0; attempt <= maxRateLimitRetries; attempt++) {
    response = await fetch(`${BASE_URL}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 429 && attempt < maxRateLimitRetries) {
      const backoff = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10000);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    break;
  }

  if (!response?.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${txt.slice(0, 300)}`);
  }

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const inline = p?.inlineData ?? p?.inline_data;
    const data = inline?.data;
    if (data) {
      return { buffer: Buffer.from(data, "base64"), mimeType: inline?.mimeType ?? "image/png" };
    }
  }
  throw new Error("Gemini did not return an image part");
}

(async () => {
  const files = (await readdir(INPUT_DIR)).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();
  console.log(`Found ${files.length} photos in ${INPUT_DIR}`);
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });

  const started = Date.now();
  console.log(`Firing ${files.length} Gemini requests in parallel...`);

  const results = await Promise.allSettled(files.map(async (f) => {
    const t0 = Date.now();
    try {
      const r = await renderOne(f);
      const outName = f.replace(/\.(jpg|jpeg|png)$/i, ".png");
      const outPath = path.join(OUTPUT_DIR, outName);
      await writeFile(outPath, r.buffer);
      const ms = Date.now() - t0;
      return { status: "ok", file: f, output: outPath, ms, bytes: r.buffer.length };
    } catch (e) {
      return { status: "failed", file: f, error: String(e?.message || e), ms: Date.now() - t0 };
    }
  }));

  const elapsed = Date.now() - started;
  const rows = results.map((r) => r.value ?? { status: "failed", error: String(r.reason) });
  const ok = rows.filter((r) => r.status === "ok").length;
  const fail = rows.length - ok;

  for (const r of rows) {
    const icon = r.status === "ok" ? "OK " : "FAIL";
    const bytes = r.bytes ? `${(r.bytes / 1024).toFixed(0)}kb` : "";
    const err = r.error ? ` - ${r.error}` : "";
    console.log(`  ${icon} ${r.file} (${r.ms}ms) ${bytes}${err}`);
  }
  console.log(`\nDone in ${(elapsed / 1000).toFixed(1)}s. ${ok} ok, ${fail} failed.`);

  await writeFile(MANIFEST_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: MODEL,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    totalMs: elapsed,
    okCount: ok,
    failCount: fail,
    results: rows,
  }, null, 2));
  console.log(`Manifest -> ${MANIFEST_PATH}`);

  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("fatal:", e); process.exit(1); });
