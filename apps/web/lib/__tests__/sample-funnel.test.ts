import { describe, expect, it } from "vitest";
import { getSampleIpWindowStart, getSampleResumeUrl } from "../sample-funnel";

describe("getSampleIpWindowStart", () => {
  it("subtracts the configured number of rolling window days", () => {
    const windowStart = getSampleIpWindowStart(30, new Date("2026-04-20T12:00:00.000Z"));

    expect(windowStart.toISOString()).toBe("2026-03-21T12:00:00.000Z");
  });
});

describe("getSampleResumeUrl", () => {
  it("routes completed samples to the sample preview page", () => {
    const url = getSampleResumeUrl({
      orderId: "ord_123",
      portalToken: "tok_123",
      status: "pdf_ready",
      hasPreviewAsset: true,
    });

    expect(url).toBe("/sample/tok_123");
  });

  it("routes draft and active samples back into processing", () => {
    const url = getSampleResumeUrl({
      orderId: "ord_123",
      portalToken: "tok_123",
      status: "draft",
      hasPreviewAsset: false,
    });

    expect(url).toBe("/sample/processing?token=tok_123&orderId=ord_123");
  });
});
