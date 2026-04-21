import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { mintKlingJwt } from "../kling/jwt";

function verify(token: string, secret: string) {
  const [h, p, s] = token.split(".");
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const sigBuf = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - s.length % 4) % 4), "base64");
  return expected.equals(sigBuf);
}

function decodePayload(token: string) {
  const [, p] = token.split(".");
  const padded = p.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - p.length % 4) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

describe("mintKlingJwt", () => {
  const access = "ak_test_1234567890";
  const secret = "sk_test_super_secret_value_xxx";

  it("produces a three-segment token", () => {
    const token = mintKlingJwt({ accessKey: access, secretKey: secret });
    expect(token.split(".")).toHaveLength(3);
  });

  it("is verifiable with the same secret", () => {
    const token = mintKlingJwt({ accessKey: access, secretKey: secret });
    expect(verify(token, secret)).toBe(true);
  });

  it("fails verification with a different secret", () => {
    const token = mintKlingJwt({ accessKey: access, secretKey: secret });
    expect(verify(token, "sk_different")).toBe(false);
  });

  it("sets iss to the access key", () => {
    const token = mintKlingJwt({ accessKey: access, secretKey: secret });
    expect(decodePayload(token).iss).toBe(access);
  });

  it("sets exp to now + lifetime (default 1800s)", () => {
    const now = 1_700_000_000;
    const token = mintKlingJwt({ accessKey: access, secretKey: secret, nowSec: now });
    expect(decodePayload(token).exp).toBe(now + 1800);
  });

  it("honours custom lifetime", () => {
    const now = 1_700_000_000;
    const token = mintKlingJwt({ accessKey: access, secretKey: secret, nowSec: now, lifetimeSec: 60 });
    expect(decodePayload(token).exp).toBe(now + 60);
  });

  it("sets nbf to now - 5 for clock skew tolerance", () => {
    const now = 1_700_000_000;
    const token = mintKlingJwt({ accessKey: access, secretKey: secret, nowSec: now });
    expect(decodePayload(token).nbf).toBe(now - 5);
  });
});
