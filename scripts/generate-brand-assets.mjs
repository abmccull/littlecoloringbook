#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";

loadEnv();

const API = process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

if (!KEY) { console.error("No GEMINI_API_KEY"); process.exit(1); }

const OUT = "campaigns/fb-page-warmup/brand";
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const PROMPTS = [
  {
    filename: "profile-photo.png",
    aspectRatio: "1:1",
    prompt: `Warm, playful brand mark for "little color book", a personalized coloring-book company that turns family photos into coloring pages for kids ages 2–10. Illustration: a small open coloring book with a single crayon resting across the pages, rendered in friendly cartoon line-art style with bright accent dots of coral, apricot, sunshine yellow, and mint green. Cream paper background. Simple, bold, recognizable at 40x40 pixels. No text. Square composition, centered.`,
  },
  {
    filename: "cover-photo.png",
    aspectRatio: "16:9",
    prompt: `Editorial flat-lay banner for "little color book". Top-down photograph style of a cream-colored wooden desk surface with: 4–5 partially finished coloring pages spread across it (some with children, some with pets, some with family portraits, rendered in clean black-and-white line art), a small cluster of pastel crayons and colored pencils, and a child's small hand barely peeking in from the upper right corner holding a bright coral crayon. Warm afternoon window light from the left. Premium, tactile, cozy feel. Wide horizontal composition — the left third should be simpler/emptier so the Facebook profile circle overlaying the lower-left doesn't obscure detail. No text.`,
  },
];

async function render({ filename, aspectRatio, prompt }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["Image"], imageConfig: { aspectRatio } },
  };
  const res = await fetch(`${API}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const payload = await res.json();
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const inline = p?.inlineData ?? p?.inline_data;
    if (inline?.data) {
      const buf = Buffer.from(inline.data, "base64");
      const path = `${OUT}/${filename}`;
      await writeFile(path, buf);
      return { path, bytes: buf.length };
    }
  }
  throw new Error("no image in response");
}

for (const spec of PROMPTS) {
  try {
    const { path, bytes } = await render(spec);
    console.log(`  ✓ ${path}  ${Math.round(bytes / 1024)}kb`);
  } catch (e) {
    console.error(`  ✗ ${spec.filename}: ${e.message}`);
  }
}
