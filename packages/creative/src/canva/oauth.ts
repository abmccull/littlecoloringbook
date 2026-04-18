import { CanvaError } from "./types";

// ─── In-memory token cache ────────────────────────────────────────────────────

type CachedToken = {
  accessToken: string;
  expiresAt: number; // ms epoch
};

let _cache: CachedToken | null = null;

/**
 * Exchange a Canva refresh_token for a short-lived access_token.
 * Caches the token for its lifetime minus a 60-second safety buffer.
 * On test environments the caller can inject `_overrideFetch` to mock HTTP.
 */
export async function getCanvaAccessToken(
  overrides?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    apiBaseUrl?: string;
    /** Injected fetch — used by tests to mock HTTP */
    fetchFn?: typeof fetch;
  },
): Promise<string> {
  const now = Date.now();

  if (_cache && _cache.expiresAt > now) {
    return _cache.accessToken;
  }

  const clientId = overrides?.clientId ?? process.env.CANVA_CLIENT_ID;
  const clientSecret = overrides?.clientSecret ?? process.env.CANVA_CLIENT_SECRET;
  const refreshToken = overrides?.refreshToken ?? process.env.CANVA_REFRESH_TOKEN;
  const apiBaseUrl =
    overrides?.apiBaseUrl ??
    process.env.CANVA_API_BASE_URL ??
    "https://api.canva.com/rest/v1";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new CanvaError(
      "CANVA_CREDENTIALS_MISSING",
      "CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REFRESH_TOKEN must all be set.",
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenUrl = `${apiBaseUrl.replace(/\/$/, "")}/oauth/token`;

  const fetchFn = overrides?.fetchFn ?? fetch;
  const response = await fetchFn(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  const body = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      throw new CanvaError(
        "CANVA_AUTH_FAILED",
        `Canva token refresh rejected (HTTP 401). Verify CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REFRESH_TOKEN are correct.`,
        401,
        body,
      );
    }
    throw new CanvaError(
      "CANVA_TOKEN_REFRESH_FAILED",
      `Canva token refresh failed with HTTP ${response.status}: ${body.slice(0, 300)}`,
      response.status,
      body,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new CanvaError(
      "CANVA_TOKEN_PARSE_ERROR",
      `Canva token endpoint returned non-JSON: ${body.slice(0, 200)}`,
    );
  }

  const data = parsed as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new CanvaError(
      "CANVA_TOKEN_MISSING",
      "Canva token response did not contain access_token.",
      response.status,
      parsed,
    );
  }

  // Cache: default 4h lifetime from Canva, minus 60-second buffer
  const expiresIn = data.expires_in ?? 14400;
  const safeExpiresAt = now + (expiresIn - 60) * 1000;

  _cache = {
    accessToken: data.access_token,
    expiresAt: safeExpiresAt,
  };

  return data.access_token;
}

/**
 * Clear the in-memory token cache. Used in tests and for forced re-auth.
 */
export function clearCanvaTokenCache(): void {
  _cache = null;
}

/**
 * Forcibly set the token cache — used in tests to pre-seed a cached state.
 */
export function setCanvaTokenCache(accessToken: string, expiresAt: number): void {
  _cache = { accessToken, expiresAt };
}
