import { describe, it, expect } from "vitest";
import { scanText, POLICY_VERSION } from "../compliance.js";

describe("scanText — compliance scanner", () => {
  // ─── Passed (clean copy) ────────────────────────────────────────────────────

  it("passes a clean caption with no issues", () => {
    const result = scanText({
      hook: "Turn your family photos into coloring pages",
      body: "A personalized keepsake your kids will love.",
      cta: "Try a free sample",
    });
    expect(result.status).toBe("passed");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("passes a caption with one exclamation mark", () => {
    const result = scanText({ hook: "Order today!", body: "Great gift idea." });
    expect(result.status).toBe("passed");
  });

  it("passes a caption mentioning personalization without age language", () => {
    const result = scanText({ body: "Personalized coloring books for the whole family." });
    expect(result.status).toBe("passed");
  });

  // ─── Personal attribute errors ──────────────────────────────────────────────

  it("rejects 'know your child'", () => {
    const result = scanText({ body: "We know your child best." });
    expect(result.status).toBe("rejected");
    expect(result.errors[0]?.code).toBe("PERSONAL_ATTR_KNOW_YOUR_CHILD");
  });

  it("rejects 'for YOUR dinosaur kid'", () => {
    const result = scanText({ hook: "Perfect for YOUR dinosaur kid." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "PERSONAL_ATTR_YOUR_DINOSAUR_KID")).toBe(true);
  });

  it("rejects 'we know you love'", () => {
    const result = scanText({ body: "We know you love personalized gifts." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "PERSONAL_ATTR_WE_KNOW_YOU_LOVE")).toBe(true);
  });

  it("rejects personal attribute about disabled family member", () => {
    const result = scanText({ body: "Great for your autistic child." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "PERSONAL_ATTR_YOUR_FAMILY_MEMBER")).toBe(true);
  });

  // ─── Fearmongering errors ────────────────────────────────────────────────────

  it("rejects screen addiction fearmongering", () => {
    const result = scanText({ body: "Stop your child's screen addiction today." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "FEARMONGERING_SCREEN_ADDICTION")).toBe(true);
  });

  it("rejects developmental harm language", () => {
    const result = scanText({ body: "Avoid developmental harm caused by screens." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "FEARMONGERING_DEVELOPMENTAL_HARM")).toBe(true);
  });

  // ─── Superlative errors ──────────────────────────────────────────────────────

  it("rejects '#1 best'", () => {
    const result = scanText({ hook: "The #1 best coloring book for kids." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "SUPERLATIVE_NUMBER_ONE_BEST")).toBe(true);
  });

  it("rejects 'world's greatest'", () => {
    const result = scanText({ body: "World's greatest gift for kids." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "SUPERLATIVE_WORLDS_GREATEST")).toBe(true);
  });

  // ─── Fake urgency errors ─────────────────────────────────────────────────────

  it("rejects '48 hours only'", () => {
    const result = scanText({ body: "Order now — 48 hours only!" });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "FAKE_URGENCY_48_HOURS")).toBe(true);
  });

  // ─── Financial / health / crypto errors ─────────────────────────────────────

  it("rejects get-rich-quick claims", () => {
    const result = scanText({ body: "Get rich quick with our program." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "FINANCIAL_CLAIM_GET_RICH")).toBe(true);
  });

  it("rejects health cure claims", () => {
    const result = scanText({ body: "This product cures disease naturally." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "HEALTH_CLAIM_CURES")).toBe(true);
  });

  // ─── Meta-specific errors ────────────────────────────────────────────────────

  it("rejects 'before and after' combined with 'child'", () => {
    const result = scanText({
      body: "See the before and after transformation for your child's photo.",
    });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "META_BEFORE_AFTER_CHILD")).toBe(true);
  });

  it("rejects 'personalized' combined with 'toddler'", () => {
    const result = scanText({ body: "Personalized coloring pages for your toddler." });
    expect(result.status).toBe("rejected");
    expect(result.errors.some((e) => e.code === "META_PERSONALIZED_AGE")).toBe(true);
  });

  // ─── Warnings ────────────────────────────────────────────────────────────────

  it("warns on excessive exclamation marks", () => {
    const result = scanText({ hook: "Order now!!!" });
    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "WARN_EXCESSIVE_EXCLAMATIONS")).toBe(true);
  });

  it("warns on all-caps word clusters", () => {
    const result = scanText({ hook: "BUY THIS BOOK TODAY it's amazing." });
    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "WARN_ALL_CAPS_WORD")).toBe(true);
  });

  it("warns on 'FREE!!!'", () => {
    const result = scanText({ hook: "Get yours FREE!!! today." });
    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "WARN_FREE_SPAM_PATTERN")).toBe(true);
  });

  it("warns on clickbait phrases", () => {
    const result = scanText({ hook: "You won't believe the results." });
    expect(result.status).toBe("warned");
    expect(result.warnings.some((w) => w.code === "WARN_CLICK_BAIT")).toBe(true);
  });

  // ─── Policy version ──────────────────────────────────────────────────────────

  it("returns the correct policy version", () => {
    const result = scanText({ hook: "Clean hook text." });
    expect(result.policyVersion).toBe(POLICY_VERSION);
    expect(result.policyVersion).toBe("2026-04-a");
  });

  // ─── Multi-field scan ────────────────────────────────────────────────────────

  it("catches errors across multiple fields", () => {
    const result = scanText({
      hook: "Great coloring books",
      body: "We know your child loves art.",
      cta: "Get rich quick — 48 hours only!",
    });
    expect(result.status).toBe("rejected");
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
