#!/usr/bin/env node
// Fire 20 parallel Gemini calls using prompt v2026-04-19.d against the SAME
// 20 sources as the v.c batch — so we can directly compare 75% (v.c) vs v.d
// with the new front-loaded OUTPUT CONTRACT + automated post-gen QC + targeted
// correction retry.
//
// QC logic mirrors packages/pipeline/src/coloring-page-qc.ts. Keep in sync
// when the pipeline copy changes.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";

loadEnv();

const INPUT_DIR = "marketing/assets/website-proof-photo-library/images";
const OUTPUT_DIR = "test-results/prompt-v2026-04-19d-batch2";
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const PROMPT_VERSION = "2026-04-19.d";
const MAX_ATTEMPTS = 3;

const TIER_1_MODEL = "gemini-2.5-flash-image";
const TIER_2_MODEL = "gemini-3.1-flash-image-preview";
const TIER_3_MODEL = "gemini-3-pro-image-preview";
const ESCALATION_LADDER = [TIER_1_MODEL, TIER_2_MODEL, TIER_3_MODEL];
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const BASE_URL = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";

if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env");
  process.exit(1);
}

// Batch 2 — fresh 20 sources. 10 never-tested against ANY prompt version,
// plus 10 that were only tested with older v.a/v.b prompts. None overlap
// with the v.c/v.d batch 1. Mix of 7 family + 7 kids + 6 pets.
const SOURCES = [
  "03-family--75ZH3qgFKg.jpg",
  "07-family-rpOa7uF3UL4.jpg",
  "12-family-t5juxkBrQwY.jpg",
  "16-family-0oZ7Nas7x4Q.jpg",
  "01-family-wa8Vb6On37Q.jpg",
  "09-family-1eA2_18Mazc.jpg",
  "15-family-eHOZjZEx7u8.jpg",
  "23-kids-jxFtn0SE12A.jpg",
  "29-kids-bpVMoLr0cdc.jpg",
  "20-kids-n9R0MN3XGvY.jpg",
  "25-kids-r2g0RhcixOM.jpg",
  "30-kids-vwqRT8wST4s.jpg",
  "32-kids-Ulpl45vyXhM.jpg",
  "22-kids-RDQl9ZX5Yq8.jpg",
  "37-pets-nwe2qgAhT4k.jpg",
  "40-pets-pw2eI1iVNgk.jpg",
  "43-pets-5_nJw3UUgpQ.jpg",
  "46-pets-nM4gJR-7RWQ.jpg",
  "36-pets-7Dn0hmvnCh8.jpg",
  "42-pets-vXjNwYi2B8M.jpg",
];

const COMPOSITION_GOALS = [
  "if the photo shows a real environment around the subjects, include it — plants, animals, buildings, furniture, props — as clean colorable line-art shapes; if the background is plain, studio, or blurred, keep it minimal and let the subject stand on clean paper",
  "keep faces large and readable; when the photo includes a real setting, render the scene behind them as simplified colorable outlines; when the background is a studio backdrop or bokeh, leave it empty",
  "translate only what is actually visible in the photograph into line art — subjects plus any real pets, nearby objects, landscape, or interior details that are genuinely present, nothing invented",
  "when the original setting is visible (landscape, room, street, park), layer it behind the subjects as a clean colorable backdrop; when the original background is plain or out-of-focus, preserve that simplicity",
  "when the photo contains real contextual props, weather, flora, or small details, outline them faithfully; do not add environmental storytelling that is not in the source image",
  "preserve the real sense of place from the photo — recognizable architectural or natural features if they exist, or a clean studio-style presentation if the source is a portrait",
];

const VIOLATION_CORRECTIONS = {
  color_present:
    "The previous output contained color pixels. Output MUST be pure black and white only — no blue, green, red, yellow, brown, tan, or any hue. Every pixel must be either black ink or white paper.",
  gray_wash_present:
    "The previous output filled faces, skin, fur, or clothing with gray tonal wash or halftone shading. Remove ALL gray fill. These areas must be clean white paper bounded by black outline strokes only — no gray fill anywhere on the page.",
  solid_black_region_present:
    "The previous output filled a region solid black (T-shirt, fur patch, eye mask, clothing, or similar). Break that region into open colorable shapes bounded by thin black outlines. Even dark clothing and dark fur markings must be colorable white spaces with only outlines, not solid black fills.",
  not_line_art:
    "The previous output looked like a pencil sketch or photo-filter of the source photograph, not clean coloring book line art. Redo as clean continuous black outline strokes on plain white paper — no photographic texture, no soft gradients, no pencil shading, no sketchy hatching. Every mark must be a deliberate closed contour.",
};

const THRESHOLDS = {
  colorSaturationRatio: 0.005,
  grayMidtoneRatio: 0.07,
  solidBlackRegionRatio: 0.008,
  lineArtRatioMin: 0.7,
};

function buildPrompt({ sourceLabel, compositionGoal, qcCorrection, attempt }) {
  const retryLine = qcCorrection
    ? `RETRY CORRECTION — the previous attempt failed automated QC. ${qcCorrection} Fix these specific issues in this attempt.`
    : attempt > 0
      ? "The previous result was not premium enough. Tighten the closed contours, enlarge and clarify the faces, and only include environmental details that are actually visible in the source photo — do not invent a scene that isn't there."
      : null;

  return [
    "OUTPUT CONTRACT — this is the single most important instruction. The output must be a pure black-and-white line drawing on white paper, suitable for a child to color with crayons. The output is NOT a photo, NOT a sketch, NOT a pencil drawing, NOT a filtered photograph. The output contains only: (1) black ink outline strokes and (2) white paper. Nothing else.",
    "HARD RULES — all four must hold or the page is rejected:",
    "  RULE 1 (NO COLOR): The image must be monochrome. No hues, no tints, no colored backgrounds, no blue, green, red, yellow, brown, or any color whatsoever. Only black and white pixels.",
    "  RULE 2 (NO GRAY FILL): No gray shading, no tonal wash, no halftones, no stippling, no crosshatching anywhere on the page. No area may be filled with gray, tan, beige, or any mid-tone. Faces, skin, hair, fur, muzzles, clothing, and backgrounds must remain clean white paper between black outline strokes. Suggest tonality with outline detail only, never with fill.",
    "  RULE 3 (NO SOLID BLACK FILLS): No region of the image may be filled solid black — not T-shirts, not dark fur patches, not dark eye masks, not dark clothing, not dark furniture, not dark backgrounds, not dark foliage. Even when the source photo shows a region as nearly black, break it into open colorable shapes bounded by black outlines. A child must be able to color every single region of the page.",
    "  RULE 4 (LINE ART ONLY): The output must read as clean coloring-book line art, not as a photo-sketch or pencil-rendering of the photograph. Every mark is a deliberate black contour stroke. No photographic texture, no soft gradients, no smudges, no sketchy hatching.",
    "Now, within those hard rules, make the page:",
    "Priority order — spend ink in this order: (1) recognizable, expressive faces with clearly drawn eyes (including pupils and brows), nose, mouth, and hair; (2) subject bodies, clothing, and pose; (3) any environmental details that actually exist in the source photo; (4) overall clean closed contours with consistent line weight. Never let scenery compete with facial features.",
    "Keep the real people or pets from the photo recognizable.",
    `Composition goal: ${compositionGoal}.`,
    "Preserve the subject's pose, expression, clothing, hair, and overall identity from the original photo.",
    "Faces are the highest-priority element. Draw every face with enough line detail to be clearly recognizable and expressive, with pupils inside the eyes, a readable nose, and a readable mouth.",
    "Do not hallucinate backgrounds. Render only the environmental details that are actually visible in the source photo. If the source background is plain, solid-color, studio-lit, paper backdrop, blurred bokeh, or otherwise minimal, keep the background empty or near-empty in the coloring page. Do NOT invent plants, trees, grass, vegetation, buildings, furniture, props, weather, clouds, landscapes, rooms, or any scene elements that do not appear in the original photograph. A studio portrait should produce a studio-style coloring page with a clean empty background, not a fabricated outdoor or indoor scene.",
    "When the photo does show a real setting (landscape, room, street, park, backyard, beach, etc.), render it faithfully as clean simplified line-art shapes — the actual plants, animals, buildings, landscape, furniture, and props the subjects are with, not generic substitutes.",
    "Optimize for the strongest single sellable page the child will want to spend time coloring.",
    "Use smooth, continuous, closed black contours with medium-thick, consistent line weight.",
    "Include interesting, colorable details on elements that are actually in the photo (clothing patterns, visible toys, real foliage if the subject is outdoors, etc.) — but never fabricate details that aren't there.",
    "Keep every mark intentional and connected to something real in the source photo — avoid random floating fragments, invented decoration, or sketchy noise.",
    "Keep the image friendly and easy for a child to color: large colorable areas for faces and subjects.",
    "If the photo contains multiple people, enlarge the primary one to three subjects so each face reads clearly at coloring-book scale.",
    "Compose the artwork vertically for an 8.5 x 11 coloring page with generous outer margins and trim-safe spacing.",
    "The page should look clean on screen and be easy to print at home.",
    `Reference photo label: ${sourceLabel}.`,
    retryLine,
    "Return only the finished coloring page image — monochrome line art, no fill, no color, no solid black regions.",
  ].filter(Boolean).join("\n");
}

async function runQc(buffer) {
  const sampleSize = 512;
  const img = sharp(buffer).resize(sampleSize, sampleSize, { fit: "inside" });
  const [rgb, gray] = await Promise.all([
    img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    img.clone().removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const rgbPixels = rgb.data;
  const rgbChannels = rgb.info.channels;
  const pxCount = rgb.info.width * rgb.info.height;
  const grayPixels = gray.data;

  let coloredPixels = 0, midtonePixels = 0, pureBlackPixels = 0, pureWhitePixels = 0;
  for (let i = 0, p = 0; i < rgbPixels.length; i += rgbChannels, p += 1) {
    const r = rgbPixels[i], g = rgbPixels[i + 1], b = rgbPixels[i + 2];
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    if (sat > 0.08 && maxC > 30) coloredPixels += 1;
    const y = grayPixels[p];
    if (y <= 20) pureBlackPixels += 1;
    else if (y >= 240) pureWhitePixels += 1;
    else if (y > 80 && y < 200) midtonePixels += 1;
  }

  const colorSaturationRatio = coloredPixels / pxCount;
  const grayMidtoneRatio = midtonePixels / pxCount;
  const lineArtRatio = (pureBlackPixels + pureWhitePixels) / pxCount;
  const solidBlackRegionRatio = await largestBlackRegion(grayPixels, gray.info.width, gray.info.height);

  const violations = [];
  if (colorSaturationRatio > THRESHOLDS.colorSaturationRatio) violations.push("color_present");
  if (grayMidtoneRatio > THRESHOLDS.grayMidtoneRatio) violations.push("gray_wash_present");
  if (solidBlackRegionRatio > THRESHOLDS.solidBlackRegionRatio) violations.push("solid_black_region_present");
  if (lineArtRatio < THRESHOLDS.lineArtRatioMin) violations.push("not_line_art");

  return {
    ok: violations.length === 0,
    violations,
    metrics: { colorSaturationRatio, grayMidtoneRatio, solidBlackRegionRatio, lineArtRatio },
    correctionLine: violations.length === 0 ? null : violations.map((v) => VIOLATION_CORRECTIONS[v]).join(" "),
  };
}

async function largestBlackRegion(grayPixels, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  let largest = 0;
  const stack = [];
  for (let i = 0; i < total; i += 1) {
    if (grayPixels[i] > 25 || visited[i]) continue;
    let size = 0;
    stack.length = 0;
    stack.push(i);
    while (stack.length > 0) {
      const cur = stack.pop();
      if (visited[cur]) continue;
      if (grayPixels[cur] > 25) continue;
      visited[cur] = 1;
      size += 1;
      const x = cur % width;
      const y = (cur - x) / width;
      if (x > 0) stack.push(cur - 1);
      if (x < width - 1) stack.push(cur + 1);
      if (y > 0) stack.push(cur - width);
      if (y < height - 1) stack.push(cur + width);
    }
    if (size > largest) largest = size;
  }
  return largest / total;
}

async function callGemini({ buffer, mimeType, prompt, model }) {
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: buffer.toString("base64") } },
      ],
    }],
    generationConfig: {
      responseModalities: ["Image"],
      imageConfig: { aspectRatio: "3:4" },
    },
  };
  for (let rl = 0; rl <= 3; rl += 1) {
    const response = await fetch(`${BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 429 && rl < 3) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** rl + Math.random() * 500, 10000)));
      continue;
    }
    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${txt.slice(0, 300)}`);
    }
    const payload = await response.json();
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      const inline = p?.inlineData ?? p?.inline_data;
      if (inline?.data) return Buffer.from(inline.data, "base64");
    }
    throw new Error("Gemini did not return an image part");
  }
  throw new Error("Rate-limited out");
}

async function renderOneWithQc({ filename, compositionGoal }) {
  const inputPath = path.join(INPUT_DIR, filename);
  const srcBuffer = await readFile(inputPath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  let qcCorrection = null;
  let bestBuffer = null;
  let bestQc = null;
  const history = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const model = ESCALATION_LADDER[Math.min(attempt, ESCALATION_LADDER.length - 1)];
    const prompt = buildPrompt({ sourceLabel: filename, compositionGoal, qcCorrection, attempt });
    const t0 = Date.now();
    const out = await callGemini({ buffer: srcBuffer, mimeType, prompt, model });
    const genMs = Date.now() - t0;
    const qc = await runQc(out);
    history.push({ attempt, model, genMs, violations: qc.violations, metrics: qc.metrics });
    bestBuffer = out;
    bestQc = qc;
    if (qc.ok) break;
    qcCorrection = qc.correctionLine;
  }

  return { buffer: bestBuffer, qc: bestQc, history };
}

(async () => {
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Prompt version: ${PROMPT_VERSION} (QC + 3-tier escalation: ${ESCALATION_LADDER.join(" -> ")}, max ${MAX_ATTEMPTS} attempts)`);
  console.log(`Firing ${SOURCES.length} parallel Gemini requests...`);
  const started = Date.now();

  const results = await Promise.allSettled(SOURCES.map(async (filename, idx) => {
    const compositionGoal = COMPOSITION_GOALS[idx % COMPOSITION_GOALS.length];
    const t0 = Date.now();
    try {
      const r = await renderOneWithQc({ filename, compositionGoal });
      const outName = filename.replace(/\.(jpg|jpeg|png)$/i, ".png");
      const outPath = path.join(OUTPUT_DIR, outName);
      await writeFile(outPath, r.buffer);
      return {
        status: "ok",
        file: filename,
        compositionGoalIndex: idx % COMPOSITION_GOALS.length,
        output: outPath,
        totalMs: Date.now() - t0,
        bytes: r.buffer.length,
        attempts: r.history.length,
        finalQcOk: r.qc.ok,
        finalViolations: r.qc.violations,
        history: r.history,
      };
    } catch (e) {
      return { status: "failed", file: filename, error: String(e?.message || e), totalMs: Date.now() - t0 };
    }
  }));

  const elapsed = Date.now() - started;
  const rows = results.map((r) => r.value ?? { status: "failed", error: String(r.reason) });
  const ok = rows.filter((r) => r.status === "ok").length;
  const qcPass = rows.filter((r) => r.status === "ok" && r.finalQcOk).length;
  const qcFail = rows.filter((r) => r.status === "ok" && !r.finalQcOk).length;
  const err = rows.length - ok;
  const oneShot = rows.filter((r) => r.status === "ok" && r.attempts === 1).length;
  const retried = rows.filter((r) => r.status === "ok" && r.attempts > 1).length;

  for (const r of rows) {
    if (r.status !== "ok") {
      console.log(`  FAIL ${r.file} - ${r.error}`);
      continue;
    }
    const icon = r.finalQcOk ? "OK  " : "QC❌";
    const v = r.finalViolations?.length ? ` final-violations=[${r.finalViolations.join(",")}]` : "";
    console.log(`  ${icon} ${r.file} attempts=${r.attempts} (${r.totalMs}ms)${v}`);
    for (const h of r.history) {
      const vs = h.violations.length ? h.violations.join(",") : "ok";
      console.log(`       attempt ${h.attempt} [${h.model}] (${h.genMs}ms) qc=${vs}`);
    }
  }

  console.log(`\nDone in ${(elapsed / 1000).toFixed(1)}s.`);
  console.log(`  Generated: ${ok}/${rows.length}`);
  console.log(`  QC pass:   ${qcPass}/${rows.length}`);
  console.log(`  One-shot:  ${oneShot}/${rows.length}`);
  console.log(`  Retried:   ${retried}/${rows.length}`);
  console.log(`  QC fail after max attempts: ${qcFail}`);
  console.log(`  HTTP fail: ${err}`);

  await writeFile(MANIFEST_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    escalationLadder: ESCALATION_LADDER,
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    maxAttempts: MAX_ATTEMPTS,
    thresholds: THRESHOLDS,
    compositionGoals: COMPOSITION_GOALS,
    totalMs: elapsed,
    summary: { generated: ok, qcPass, oneShot, retried, qcFailAfterMax: qcFail, httpFail: err },
    results: rows,
  }, null, 2));
  console.log(`Manifest -> ${MANIFEST_PATH}`);

  process.exit(err > 0 ? 1 : 0);
})().catch((e) => { console.error("fatal:", e); process.exit(1); });
