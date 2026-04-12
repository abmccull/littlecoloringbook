import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { milaSwordPlayFixture } from "../fixtures/mila-sword-play";
import { getTrim, getSpineWidth, ensurePageCountParity } from "../render/lulu-trim";
import { getStyle } from "../themes/registry";
import { getOccasion } from "../occasions/registry";
import { interpolate } from "../occasions/interpolate";
import { validateOccasionContext } from "../occasions/validate";
import { getStockCover, filterStockCovers } from "../covers/manifest";

describe("lulu-trim", () => {
  it("returns trim spec for default SKU", () => {
    const trim = getTrim();
    assert.equal(trim.widthIn, 8.5);
    assert.equal(trim.heightIn, 11);
    assert.equal(trim.bleedIn, 0.125);
  });

  it("calculates spine width from page count", () => {
    const spine = getSpineWidth(24);
    assert.ok(spine > 0);
    assert.ok(spine < 1);
  });

  it("ensures page count parity", () => {
    assert.equal(ensurePageCountParity(5), 6);
    assert.equal(ensurePageCountParity(4), 4);
  });

  it("throws on unknown SKU", () => {
    assert.throws(() => getTrim("UNKNOWN_SKU"));
  });
});

describe("styles", () => {
  it("returns storybook style", () => {
    const style = getStyle("storybook");
    assert.equal(style.id, "storybook");
    assert.equal(style.fontFamily, "Playfair Display");
    assert.equal(style.accentColor, "#6B4226");
  });

  it("returns all four styles", () => {
    for (const id of ["sunshine", "crayon", "storybook", "minimal"] as const) {
      const style = getStyle(id);
      assert.equal(style.id, id);
      assert.ok(style.fontFamily);
      assert.ok(style.accentColor);
    }
  });
});

describe("occasions", () => {
  it("returns everyday occasion", () => {
    const occ = getOccasion("everyday");
    assert.equal(occ.id, "everyday");
    assert.equal(occ.category, "everyday");
    assert.ok(occ.titleTemplate.includes("{childName}"));
  });

  it("returns birthday occasion", () => {
    const occ = getOccasion("birthday");
    assert.equal(occ.id, "birthday");
    assert.ok(occ.titleTemplate.includes("{age}"));
  });
});

describe("interpolate", () => {
  it("replaces tokens from context", () => {
    const result = interpolate("{childName} Turns {age}!", { childName: "Mila", age: 5 });
    assert.equal(result, "Mila Turns 5!");
  });

  it("replaces authorLine from extras", () => {
    const result = interpolate("Made by {authorLine}", { childName: "Mila" }, { authorLine: "Mom & Dad" });
    assert.equal(result, "Made by Mom & Dad");
  });

  it("degrades missing tokens gracefully", () => {
    const result = interpolate("{childName} at {location}", { childName: "Mila" });
    assert.equal(result, "Mila at location");
  });
});

describe("validateOccasionContext", () => {
  it("validates everyday with childName", () => {
    const occ = getOccasion("everyday");
    const result = validateOccasionContext(occ, { childName: "Mila" });
    assert.equal(result.valid, true);
    assert.equal(result.missing.length, 0);
  });

  it("fails birthday without age", () => {
    const occ = getOccasion("birthday");
    const result = validateOccasionContext(occ, { childName: "Mila" });
    assert.equal(result.valid, false);
    assert.ok(result.missing.includes("age"));
  });
});

describe("stock covers", () => {
  it("finds unicorn-garden by id", () => {
    const cover = getStockCover("unicorn-garden");
    assert.ok(cover);
    assert.equal(cover.lean, "girls");
    assert.equal(cover.ageRange, "2-4");
  });

  it("filters by age and lean", () => {
    const neutral58 = filterStockCovers({ ageRange: "5-8", lean: "neutral" });
    assert.ok(neutral58.length >= 3);
    for (const c of neutral58) {
      assert.equal(c.ageRange, "5-8");
      assert.equal(c.lean, "neutral");
    }
  });
});

describe("fixture", () => {
  it("mila-sword-play fixture is well-formed", () => {
    const f = milaSwordPlayFixture;
    assert.equal(f.style, "storybook");
    assert.equal(f.occasion, "everyday");
    assert.equal(f.occasionContext.childName, "Mila");
    assert.equal(f.pages.length, 4);
    assert.equal(f.cover.type, "customer-photo");
  });
});
