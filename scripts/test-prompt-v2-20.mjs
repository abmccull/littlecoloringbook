#!/usr/bin/env node
// One-off: fire 20 parallel Gemini calls using the new scene-preserving
// prompt (v2026-04-19.a) against a curated subset of the proof photo
// library. Writes results to test-results/prompt-v2026-04-19/ so we can
// review side-by-side against the old stripped-white outputs in
// campaigns/fb-page-warmup/images/.
//
// Prompt mirrors buildColoringPrompt() in packages/pipeline/src/index.ts
// with jobKind=sample, deliveryMode=digital, attempt=0, no childFirstName.
// Keep in sync when the source changes.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const INPUT_DIR = "marketing/assets/website-proof-photo-library/images";
const OUTPUT_DIR = "test-results/prompt-v2026-04-19b";
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const PROMPT_VERSION = "2026-04-19.b";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const BASE_URL = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";

if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env");
  process.exit(1);
}

// Curated 20: mix of family (7) / kids (7) / pets (6) across the library.
const SOURCES = [
  "01-family-wa8Vb6On37Q.jpg",
  "05-family-WUFIgDLrzQ8.jpg",
  "09-family-1eA2_18Mazc.jpg",
  "11-family-84N0eVJJuPM.jpg",
  "14-family-bpKd0gKFV1w.jpg",
  "15-family-eHOZjZEx7u8.jpg",
  "17-family-UFa5y0XKt9c.jpg",
  "20-kids-n9R0MN3XGvY.jpg",
  "22-kids-RDQl9ZX5Yq8.jpg",
  "25-kids-r2g0RhcixOM.jpg",
  "27-kids-9aR_C2KpB_Y.jpg",
  "30-kids-vwqRT8wST4s.jpg",
  "32-kids-Ulpl45vyXhM.jpg",
  "34-kids-MVdFmjGG990.jpg",
  "36-pets-7Dn0hmvnCh8.jpg",
  "39-pets-BhYlxZ5cKmc.jpg",
  "42-pets-vXjNwYi2B8M.jpg",
  "45-pets-JKdIHsDLAu8.jpg",
  "48-pets-qdBrQB_WdmA.jpg",
  "50-pets-qHfPFK16PeM.jpg",
];

// Composition goals rotate per page — for this test we use all six across
// the batch so each goal gets ~3 samples.
const COMPOSITION_GOALS = [
  "include the surrounding scene — plants, animals, buildings, furniture, props — as clean colorable line-art shapes around the subjects",
  "keep faces large and readable while rendering the full environment behind them with trees, sky, or architecture simplified into colorable outlines",
  "translate the whole photographed moment into line art — subjects plus their pets, nearby objects, landscape, and interior details",
  "layer the original setting (landscape, room, street, park) behind the subjects as a richly detailed but clean colorable backdrop",
  "capture environmental storytelling by outlining contextual props, weather, flora, and small details from the original photo",
  "preserve the scene's sense of place with recognizable architectural or natural features drawn as simplified but detailed line art",
];

function buildPrompt({ sourceLabel, compositionGoal }) {
  return [
    "Convert the provided photo into a premium black-and-white children's coloring book page with rich environmental detail.",
    "Priority order — spend ink in this order: (1) recognizable, expressive faces with clearly drawn eyes (including pupils and brows), nose, mouth, and hair; (2) subject bodies, clothing, and pose; (3) the full surrounding scene with environmental details; (4) overall clean closed contours with consistent line weight. Never let scenery compete with facial features.",
    "Keep the real people or pets from the photo recognizable.",
    `Composition goal: ${compositionGoal}.`,
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    "Faces are the highest-priority element. Draw every face with enough line detail to be clearly recognizable and expressive, with pupils inside the eyes, a readable nose, and a readable mouth. Do not let environmental detail flatten or overwhelm facial features.",
    "Stay faithful to the real setting in the photo — render the actual plants, animals, buildings, landscape, furniture, and props the subjects are with, not generic substitutes.",
    "Optimize for the strongest single sellable page by crafting a rich, story-filled scene the child will want to spend time coloring.",
    "Use smooth, continuous, closed black contours with medium-thick, consistent line weight.",
    "Render the surrounding scene — plants, trees, animals, buildings, sky, furniture, props — as clean simplified line-art shapes. The background should feel like a real illustrated environment, not a blank page.",
    "Include plenty of interesting, colorable details (foliage, clouds, bricks, patterns on clothing, small critters, toys, signage shapes) so there is lots for a child to engage with across the whole page.",
    "Do not add color, gray shading, crosshatching, halftones, stippling, sketch texture, speech bubbles, captions, borders, or text.",
    "Keep every mark intentional and connected to a scene element — avoid random floating fragments or sketchy noise, but do not strip away real environmental details.",
    "Never fill any region solid black — not dark fur, dark clothing, dark crates, dark furniture, dark foliage, or dark backgrounds. Even when the source photo shows a region as nearly black, break it into open colorable shapes with interior outlines so a child can color every area of the page.",
    "Avoid dense hatching or heavy shadow blocks in hair, fur, or clothing. Suggest dark tonality with a few clean outline strokes only.",
    "Keep the image friendly and easy for a child to color: large colorable areas for faces and subjects, with smaller detail work filling the scene around them.",
    "If the photo contains multiple people, enlarge the primary one to three subjects so each face reads clearly at coloring-book scale, then fit the wider scene around them.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    "The page should look clean on screen and be easy to print at home while preserving the full scene.",
    `Reference photo label: ${sourceLabel}.`,
    "Return only the finished coloring page image.",
  ].join("\n");
}

async function renderOne({ filename, compositionGoal }) {
  const inputPath = path.join(INPUT_DIR, filename);
  const buffer = await readFile(inputPath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  const body = {
    contents: [{
      parts: [
        { text: buildPrompt({ sourceLabel: filename, compositionGoal }) },
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
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Prompt version: ${PROMPT_VERSION}`);
  console.log(`Firing ${SOURCES.length} parallel Gemini requests...`);
  const started = Date.now();

  const results = await Promise.allSettled(SOURCES.map(async (filename, idx) => {
    const compositionGoal = COMPOSITION_GOALS[idx % COMPOSITION_GOALS.length];
    const t0 = Date.now();
    try {
      const r = await renderOne({ filename, compositionGoal });
      const outName = filename.replace(/\.(jpg|jpeg|png)$/i, ".png");
      const outPath = path.join(OUTPUT_DIR, outName);
      await writeFile(outPath, r.buffer);
      const ms = Date.now() - t0;
      return {
        status: "ok",
        file: filename,
        compositionGoalIndex: idx % COMPOSITION_GOALS.length,
        output: outPath,
        ms,
        bytes: r.buffer.length,
      };
    } catch (e) {
      return {
        status: "failed",
        file: filename,
        compositionGoalIndex: idx % COMPOSITION_GOALS.length,
        error: String(e?.message || e),
        ms: Date.now() - t0,
      };
    }
  }));

  const elapsed = Date.now() - started;
  const rows = results.map((r) => r.value ?? { status: "failed", error: String(r.reason) });
  const ok = rows.filter((r) => r.status === "ok").length;
  const fail = rows.length - ok;

  for (const r of rows) {
    const icon = r.status === "ok" ? "OK  " : "FAIL";
    const bytes = r.bytes ? `${(r.bytes / 1024).toFixed(0)}kb` : "";
    const err = r.error ? ` - ${r.error}` : "";
    const goal = typeof r.compositionGoalIndex === "number" ? ` [goal #${r.compositionGoalIndex + 1}]` : "";
    console.log(`  ${icon} ${r.file}${goal} (${r.ms}ms) ${bytes}${err}`);
  }
  console.log(`\nDone in ${(elapsed / 1000).toFixed(1)}s. ${ok} ok, ${fail} failed.`);

  await writeFile(MANIFEST_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    model: MODEL,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    compositionGoals: COMPOSITION_GOALS,
    totalMs: elapsed,
    okCount: ok,
    failCount: fail,
    results: rows,
  }, null, 2));
  console.log(`Manifest -> ${MANIFEST_PATH}`);

  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("fatal:", e); process.exit(1); });
