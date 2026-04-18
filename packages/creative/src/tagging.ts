import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { CreativeAssetTagsJson } from "./types.js";

type Taxonomy = {
  personas: Array<{ id: string }>;
  occasions: string[];
  formats: string[];
  offers: Array<{ id: string }>;
  voice_families: string[];
};

let cachedTaxonomy: Taxonomy | null = null;

function loadTaxonomy(): Taxonomy {
  if (cachedTaxonomy) return cachedTaxonomy;

  // Walk up from packages/creative/src to the monorepo root to find campaign-taxonomy.yaml.
  // fileURLToPath correctly handles Windows drive letters (avoids the /C:/C:/ double-prefix
  // that pathname gives on Windows when passed to resolve()).
  const thisDir = fileURLToPath(new URL(".", import.meta.url));
  const taxonomyPath = resolve(thisDir, "../../../campaign-taxonomy.yaml");

  const raw = readFileSync(taxonomyPath, "utf-8");
  cachedTaxonomy = yaml.load(raw) as Taxonomy;
  return cachedTaxonomy;
}

export type TagValidationResult = {
  ok: boolean;
  unknown: string[];
};

export function validateTags(tags: Partial<CreativeAssetTagsJson>): TagValidationResult {
  const taxonomy = loadTaxonomy();
  const unknown: string[] = [];

  if (tags.persona) {
    const personaIds = taxonomy.personas.map((p) => p.id);
    if (!personaIds.includes(tags.persona)) {
      unknown.push(`persona:${tags.persona}`);
    }
  }

  if (tags.occasion) {
    if (!taxonomy.occasions.includes(tags.occasion)) {
      unknown.push(`occasion:${tags.occasion}`);
    }
  }

  if (tags.format) {
    if (!taxonomy.formats.includes(tags.format)) {
      unknown.push(`format:${tags.format}`);
    }
  }

  if (tags.offer) {
    const offerIds = taxonomy.offers.map((o) => o.id);
    if (!offerIds.includes(tags.offer)) {
      unknown.push(`offer:${tags.offer}`);
    }
  }

  return { ok: unknown.length === 0, unknown };
}

export function tagsToTagsJson(
  tags: Partial<CreativeAssetTagsJson>,
): CreativeAssetTagsJson {
  // Strip undefined keys so jsonb stays clean.
  const result: CreativeAssetTagsJson = {};
  if (tags.concept !== undefined) result.concept = tags.concept;
  if (tags.format !== undefined) result.format = tags.format;
  if (tags.persona !== undefined) result.persona = tags.persona;
  if (tags.occasion !== undefined) result.occasion = tags.occasion;
  if (tags.offer !== undefined) result.offer = tags.offer;
  if (tags.hook_family !== undefined) result.hook_family = tags.hook_family;
  if (tags.cta !== undefined) result.cta = tags.cta;
  if (tags.visual_style !== undefined) result.visual_style = tags.visual_style;
  if (tags.audience_tag !== undefined) result.audience_tag = tags.audience_tag;
  return result;
}
