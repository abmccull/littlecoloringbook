// HMAC-SHA256 JWT minter for the Kling API. Kling does NOT accept raw
// API keys — each request must carry a short-lived JWT in the
// Authorization header, signed with the SecretKey issued alongside the
// AccessKey in the dashboard.
//
// Implementing this by hand (with Node's built-in crypto) is cleaner
// than pulling in jsonwebtoken: it's ~20 lines, the claim set is
// fixed, and it avoids an extra transitive dep in the monorepo.

import { createHmac } from "node:crypto";

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type KlingJwtInput = {
  accessKey: string;
  secretKey: string;
  /** Token lifetime in seconds. Kling docs use 30 min (1800). */
  lifetimeSec?: number;
  /** Override "now" for deterministic tests. */
  nowSec?: number;
};

/**
 * Mint a Kling-compatible JWT. Payload is fixed per the Kling docs:
 *   { iss: <AccessKey>, exp: <now + 1800>, nbf: <now - 5> }
 * Signed HS256 with the SecretKey.
 */
export function mintKlingJwt(input: KlingJwtInput): string {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const lifetime = input.lifetimeSec ?? 1800;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: input.accessKey,
    exp: now + lifetime,
    nbf: now - 5,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", input.secretKey).update(signingInput).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}
