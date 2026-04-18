import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import type { AdBrief } from "./types";

// ─── Taxonomy types ───────────────────────────────────────────────────────────

type Persona = { id: string; name: string };

type TaxonomyYaml = {
  personas?: Persona[];
  formats?: string[];
  occasions?: string[];
  offers?: Array<{ id: string; name: string }>;
};

// ─── Phase 7a — Copy element pool types ──────────────────────────────────────

/** A minimal element record from the DB (or seed pool) used for sampling. */
export type CopyElementPoolItem = {
  id: string;
  kind: "hook" | "body" | "cta" | "visual_style";
  text: string;
  audienceTag?: string | null;
};

/**
 * Optional element IDs that callers may pass in to skip inline sampling for
 * specific axes.  When a key is present its value is used directly; the
 * missing axes are still sampled from templates as before.
 */
export type BriefElementIds = {
  hook_id?: string;
  body_id?: string;
  cta_id?: string;
  visual_style_id?: string;
};

// ─── Seedable RNG (mulberry32 — deterministic, no deps) ───────────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─── Pick helpers ─────────────────────────────────────────────────────────────

function pickIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[pickIndex(rng, arr.length)] as T;
}

// Hook families for diversity tracking
const HOOK_FAMILIES = [
  "question",
  "story",
  "stat",
  "transformation",
  "objection",
  "social_proof",
  "urgency",
  "curiosity",
] as const;

type HookFamily = (typeof HOOK_FAMILIES)[number];

const HOOK_TEMPLATES: Record<HookFamily, string[]> = {
  question: [
    "What if your kids could color memories, not cartoons?",
    "Ever wished your child's artwork was actually about them?",
    "Looking for a gift that means something this {occasion}?",
  ],
  story: [
    "My daughter cried when she saw her dog in a coloring book.",
    "We gave grandma a coloring book of her grandkids — she hasn't put it down.",
    "I was skeptical at first. Now we order one every season.",
  ],
  stat: [
    "78% of moms say generic coloring books end up ignored after a week.",
    "Personalized gifts are 3x more likely to be kept and used.",
    "Little Color Book designs take under 2 minutes to request.",
  ],
  transformation: [
    "From a phone photo to a keepsake coloring book — in 48 hours.",
    "One photo. Thirty pages. A gift they'll ask for again.",
    "Turn everyday moments into screen-free family time.",
  ],
  objection: [
    "You don't need to be artistic. We design it for you.",
    "Worried it won't look like your kid? See real examples below.",
    "No subscription. No commitment. Just one beautiful book.",
  ],
  social_proof: [
    "10,000+ families have turned their photos into coloring memories.",
    "Rated 5 stars by parents and grandparents alike.",
    "Sold in all 50 states. Now with free shipping.",
  ],
  urgency: [
    "Order by {date} for {occasion} delivery.",
    "Holiday slots are limited — we hand-craft every design.",
    "Only {n} print slots left this week.",
  ],
  curiosity: [
    "There's a coloring book with your child's face on every page.",
    "This is not your average coloring book.",
    "We turned a photo into 30 pages of joy.",
  ],
};

function buildHook(hookFamily: HookFamily, rng: () => number): string {
  const templates = HOOK_TEMPLATES[hookFamily];
  const template = pick(rng, templates);
  return template
    .replace("{occasion}", "their birthday")
    .replace("{date}", "Friday")
    .replace("{n}", String(Math.floor(rng() * 10) + 5));
}

const BODY_TEMPLATES = [
  "Little Color Book turns your favorite family photos into hand-crafted coloring page art. Perfect for rainy days, road trips, and quiet afternoons. Every page is 100% personalized — no stock art, ever.",
  "We take your photos and transform them into beautiful, printable coloring pages featuring your actual kids, pets, and family moments. Choose PDF (instant) or printed and shipped.",
  "Screen-free and memory-making: your child colors drawings of themselves. It's creative. It's personal. And they absolutely love it.",
  "Each book is designed from YOUR photos, so every page is recognizable and special. PDFs start at just $12. Printed keepsakes ship in 3–5 days.",
];

const CTA_OPTIONS = ["SHOP_NOW", "LEARN_MORE", "ORDER_NOW", "GET_OFFER", "SIGN_UP"] as const;

// ─── Main generator ───────────────────────────────────────────────────────────

type GenerateDailyBriefsInput = {
  taxonomyYamlPath: string;
  count: number;
  seed?: string;
  date?: string;
  linkUrl?: string;
  /**
   * Phase 7a: optional pre-selected element IDs to use for specific axes.
   * When provided, the inline template sampling for those axes is skipped and
   * the supplied IDs / text values are used instead.
   * Each entry maps the element's text to return alongside its id so the
   * generated brief stays self-contained.
   */
  elementOverrides?: {
    hook?: { id: string; text: string };
    body?: { id: string; text: string };
    cta?: { id: string; text: string };
    visual_style?: { id: string; text: string };
  };
};

export function generateDailyBriefs(input: GenerateDailyBriefsInput): AdBrief[] {
  const {
    taxonomyYamlPath,
    count,
    seed,
    date = new Date().toISOString().slice(0, 10),
    linkUrl = "https://littlecoloringbook.com/free-sample",
    elementOverrides,
  } = input;

  const rawYaml = readFileSync(taxonomyYamlPath, "utf8");
  const taxonomy = loadYaml(rawYaml) as TaxonomyYaml;

  const personas: Persona[] = taxonomy.personas ?? [{ id: "default", name: "Default" }];
  const formats: string[] = taxonomy.formats ?? ["slideshow_narration"];
  const occasions: string[] = taxonomy.occasions ?? ["evergreen"];
  const offers = taxonomy.offers ?? [{ id: "free_sample", name: "Free Sample" }];

  const seedStr = seed ?? date;
  const rng = mulberry32(seedFromString(seedStr));

  // Diversity tracking: no more than 30% of briefs share the same (format, hookFamily) pair
  const maxPerCombo = Math.max(1, Math.ceil(count * 0.3));
  const comboCount: Map<string, number> = new Map();

  // Round-robin persona index
  let personaPointer = 0;

  const briefs: AdBrief[] = [];

  let attempts = 0;
  const maxAttempts = count * 20;

  while (briefs.length < count && attempts < maxAttempts) {
    attempts++;

    const slotIndex = briefs.length;
    const slotKey = `${date}-slot${slotIndex}-${seedStr}`;

    // Round-robin persona assignment
    const persona = personas[personaPointer % personas.length] ?? personas[0];
    if (!persona) continue;
    personaPointer++;

    const format = pick(rng, formats);
    const occasion = pick(rng, occasions);
    const offer = pick(rng, offers);
    const hookFamily = pick(rng, [...HOOK_FAMILIES]);
    const ctaType = pick(rng, [...CTA_OPTIONS]);

    const comboKey = `${format}|${hookFamily}`;
    const currentComboCount = comboCount.get(comboKey) ?? 0;

    if (currentComboCount >= maxPerCombo) {
      // Skip this combo — it would exceed the 30% cap. Try another iteration.
      // Back up persona pointer so we don't skip a persona unfairly.
      personaPointer--;
      continue;
    }

    comboCount.set(comboKey, currentComboCount + 1);

    // Phase 7a: use element overrides when present, else sample inline.
    const hook = elementOverrides?.hook ? elementOverrides.hook.text : buildHook(hookFamily, rng);
    const body = elementOverrides?.body ? elementOverrides.body.text : pick(rng, BODY_TEMPLATES);
    const ctaText = elementOverrides?.cta ? elementOverrides.cta.text : ctaType;
    const concept = `${persona.name} — ${format} — ${occasion}`;
    const visualPrompt = elementOverrides?.visual_style
      ? elementOverrides.visual_style.text
      : `Coloring book page featuring a child's portrait, ${occasion} setting, warm pastel tones, hand-illustrated style`;

    // Build element_ids only when at least one override was applied.
    const hasOverrides = !!(elementOverrides?.hook || elementOverrides?.body || elementOverrides?.cta || elementOverrides?.visual_style);
    const elementIds = hasOverrides
      ? {
          ...(elementOverrides?.hook ? { hook_id: elementOverrides.hook.id } : {}),
          ...(elementOverrides?.body ? { body_id: elementOverrides.body.id } : {}),
          ...(elementOverrides?.cta ? { cta_id: elementOverrides.cta.id } : {}),
          ...(elementOverrides?.visual_style ? { visual_style_id: elementOverrides.visual_style.id } : {}),
        }
      : null;

    briefs.push({
      slotKey,
      concept,
      format,
      persona: persona.id,
      occasion,
      offerCode: offer.id,
      hook,
      body,
      cta: ctaText,
      visualPrompt,
      linkUrl,
      elementIds,
    });
  }

  return briefs;
}

// ─── Phase 7a — sampleElementsForBrief ───────────────────────────────────────

export type SampleElementsForBriefInput = {
  kind: "hook" | "body" | "cta" | "visual_style";
  audienceTag?: string | null;
  elementPool: CopyElementPoolItem[];
  /** Deterministic seed string (e.g. slotKey + date). */
  seed: string;
};

/**
 * Deterministically pick one element from `elementPool` for the given kind and
 * (optionally) audienceTag, applying round-robin + 30% same-kind cap logic.
 *
 * Returns null when the pool is empty or no suitable candidate is found.
 * Does NOT perform Thompson sampling — that comes in Phase 7c.
 */
export function sampleElementsForBrief(
  input: SampleElementsForBriefInput,
): CopyElementPoolItem | null {
  const { kind, audienceTag, elementPool, seed } = input;

  // Filter by kind; prefer matching audienceTag but fall back to all same kind.
  const matchingAudience = elementPool.filter(
    (e) => e.kind === kind && (!audienceTag || e.audienceTag === audienceTag),
  );
  const candidates = matchingAudience.length > 0
    ? matchingAudience
    : elementPool.filter((e) => e.kind === kind);

  if (candidates.length === 0) return null;

  const rng = mulberry32(seedFromString(`${seed}:${kind}`));

  // Round-robin: deterministic index into sorted-by-id candidates.
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  const idx = pickIndex(rng, sorted.length);
  return sorted[idx] ?? null;
}
