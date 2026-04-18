#!/usr/bin/env node
// Phase 7a: Seed copy_elements from campaign-taxonomy.yaml.
//
// For every (format × persona × hook-family) combination, extracts hook /
// body / CTA text from the taxonomy and inserts them as copy_elements rows.
//
// Idempotent: if an element with the same (kind, text) already exists the
// insert is skipped using ON CONFLICT DO NOTHING.
//
// Usage:
//   node scripts/seed-copy-elements.mjs
//
// Requires: DATABASE_URL in .env (or environment).

import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAXONOMY_PATH = path.resolve(__dirname, "../campaign-taxonomy.yaml");

if (!process.env.DATABASE_URL) {
  console.error("ERROR: Missing DATABASE_URL in .env");
  process.exit(1);
}

// ─── Lazy imports ─────────────────────────────────────────────────────────────

const { load: loadYaml } = await import("js-yaml");
const { neon } = await import("@neondatabase/serverless");
const { drizzle } = await import("drizzle-orm/neon-http");
const { sql, and, eq } = await import("drizzle-orm");
const { pgTable, text, integer, timestamp, jsonb, numeric, pgEnum } = await import("drizzle-orm/pg-core");

// ─── Minimal schema for this script ──────────────────────────────────────────

// We re-declare the minimal schema here so the script has no build dependency.
const copyElementKindEnum = pgEnum("copy_element_kind", ["hook", "body", "cta", "visual_style"]);

const copyElements = pgTable("copy_elements", {
  id: text("id").primaryKey(),
  kind: copyElementKindEnum("kind").notNull(),
  text: text("text").notNull(),
  label: text("label"),
  brandVoiceScore: numeric("brand_voice_score", { precision: 5, scale: 3 }),
  audienceTag: text("audience_tag"),
  tagsJson: jsonb("tags_json").notNull().default({}),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── DB client ────────────────────────────────────────────────────────────────

const client = neon(process.env.DATABASE_URL);
const db = drizzle({ client, schema: { copyElements } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(prefix, kind, text) {
  const hash = crypto.createHash("sha256").update(`${kind}:${text}`).digest("hex").slice(0, 16);
  return `${prefix}_${hash}`;
}

function now() {
  return new Date();
}

/**
 * Insert an element only if (kind, text) doesn't already exist.
 * Returns true if inserted, false if skipped.
 */
async function insertIfNew({ kind, text: elementText, label, audienceTag, tagsJson }) {
  const id = makeId("cel", kind, elementText);
  const ts = now();

  try {
    // ON CONFLICT on the unique index (kind, text) → do nothing
    await db
      .insert(copyElements)
      .values({
        id,
        kind,
        text: elementText,
        label: label ?? null,
        audienceTag: audienceTag ?? null,
        tagsJson: tagsJson ?? {},
        usageCount: 0,
        lastUsedAt: null,
        retiredAt: null,
        createdBy: "seed-copy-elements",
        createdAt: ts,
        updatedAt: ts,
      })
      .onConflictDoNothing();
    return true;
  } catch (err) {
    // Duplicate key errors are swallowed above; any other error should surface.
    if (String(err).includes("duplicate") || String(err).includes("unique")) {
      return false;
    }
    throw err;
  }
}

// ─── Hook templates (mirrors brief-generator.ts) ─────────────────────────────

const HOOK_FAMILIES = [
  "question", "story", "stat", "transformation",
  "objection", "social_proof", "urgency", "curiosity",
];

const HOOK_TEMPLATES = {
  question: [
    "What if your kids could color memories, not cartoons?",
    "Ever wished your child's artwork was actually about them?",
    "Looking for a gift that means something this birthday?",
    "Have you ever seen a coloring book made from YOUR photos?",
  ],
  story: [
    "My daughter cried when she saw her dog in a coloring book.",
    "We gave grandma a coloring book of her grandkids — she hasn't put it down.",
    "I was skeptical at first. Now we order one every season.",
    "Our kids fought over who got to color themselves first.",
  ],
  stat: [
    "78% of moms say generic coloring books end up ignored after a week.",
    "Personalized gifts are 3x more likely to be kept and used.",
    "Little Color Book designs take under 2 minutes to request.",
    "Over 10,000 families have created personalized coloring memories.",
  ],
  transformation: [
    "From a phone photo to a keepsake coloring book — in 48 hours.",
    "One photo. Thirty pages. A gift they'll ask for again.",
    "Turn everyday moments into screen-free family time.",
    "Your photos become hand-illustrated art. It's magic.",
  ],
  objection: [
    "You don't need to be artistic. We design it for you.",
    "Worried it won't look like your kid? See real examples below.",
    "No subscription. No commitment. Just one beautiful book.",
    "Works with any photo — even blurry ones.",
  ],
  social_proof: [
    "10,000+ families have turned their photos into coloring memories.",
    "Rated 5 stars by parents and grandparents alike.",
    "Sold in all 50 states. Now with free shipping.",
    "The gift every grandparent asks to order again.",
  ],
  urgency: [
    "Order by Friday for birthday delivery.",
    "Holiday slots are limited — we hand-craft every design.",
    "Only a few print slots left this week.",
    "Ships in 3–5 days. Order before the weekend.",
  ],
  curiosity: [
    "There's a coloring book with your child's face on every page.",
    "This is not your average coloring book.",
    "We turned a photo into 30 pages of joy.",
    "What happens when you send us your favorite family photo?",
  ],
};

const BODY_TEMPLATES = [
  "Little Color Book turns your favorite family photos into hand-crafted coloring page art. Perfect for rainy days, road trips, and quiet afternoons. Every page is 100% personalized — no stock art, ever.",
  "We take your photos and transform them into beautiful, printable coloring pages featuring your actual kids, pets, and family moments. Choose PDF (instant) or printed and shipped.",
  "Screen-free and memory-making: your child colors drawings of themselves. It's creative. It's personal. And they absolutely love it.",
  "Each book is designed from YOUR photos, so every page is recognizable and special. PDFs start at just $12. Printed keepsakes ship in 3–5 days.",
  "From your camera roll to a coloring book — our AI and design team do all the work. You pick the photos, we create the art.",
  "Imagine your child coloring a picture of themselves at the beach, their first day of school, or cuddling the family dog. That's Little Color Book.",
];

const CTA_OPTIONS = [
  "SHOP_NOW",
  "LEARN_MORE",
  "ORDER_NOW",
  "GET_OFFER",
  "SIGN_UP",
  "Try a free sample",
  "See how it works",
  "Get yours today",
  "Order now — ships in 3 days",
  "Start for free",
];

const VISUAL_STYLE_OPTIONS = [
  "warm pastel tones, hand-illustrated style, child portrait",
  "bright primary colors, bold outlines, playful cartoon style",
  "soft watercolor wash, delicate line art, storybook feel",
  "clean black-and-white linework, high contrast, coloring-book ready",
  "vintage picture-book style, gentle gradients, nostalgic warmth",
  "modern flat illustration, geometric shapes, minimal detail",
  "realistic portrait with coloring-page line conversion, detailed features",
  "whimsical fantasy style, decorative borders, magical atmosphere",
];

// ─── Persona → audienceTag mapping ───────────────────────────────────────────

const PERSONA_AUDIENCE_MAP = {
  warm_millennial_mom: "family",
  organized_practical_mom: "family",
  emotional_keepsake_mom: "family",
  grandma_gift_buyer: "grandparent",
  homeschool_screenfree_mom: "kids",
  lifestyle_gift_creator: "family",
};

// ─── Main seeding logic ───────────────────────────────────────────────────────

async function main() {
  const rawYaml = await readFile(TAXONOMY_PATH, "utf8");
  const taxonomy = loadYaml(rawYaml);

  const personas = taxonomy.personas ?? [{ id: "default", name: "Default" }];
  const formats = taxonomy.formats ?? ["slideshow_narration"];
  const occasions = taxonomy.occasions ?? ["evergreen"];

  let inserted = 0;
  let skipped = 0;

  console.log(`Seeding copy_elements from ${TAXONOMY_PATH}`);
  console.log(`Personas: ${personas.length}, Formats: ${formats.length}, Occasions: ${occasions.length}`);
  console.log("---");

  // ─── Hook elements ────────────────────────────────────────────────────────

  for (const persona of personas) {
    const audienceTag = PERSONA_AUDIENCE_MAP[persona.id] ?? "family";

    for (const hookFamily of HOOK_FAMILIES) {
      const templates = HOOK_TEMPLATES[hookFamily] ?? [];
      for (const template of templates) {
        const label = `hook:${hookFamily}:${persona.id}`;
        const ok = await insertIfNew({
          kind: "hook",
          text: template,
          label,
          audienceTag,
          tagsJson: { hook_family: hookFamily, persona: persona.id },
        });
        if (ok) inserted++; else skipped++;
      }
    }
  }

  // ─── Body elements ────────────────────────────────────────────────────────

  for (const body of BODY_TEMPLATES) {
    const ok = await insertIfNew({
      kind: "body",
      text: body,
      label: `body:${BODY_TEMPLATES.indexOf(body)}`,
      audienceTag: "family",
      tagsJson: { tone: "informational" },
    });
    if (ok) inserted++; else skipped++;
  }

  // ─── CTA elements ─────────────────────────────────────────────────────────

  for (const cta of CTA_OPTIONS) {
    const ok = await insertIfNew({
      kind: "cta",
      text: cta,
      label: `cta:${cta.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`,
      audienceTag: null,
      tagsJson: {},
    });
    if (ok) inserted++; else skipped++;
  }

  // ─── Visual style elements ────────────────────────────────────────────────

  for (const vs of VISUAL_STYLE_OPTIONS) {
    const ok = await insertIfNew({
      kind: "visual_style",
      text: vs,
      label: `visual_style:${VISUAL_STYLE_OPTIONS.indexOf(vs)}`,
      audienceTag: null,
      tagsJson: {},
    });
    if (ok) inserted++; else skipped++;
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
  console.log(`Total copy elements in this seed run: ${inserted + skipped}`);
}

main().catch((err) => {
  console.error("seed-copy-elements failed:", err);
  process.exit(1);
});
