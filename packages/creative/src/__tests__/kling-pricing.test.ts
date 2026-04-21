import { describe, it, expect } from "vitest";
import { estimateCredits, capacityInBudget } from "../kling/pricing";

describe("estimateCredits", () => {
  it("Kling 2.1 Pro at 1080p 5s ≈ 35 credits (sweet spot)", () => {
    expect(
      estimateCredits({
        model: "kling-v2-1",
        mode: "pro",
        resolution: "1080p",
        durationSec: 5,
      }),
    ).toBe(35);
  });

  it("Kling 1.6 Std at 720p 5s ≈ 10 credits (cheapest)", () => {
    expect(
      estimateCredits({
        model: "kling-v1-6",
        mode: "std",
        resolution: "720p",
        durationSec: 5,
      }),
    ).toBe(10);
  });

  it("Kling 3.0 at 1080p 5s = 40 credits", () => {
    expect(
      estimateCredits({
        model: "kling-v3-0",
        mode: "pro",
        resolution: "1080p",
        durationSec: 5,
      }),
    ).toBe(40);
  });

  it("adds audio surcharge of 3 credits/s", () => {
    expect(
      estimateCredits({
        model: "kling-v3-0",
        mode: "pro",
        resolution: "1080p",
        durationSec: 5,
        withAudio: true,
      }),
    ).toBe(55); // (8 + 3) * 5
  });

  it("throws on unknown pricing combo", () => {
    expect(() =>
      estimateCredits({
        model: "kling-v1-6",
        mode: "pro",
        resolution: "720p",
        durationSec: 5,
      }),
    ).toThrow(/Unknown Kling pricing/);
  });

  it("capacityInBudget divides correctly", () => {
    // 600 / 35 credits per clip = 17 clips
    expect(
      capacityInBudget(600, {
        model: "kling-v2-1",
        mode: "pro",
        resolution: "1080p",
        durationSec: 5,
      }),
    ).toBe(17);
  });
});
