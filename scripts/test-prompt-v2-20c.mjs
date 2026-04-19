#!/usr/bin/env node
// One-off: fire 20 parallel Gemini calls using prompt v2026-04-19.c against
// a FRESH curated subset of the proof photo library (different from the
// batch used for v.a/v.b). This batch deliberately includes studio/portrait
// style shots so we can verify the anti-hallucination rule — the prompt
// should no longer invent scenery around plain or blurred backgrounds.
// Writes to test-results/prompt-v2026-04-19c/.
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
const OUTPUT_DIR = "test-results/prompt-v2026-04-19c";
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const PROMPT_VERSION = "2026-04-19.c";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const BASE_URL = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";

if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env");
  process.exit(1);
}

// Fresh 20 — NOT overlapping with the v.a/v.b test batch. Mix of family (7),
// kids (7), and pets (6). Pet picks intentionally include studio/plain-bg
// shots to exercise the anti-hallucination guardrail.
const SOURCES = [
  "02-family-HM1YFe2U4Qc.jpg",
  "04-family-uA3eOWuQqOc.jpg",
  "06-family-EJsgG9_mtR4.jpg",
  "08-family-J8tt6-cDee4.jpg",
  "10-family-OdSfIy_Ft8s.jpg",
  "13-family--voyJ5MBnnE.jpg",
  "18-family-tnETOdMYZfg.jpg",
  "19-kids-Ac5sm2yOLFc.jpg",
  "21-kids-40Ku-6znIdU.jpg",
  "24-kids-0kBytdDsaXc.jpg",
  "26-kids-WpS6pI9X08A.jpg",
  "28-kids-TKzRZ-suDAc.jpg",
  "31-kids-XElzSkhBd4g.jpg",
  "33-kids-cWxCPXZc7V8.jpg",
  "35-pets-x5oPmHmY3kQ.jpg",
  "38-pets-tycZhR54Ddk.jpg",
  "41-pets-K4mSJ7kc0As.jpg",
  "44-pets-VzG64C5T7p4.jpg",
  "47-pets-9Iod_2fmhu4.jpg",
  "49-pets-cwwwHfTytSI.jpg",
];

// Composition goals mirror the v.c rotation from packages/pipeline/src/index.ts.
// All six are conditional on real scene being present in the source photo.
const COMPOSITION_GOALS = [
  "if the photo shows a real environment around the subjects, include it — plants, animals, buildings, furniture, props — as clean colorable line-art shapes; if the background is plain, studio, or blurred, keep it minimal and let the subject stand on clean paper",
  "keep faces large and readable; when the photo includes a real setting, render the scene behind them as simplified colorable outlines; when the background is a studio backdrop or bokeh, leave it empty",
  "translate only what is actually visible in the photograph into line art — subjects plus any real pets, nearby objects, landscape, or interior details that are genuinely present, nothing invented",
  "when the original setting is visible (landscape, room, street, park), layer it behind the subjects as a clean colorable backdrop; when the original background is plain or out-of-focus, preserve that simplicity",
  "when the photo contains real contextual props, weather, flora, or small details, outline them faithfully; do not add environmental storytelling that is not in the source image",
  "preserve the real sense of place from the photo — recognizable architectural or natural features if they exist, or a clean studio-style presentation if the source is a portrait",
];

function buildPrompt({ sourceLabel, compositionGoal }) {
  return [
    "Convert the provided photo into a premium black-and-white children's coloring book page.",
    "Priority order — spend ink in this order: (1) recognizable, expressive faces with clearly drawn eyes (including pupils and brows), nose, mouth, and hair; (2) subject bodies, clothing, and pose; (3) any environmental details that actually exist in the source photo; (4) overall clean closed contours with consistent line weight. Never let scenery compete with facial features.",
    "Keep the real people or pets from the photo recognizable.",
    `Composition goal: ${compositionGoal}.`,
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    "Faces are the highest-priority element. Draw every face with enough line detail to be clearly recognizable and expressive, with pupils inside the eyes, a readable nose, and a readable mouth.",
    "CRITICAL — do not hallucinate backgrounds. Render only the environmental details that are actually visible in the source photo. If the source background is plain, solid-color, studio-lit, paper backdrop, blurred bokeh, or otherwise minimal, keep the background empty or near-empty in the coloring page. Do NOT invent plants, trees, grass, vegetation, buildings, furniture, props, weather, clouds, landscapes, rooms, or any scene elements that do not appear in the original photograph. A studio portrait should produce a studio-style coloring page with a clean empty background, not a fabricated outdoor or indoor scene.",
    "When the photo does show a real setting (landscape, room, street, park, backyard, beach, etc.), render it faithfully as clean simplified line-art shapes — the actual plants, animals, buildings, landscape, furniture, and props the subjects are with, not generic substitutes. Match what the camera actually captured.",
    "CRITICAL — faces, skin, hair, and pet muzzles/fur must remain clean white paper. Never fill faces, cheeks, foreheads, noses, chins, ears, skin, hair, fur, muzzles, or pet snouts with gray tone, flat shading, uniform wash, solid color, halftone, or any fill. Define these areas with outline strokes only so the child can color them with their own chosen colors. This applies to adult faces, child faces, baby faces, and all pet faces alike.",
    "Optimize for the strongest single sellable page the child will want to spend time coloring.",
    "Use smooth, continuous, closed black contours with medium-thick, consistent line weight.",
    "Include interesting, colorable details on elements that are actually in the photo (clothing patterns, visible toys, real foliage if the subject is outdoors, etc.) — but never fabricate details that aren't there.",
    "Do not add color, gray shading, crosshatching, halftones, stippling, sketch texture, speech bubbles, captions, borders, or text.",
    "Keep every mark intentional and connected to something real in the source photo — avoid random floating fragments, invented decoration, or sketchy noise.",
    "Never fill any region solid black — not dark fur, dark clothing, dark crates, dark furniture, dark foliage, or dark backgrounds. Even when the source photo shows a region as nearly black, break it into open colorable shapes with interior outlines so a child can color every area of the page.",
    "Avoid dense hatching or heavy shadow blocks in hair, fur, or clothing. Suggest dark tonality with a few clean outline strokes only.",
    "Keep the image friendly and easy for a child to color: large colorable areas for faces and subjects.",
    "If the photo contains multiple people, enlarge the primary one to three subjects so each face reads clearly at coloring-book scale.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    "The page should look clean on screen and be easy to print at home.",
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
