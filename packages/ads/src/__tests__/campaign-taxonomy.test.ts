import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import { bundledCampaignTaxonomy } from "../campaign-taxonomy";

const repoRoot = path.resolve(__dirname, "../../../../");
const yamlPath = path.join(repoRoot, "campaign-taxonomy.yaml");
const agentsPath = path.join(repoRoot, "AGENTS.md");

type TaxonomyYaml = {
  personas: Array<{ id: string; name: string }>;
  formats: string[];
  occasions: string[];
  offers: Array<{ id: string; name: string }>;
  voice_families: string[];
  pillars: string[];
  platforms: string[];
};

function loadYaml(): TaxonomyYaml {
  return yaml.load(readFileSync(yamlPath, "utf8")) as TaxonomyYaml;
}

function loadAgents(): string {
  return readFileSync(agentsPath, "utf8");
}

// AGENTS.md "Approved Personas To Test" — the starting set. These six
// names must always be present in the yaml. Additional personas (dads,
// grandpas, gift givers, etc.) are extensions and are allowed.
const AGENTS_APPROVED_PERSONAS = [
  "Warm Millennial Mom",
  "Organized Practical Mom",
  "Emotional Keepsake Mom",
  "Grandma Gift Buyer",
  "Homeschool or Screen-Free Mom",
  "Lifestyle Creator or Gift Recommender",
];

// AGENTS.md "Core Content Pillars" — exactly 5, canonical.
const AGENTS_APPROVED_PILLAR_IDS = [
  "product_proof",
  "emotional_resonance",
  "occasion_intent",
  "direct_response",
  "social_proof",
];

describe("campaign taxonomy invariants", () => {
  it("yaml parses and has required top-level keys", () => {
    const t = loadYaml();
    expect(t.personas).toBeTruthy();
    expect(t.voice_families).toBeTruthy();
    expect(t.pillars).toBeTruthy();
    expect(t.platforms).toBeTruthy();
    expect(t.offers).toBeTruthy();
    expect(t.formats).toBeTruthy();
    expect(t.occasions).toBeTruthy();
  });

  it("yaml includes every AGENTS.md-approved persona (subset check)", () => {
    const t = loadYaml();
    const names = t.personas.map((p) => p.name);
    for (const approved of AGENTS_APPROVED_PERSONAS) {
      expect(names).toContain(approved);
    }
  });

  it("yaml pillars match AGENTS.md Core Content Pillars exactly", () => {
    const t = loadYaml();
    expect([...t.pillars].sort()).toEqual([...AGENTS_APPROVED_PILLAR_IDS].sort());
  });

  it("yaml has no duplicate ids across personas, offers, occasions, formats, voice_families", () => {
    const t = loadYaml();
    const personaIds = t.personas.map((p) => p.id);
    const offerIds = t.offers.map((o) => o.id);
    expect(new Set(personaIds).size).toBe(personaIds.length);
    expect(new Set(offerIds).size).toBe(offerIds.length);
    expect(new Set(t.occasions).size).toBe(t.occasions.length);
    expect(new Set(t.formats).size).toBe(t.formats.length);
    expect(new Set(t.voice_families).size).toBe(t.voice_families.length);
  });

  it("bundled TS mirror matches the yaml for every field it copies", () => {
    const t = loadYaml();
    expect(bundledCampaignTaxonomy.personas?.map((p) => p.id).sort()).toEqual(
      t.personas.map((p) => p.id).sort(),
    );
    expect(bundledCampaignTaxonomy.offers?.map((o) => o.id).sort()).toEqual(
      t.offers.map((o) => o.id).sort(),
    );
    expect([...(bundledCampaignTaxonomy.occasions ?? [])].sort()).toEqual([...t.occasions].sort());
    expect([...(bundledCampaignTaxonomy.formats ?? [])].sort()).toEqual([...t.formats].sort());
  });

  it("every approved persona name is still named in AGENTS.md", () => {
    // If AGENTS.md is edited to remove a persona, this test fails until
    // the hardcoded list above is updated — forces a conscious decision
    // rather than silent drift.
    const agents = loadAgents();
    for (const name of AGENTS_APPROVED_PERSONAS) {
      expect(agents).toContain(name);
    }
  });
});
