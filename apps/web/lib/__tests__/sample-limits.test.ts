import { describe, expect, it } from "vitest";
import { evaluateSampleLimit, getSampleLimitPolicy } from "../sample-limits";

describe("getSampleLimitPolicy", () => {
  it("uses the default household limit when env is unset", () => {
    const policy = getSampleLimitPolicy({});

    expect(policy.maxSamplesPerEmail).toBe(1);
    expect(policy.maxSamplesPerVisitor).toBe(1);
    expect(policy.maxSamplesPerIp).toBe(4);
    expect(policy.ipWindowDays).toBe(30);
    expect(policy.bypassEmails.has("handscrapedflooring@gmail.com")).toBe(true);
    expect(policy.bypassIps.has("160.223.185.14")).toBe(true);
  });

  it("parses bypass lists and configured household limits", () => {
    const policy = getSampleLimitPolicy({
      SAMPLE_LIMIT_IP_MAX: "5",
      SAMPLE_LIMIT_IP_WINDOW_DAYS: "21",
      SAMPLE_LIMIT_BYPASS_EMAILS: " handscrapedflooring@gmail.com,TEST@example.com ",
      SAMPLE_LIMIT_BYPASS_IPS: "160.223.185.14, 203.0.113.10 ",
    });

    expect(policy.maxSamplesPerIp).toBe(5);
    expect(policy.ipWindowDays).toBe(21);
    expect(policy.bypassEmails.has("handscrapedflooring@gmail.com")).toBe(true);
    expect(policy.bypassEmails.has("test@example.com")).toBe(true);
    expect(policy.bypassIps.has("160.223.185.14")).toBe(true);
    expect(policy.bypassIps.has("203.0.113.10")).toBe(true);
  });
});

describe("evaluateSampleLimit", () => {
  it("blocks repeat emails after one sample", () => {
    const result = evaluateSampleLimit({
      email: "parent@example.com",
      visitorId: "visitor-1",
      clientIp: "203.0.113.10",
      counts: {
        emailCount: 1,
        visitorCount: 0,
        ipCount: 0,
      },
    });

    expect(result.blocked).toBe(true);
    expect(result.blockedBy).toEqual(["email"]);
  });

  it("blocks repeat browser visitors after one sample", () => {
    const result = evaluateSampleLimit({
      email: "new@example.com",
      visitorId: "visitor-1",
      clientIp: "203.0.113.10",
      counts: {
        emailCount: 0,
        visitorCount: 1,
        ipCount: 0,
      },
    });

    expect(result.blocked).toBe(true);
    expect(result.blockedBy).toEqual(["visitor"]);
  });

  it("allows up to the configured household IP limit", () => {
    const policy = getSampleLimitPolicy({
      SAMPLE_LIMIT_IP_MAX: "4",
    });

    const allowed = evaluateSampleLimit({
      email: "new@example.com",
      visitorId: "visitor-1",
      clientIp: "203.0.113.10",
      counts: {
        emailCount: 0,
        visitorCount: 0,
        ipCount: 3,
      },
      policy,
    });

    const blocked = evaluateSampleLimit({
      email: "new@example.com",
      visitorId: "visitor-2",
      clientIp: "203.0.113.10",
      counts: {
        emailCount: 0,
        visitorCount: 0,
        ipCount: 4,
      },
      policy,
    });

    expect(allowed.blocked).toBe(false);
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedBy).toEqual(["ip"]);
  });

  it("bypasses all restrictions when the email is allowlisted", () => {
    const policy = getSampleLimitPolicy({
      SAMPLE_LIMIT_BYPASS_EMAILS: "handscrapedflooring@gmail.com",
    });

    const result = evaluateSampleLimit({
      email: "handscrapedflooring@gmail.com",
      visitorId: "visitor-1",
      clientIp: "203.0.113.10",
      counts: {
        emailCount: 4,
        visitorCount: 1,
        ipCount: 20,
      },
      policy,
    });

    expect(result.blocked).toBe(false);
    expect(result.bypassed).toBe(true);
  });

  it("bypasses all restrictions when the IP is allowlisted", () => {
    const policy = getSampleLimitPolicy({
      SAMPLE_LIMIT_BYPASS_IPS: "160.223.185.14",
    });

    const result = evaluateSampleLimit({
      email: "new@example.com",
      visitorId: "visitor-1",
      clientIp: "160.223.185.14",
      counts: {
        emailCount: 1,
        visitorCount: 1,
        ipCount: 20,
      },
      policy,
    });

    expect(result.blocked).toBe(false);
    expect(result.bypassed).toBe(true);
  });

  it("returns the rolling household window in limit metadata", () => {
    const result = evaluateSampleLimit({
      email: "new@example.com",
      visitorId: "visitor-1",
      clientIp: "203.0.113.10",
      counts: {
        emailCount: 0,
        visitorCount: 0,
        ipCount: 0,
      },
      policy: getSampleLimitPolicy({
        SAMPLE_LIMIT_IP_WINDOW_DAYS: "14",
      }),
    });

    expect(result.limits.ipWindowDays).toBe(14);
  });
});
