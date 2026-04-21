import { describe, expect, it } from "vitest";
import { getPipelineRenderSettings } from "../index";

describe("getPipelineRenderSettings", () => {
  it("returns Gemini as the sole provider with no fallback", () => {
    const settings = getPipelineRenderSettings("pdf", "sample");

    expect(settings.provider).toBe("gemini");
    expect(settings.fallbackProvider).toBeNull();
    expect(settings.fallbackModel).toBeNull();
    expect(settings.model).toBeTruthy();
  });
});
