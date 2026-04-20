#!/usr/bin/env node
/**
 * Canva OAuth 2.0 (PKCE) one-shot flow.
 *
 * Captures a long-lived refresh_token for Canva's Connect API so the
 * backend creative-fulfillment pipeline can call Canva on your behalf
 * without re-prompting for user consent.
 *
 * PREREQUISITES
 * -------------
 * 1. Register a Canva Developer App at https://www.canva.com/developers/
 *    Set the redirect URI to: http://127.0.0.1:8080/callback
 * 2. Copy client_id + client_secret from the Canva app dashboard.
 * 3. Add to your local .env:
 *      CANVA_CLIENT_ID=...
 *      CANVA_CLIENT_SECRET=...
 * 4. Decide which scopes you need. Default set covers template + autofill +
 *    asset upload + design export (required for the brief types wired into
 *    the creative pipeline). Override via --scopes on the command line.
 *
 * USAGE
 * -----
 *   node scripts/canva-oauth-setup.mjs
 *
 * Optional:
 *   node scripts/canva-oauth-setup.mjs --scopes "asset:read asset:write design:content:read"
 *
 * WHAT HAPPENS
 * ------------
 * 1. Starts a local HTTP server on http://127.0.0.1:8080
 * 2. Opens the Canva authorization page in your browser
 * 3. You click "Allow"
 * 4. Canva redirects back with a temporary code
 * 5. This script exchanges the code for access_token + refresh_token
 * 6. Prints the refresh_token — copy it into Vercel production env as
 *    CANVA_REFRESH_TOKEN
 *
 * The access_token is short-lived (~4h); the refresh_token is long-lived.
 * The backend's getCanvaAccessToken() handles the refresh cycle from
 * there.
 */

import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { URL } from "node:url";
import { exec } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

loadEnv();

const CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const API_BASE = process.env.CANVA_API_BASE_URL ?? "https://api.canva.com/rest/v1";
const AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const REDIRECT_URI = "http://127.0.0.1:8080/callback";
const PORT = 8080;

const DEFAULT_SCOPES = [
  "asset:read",
  "asset:write",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "design:meta:read",
  "design:content:read",
  "design:content:write",
].join(" ");

const argScopes = process.argv.find((a) => a.startsWith("--scopes="))?.split("=")[1]
  ?? (process.argv.indexOf("--scopes") > -1 ? process.argv[process.argv.indexOf("--scopes") + 1] : null);
const SCOPES = argScopes ?? DEFAULT_SCOPES;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("ERROR: CANVA_CLIENT_ID and CANVA_CLIENT_SECRET must be set in .env before running this script.");
  console.error("Register an app at https://www.canva.com/developers/ with redirect URI http://127.0.0.1:8080/callback");
  process.exit(1);
}

// PKCE: generate code_verifier + code_challenge (S256)
function base64UrlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const codeVerifier = base64UrlEncode(randomBytes(64));
const codeChallenge = base64UrlEncode(createHash("sha256").update(codeVerifier).digest());
const state = base64UrlEncode(randomBytes(16));

const authorizeUrl = new URL(AUTH_URL);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("client_id", CLIENT_ID);
authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authorizeUrl.searchParams.set("scope", SCOPES);
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("code_challenge", codeChallenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");

function openBrowser(url) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
  exec(`${opener} "${url}"`, (err) => {
    if (err) console.log(`Could not auto-open browser. Paste this URL manually:\n${url}`);
  });
}

async function exchangeCodeForTokens(code) {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const tokenUrl = `${API_BASE.replace(/\/$/, "")}/oauth/token`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Canva token exchange failed: HTTP ${response.status} — ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

const server = createServer(async (req, res) => {
  if (!req.url) return;
  const reqUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (reqUrl.pathname !== "/callback") {
    res.writeHead(404).end("Not found");
    return;
  }

  const code = reqUrl.searchParams.get("code");
  const returnedState = reqUrl.searchParams.get("state");
  const error = reqUrl.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" })
      .end(`<h1>Authorization denied</h1><p>${error}: ${reqUrl.searchParams.get("error_description") ?? ""}</p>`);
    console.error(`Canva returned error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400).end("Missing code parameter");
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400).end("State mismatch — possible CSRF, aborting");
    console.error("State mismatch. Aborting.");
    server.close();
    process.exit(1);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token;
    const accessToken = tokens.access_token;
    const expiresIn = tokens.expires_in;

    res.writeHead(200, { "Content-Type": "text/html" }).end(`
      <html><body style="font-family: system-ui; padding: 40px; max-width: 640px;">
      <h1>✓ Canva authorized</h1>
      <p>You can close this tab. Check the terminal for the refresh token.</p>
      </body></html>
    `);

    console.log("\n========================================================");
    console.log(" CANVA OAUTH COMPLETE");
    console.log("========================================================");
    console.log("\nrefresh_token (long-lived — save this):\n");
    console.log(refreshToken);
    console.log("\n--------------------------------------------------------");
    console.log(`access_token (short-lived, ~${expiresIn}s): ${accessToken.slice(0, 20)}...`);
    console.log("--------------------------------------------------------\n");
    console.log("NEXT STEPS:");
    console.log("1. Add to your local .env:");
    console.log(`     CANVA_REFRESH_TOKEN=${refreshToken}`);
    console.log("2. Push to Vercel production:");
    console.log(`     printf "%s" "${refreshToken}" | vercel env add CANVA_REFRESH_TOKEN production`);
    console.log("3. Also push CANVA_CLIENT_ID + CANVA_CLIENT_SECRET if not already in production env.");
    console.log("4. Redeploy to activate: vercel --prod (from apps/web/)");
    console.log("\nThe backend's getCanvaAccessToken() will auto-refresh access_tokens from here on.\n");

    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(`Token exchange failed: ${err.message}`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nStarted local callback server at http://127.0.0.1:${PORT}/callback`);
  console.log("Opening Canva authorization page in your browser...\n");
  console.log(`Scopes requested: ${SCOPES}\n`);
  openBrowser(authorizeUrl.toString());
  console.log(`If the browser didn't open, paste this URL:\n${authorizeUrl.toString()}\n`);
});

// Safety timeout — close after 5 min of no callback
setTimeout(() => {
  console.error("\nTimed out waiting for Canva callback (5 min). Re-run the script.");
  server.close();
  process.exit(1);
}, 5 * 60 * 1000);
