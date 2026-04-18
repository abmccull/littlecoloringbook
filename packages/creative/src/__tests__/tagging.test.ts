import { describe, it, expect } from "vitest";
import { validateTags, tagsToTagsJson } from "../tagging.js";

describe("validateTags", () => {
  it("returns ok for fully valid tags from the taxonomy", () => {
    const result = validateTags({
      persona: "warm_millennial_mom",
      occasion: "birthday",
      format: "before_after",
      offer: "free_sample",
    });
    expect(result.ok).toBe(true);
    expect(result.unknown).toHaveLength(0);
  });

  it("returns ok for an empty tag set", () => {
    const result = validateTags({});
    expect(result.ok).toBe(true);
  });

  it("catches an unknown persona", () => {
    const result = validateTags({ persona: "non_existent_persona" });
    expect(result.ok).toBe(false);
    expect(result.unknown).toContain("persona:non_existent_persona");
  });

  it("catches an unknown occasion", () => {
    const result = validateTags({ occasion: "alien_invasion" });
    expect(result.ok).toBe(false);
    expect(result.unknown).toContain("occasion:alien_invasion");
  });

  it("catches an unknown format", () => {
    const result = validateTags({ format: "dancing_meme" });
    expect(result.ok).toBe(false);
    expect(result.unknown).toContain("format:dancing_meme");
  });

  it("catches an unknown offer code", () => {
    const result = validateTags({ offer: "mystery_bundle" });
    expect(result.ok).toBe(false);
    expect(result.unknown).toContain("offer:mystery_bundle");
  });

  it("reports multiple unknown fields", () => {
    const result = validateTags({
      persona: "alien_buyer",
      occasion: "mars_landing",
    });
    expect(result.ok).toBe(false);
    expect(result.unknown).toHaveLength(2);
  });

  it("passes grandparent_gift occasion", () => {
    const result = validateTags({ occasion: "grandparent_gift" });
    expect(result.ok).toBe(true);
  });

  it("passes grandma_gift_buyer persona", () => {
    const result = validateTags({ persona: "grandma_gift_buyer" });
    expect(result.ok).toBe(true);
  });

  it("passes proof_montage format", () => {
    const result = validateTags({ format: "proof_montage" });
    expect(result.ok).toBe(true);
  });

  it("passes print_solo offer", () => {
    const result = validateTags({ offer: "print_solo" });
    expect(result.ok).toBe(true);
  });

  // Fields not in taxonomy vocabulary (concept, cta, visual_style, etc.) are
  // free-form and should not fail validation.
  it("does not validate free-form fields like concept or cta", () => {
    const result = validateTags({
      concept: "any free text",
      cta: "anything goes",
      visual_style: "whatever",
      audience_tag: "family",
    });
    expect(result.ok).toBe(true);
  });
});

describe("tagsToTagsJson", () => {
  it("strips undefined keys from output", () => {
    const result = tagsToTagsJson({ concept: "family", persona: undefined });
    expect(result).toEqual({ concept: "family" });
    expect("persona" in result).toBe(false);
  });

  it("preserves all provided keys", () => {
    const result = tagsToTagsJson({
      concept: "pet-book",
      format: "before_after",
      persona: "warm_millennial_mom",
      occasion: "birthday",
      offer: "free_sample",
      hook_family: "transformation_reveal",
      cta: "Try one free",
      visual_style: "flat_illustration",
      audience_tag: "pets",
    });
    expect(result.concept).toBe("pet-book");
    expect(result.format).toBe("before_after");
    expect(result.persona).toBe("warm_millennial_mom");
    expect(result.occasion).toBe("birthday");
    expect(result.offer).toBe("free_sample");
    expect(result.hook_family).toBe("transformation_reveal");
    expect(result.cta).toBe("Try one free");
    expect(result.visual_style).toBe("flat_illustration");
    expect(result.audience_tag).toBe("pets");
  });

  it("returns empty object when all fields are undefined", () => {
    const result = tagsToTagsJson({});
    expect(result).toEqual({});
  });
});
