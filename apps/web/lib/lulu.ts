import "server-only";

import { getLuluBasicAuthHeader, getLuluEnv } from "@littlecolorbook/shared/env";

export const luluShippingLevels = ["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"] as const;

export type LuluShippingLevel = (typeof luluShippingLevels)[number];

export type LuluShippingAddress = {
  city: string;
  country_code: string;
  email?: string | null;
  name: string;
  phone_number: string;
  postcode: string;
  state_code?: string | null;
  street1: string;
  street2?: string | null;
};

export type LuluQuote = {
  label: string;
  level: LuluShippingLevel;
  quantity: number;
  rawPayload: Record<string, unknown>;
  service: string;
  shippingCents: number;
  totalCents: number;
  warnings: unknown[];
  window: string;
};

type LuluCreatePrintJobInput = {
  contactEmail: string;
  externalId?: string;
  lineItems: Array<{
    coverUrl: string;
    interiorUrl: string;
    quantity: number;
    title: string;
  }>;
  podPackageId?: string;
  productionDelay?: number;
  shippingAddress: LuluShippingAddress;
  shippingLevel: LuluShippingLevel;
};

type LuluQuoteInput = {
  pageCount: number;
  podPackageId?: string;
  quantity: number;
  shippingAddress: LuluShippingAddress;
};

type LuluTokenResponse = {
  access_token: string;
  expires_in: number;
};

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

const shippingWindows: Record<LuluShippingLevel, string> = {
  MAIL: "Economy service",
  PRIORITY_MAIL: "Priority mail service",
  GROUND: "Ground service",
  EXPEDITED: "Expedited service",
  EXPRESS: "Express service",
};

function parseMoneyToCents(value: unknown) {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function normalizeLuluUrl(path: string) {
  const env = getLuluEnv();
  return new URL(path.replace(/^\//, ""), `${env.luluApiBaseUrl.replace(/\/$/, "")}/`).toString();
}

function humanizeShippingLevel(level: LuluShippingLevel) {
  return level
    .split("_")
    .map((segment) => segment[0] + segment.slice(1).toLowerCase())
    .join(" ");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function isLuluShippingConfigured() {
  return Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET && process.env.LULU_POD_PACKAGE_ID);
}

export function mapQuoteServiceToLuluLevel(service: string) {
  const normalized = service.trim().toUpperCase();

  switch (normalized) {
    case "MAIL":
      return "MAIL" as const;
    case "PRIORITY_MAIL":
    case "PRIORITY":
      return "PRIORITY_MAIL" as const;
    case "EXPEDITED":
      return "EXPEDITED" as const;
    case "EXPRESS":
      return "EXPRESS" as const;
    case "GROUND":
    default:
      return "GROUND" as const;
  }
}

async function getLuluAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const env = getLuluEnv();
  const response = await fetch(env.luluAuthTokenUrl, {
    method: "POST",
    headers: {
      Authorization: getLuluBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as LuluTokenResponse | Record<string, unknown> | null;

  if (!response.ok || !payload || typeof payload !== "object" || !("access_token" in payload)) {
    throw new Error(`Failed to retrieve Lulu access token (${response.status}).`);
  }

  const token = payload.access_token as string;
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  tokenCache = {
    accessToken: token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return token;
}

async function luluRequest<T>(path: string, init?: RequestInit) {
  const accessToken = await getLuluAccessToken();
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Cache-Control", "no-cache");

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(normalizeLuluUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T | Record<string, unknown>) : ({} as T);

  if (!response.ok) {
    const errorPayload = asRecord(payload);
    const detail =
      (typeof errorPayload?.detail === "string" && errorPayload.detail) ||
      (typeof errorPayload?.message === "string" && errorPayload.message) ||
      `Lulu request failed with status ${response.status}.`;
    throw new Error(detail);
  }

  return payload as T;
}

export async function quoteLuluShippingOptions(input: LuluQuoteInput) {
  const env = getLuluEnv();
  const podPackageId = input.podPackageId ?? env.luluPodPackageId;

  if (!podPackageId) {
    throw new Error("LULU_POD_PACKAGE_ID is required to calculate shipping quotes.");
  }

  const settled = await Promise.allSettled(
    luluShippingLevels.map(async (level) => {
      const payload = (await luluRequest<Record<string, unknown>>("/print-job-cost-calculations/", {
        method: "POST",
        body: JSON.stringify({
          line_items: [
            {
              page_count: input.pageCount,
              pod_package_id: podPackageId,
              quantity: input.quantity,
            },
          ],
          shipping_address: input.shippingAddress,
          shipping_option: level,
        }),
      })) as Record<string, unknown>;

      const shippingCost = asRecord(payload.shipping_cost);
      const shippingCents = parseMoneyToCents(shippingCost?.total_cost_incl_tax ?? shippingCost?.total_cost_excl_tax);
      const totalCents = parseMoneyToCents(payload.total_cost_incl_tax ?? payload.total_cost_excl_tax);
      const warnings = Array.isArray(asRecord(payload.shipping_address)?.warnings)
        ? (asRecord(payload.shipping_address)?.warnings as unknown[])
        : [];

      return {
        label: humanizeShippingLevel(level),
        level,
        quantity: input.quantity,
        rawPayload: payload,
        service: level.toLowerCase(),
        shippingCents,
        totalCents,
        warnings,
        window: shippingWindows[level],
      } satisfies LuluQuote;
    }),
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<LuluQuote> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((quote) => quote.shippingCents > 0);
}

export async function createLuluPrintJob(input: LuluCreatePrintJobInput) {
  const env = getLuluEnv();
  const podPackageId = input.podPackageId ?? env.luluPodPackageId;

  if (!podPackageId) {
    throw new Error("LULU_POD_PACKAGE_ID is required to create a print job.");
  }

  const payload = (await luluRequest<Record<string, unknown>>("/print-jobs/", {
    method: "POST",
    body: JSON.stringify({
      contact_email: input.contactEmail,
      external_id: input.externalId,
      line_items: input.lineItems.map((lineItem, index) => ({
        external_id: `${input.externalId ?? "littlecolorbook"}-item-${index + 1}`,
        printable_normalization: {
          cover: {
            source_url: lineItem.coverUrl,
          },
          interior: {
            source_url: lineItem.interiorUrl,
          },
          pod_package_id: podPackageId,
        },
        quantity: lineItem.quantity,
        title: lineItem.title,
      })),
      production_delay: input.productionDelay ?? 120,
      shipping_address: input.shippingAddress,
      shipping_level: input.shippingLevel,
    }),
  })) as Record<string, unknown>;

  const providerJobId = payload.id ?? payload.print_job_id;

  if (typeof providerJobId !== "string" && typeof providerJobId !== "number") {
    throw new Error("Lulu did not return a print job identifier.");
  }

  return {
    providerJobId: String(providerJobId),
    rawPayload: payload,
    costCents: extractLuluTotalCostCents(payload),
  };
}

/**
 * Pull total print-job cost from a Lulu response payload. Lulu returns
 * an object like { costs: { total_cost_incl_tax: "12.30", ... } } on
 * newer API versions. Older responses expose it at the top level.
 */
export function extractLuluTotalCostCents(payload: Record<string, unknown>): number | null {
  const costs = asRecord(payload.costs);
  const direct = payload.total_cost_incl_tax ?? payload.total_cost_excl_tax;
  const nested = costs?.total_cost_incl_tax ?? costs?.total_cost_excl_tax;
  const value = parseMoneyToCents((direct ?? nested) as unknown);
  return value > 0 ? value : null;
}

export async function getLuluPrintJob(providerJobId: string) {
  return (await luluRequest<Record<string, unknown>>(`/print-jobs/${providerJobId}/`, {
    method: "GET",
  })) as Record<string, unknown>;
}

export type LuluCancelResult = {
  ok: boolean;
  attempted: boolean;
  status?: string | null;
  error?: string | null;
};

/**
 * Attempt to cancel a Lulu print job. Lulu accepts cancellation only
 * while the job is in an early state (pre-production). We don't block
 * the refund flow on cancellation failure — the caller should apply
 * the appropriate refund tier regardless.
 */
export async function cancelLuluPrintJob(providerJobId: string): Promise<LuluCancelResult> {
  try {
    const response = (await luluRequest<Record<string, unknown>>(
      `/print-jobs/${providerJobId}/status/`,
      {
        method: "PUT",
        body: JSON.stringify({ name: "CANCELED" }),
      },
    )) as Record<string, unknown>;
    return { ok: true, attempted: true, status: extractLuluStatusName(response) };
  } catch (error) {
    return {
      ok: false,
      attempted: true,
      error: error instanceof Error ? error.message : "lulu_cancel_failed",
    };
  }
}

export function extractLuluStatusName(payload: Record<string, unknown>) {
  const status = asRecord(payload.status);

  if (typeof status?.name === "string") {
    return status.name;
  }

  if (typeof payload.status === "string") {
    return payload.status;
  }

  if (typeof payload.name === "string") {
    return payload.name;
  }

  return null;
}

export function extractLuluTracking(payload: Record<string, unknown>) {
  const lineItemStatuses = Array.isArray(payload.line_item_statuses) ? payload.line_item_statuses : [];
  const firstLineItem = asRecord(lineItemStatuses[0]);
  const messages = asRecord(firstLineItem?.messages);
  const trackingUrls = Array.isArray(messages?.tracking_urls) ? messages.tracking_urls : [];

  return {
    trackingNumber: typeof messages?.tracking_id === "string" ? messages.tracking_id : null,
    trackingUrl: typeof trackingUrls[0] === "string" ? trackingUrls[0] : null,
  };
}
