import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getInternalJobSecret } from "./internal-jobs";

function getAgentApiKey(): string | null {
  return process.env.AGENT_API_KEY ?? null;
}

// Accepts either X-Internal-Token: $INTERNAL_JOB_SECRET
//           or   X-Agent-Key: $AGENT_API_KEY
//           or   Authorization: Bearer $INTERNAL_JOB_SECRET
export function authorizeAgentRequest(request: NextRequest): NextResponse | null {
  const internalSecret = getInternalJobSecret();
  const agentKey = getAgentApiKey();

  if (!internalSecret && !agentKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Agent auth not configured in production." } },
        { status: 503 },
      );
    }
    return null;
  }

  const bearerToken = (() => {
    const auth = request.headers.get("authorization");
    return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  })();
  const internalTokenHeader = request.headers.get("x-internal-token");
  const agentKeyHeader = request.headers.get("x-agent-key");

  const provided = bearerToken ?? internalTokenHeader ?? agentKeyHeader;

  if (!provided) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Missing auth header." } },
      { status: 401 },
    );
  }

  const validInternal = internalSecret && provided === internalSecret;
  const validAgent = agentKey && provided === agentKey;

  if (!validInternal && !validAgent) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid credentials." } },
      { status: 401 },
    );
  }

  return null;
}

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function authorizeAdminAgentRequest(request: NextRequest): NextResponse | null {
  const agentAuth = authorizeAgentRequest(request);
  if (agentAuth) return agentAuth;

  const adminEmail = request.headers.get("x-admin-email")?.toLowerCase() ?? "";
  const adminEmails = getAdminEmails();

  if (adminEmails.length > 0 && !adminEmails.includes(adminEmail)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "x-admin-email not in ADMIN_EMAILS list." } },
      { status: 403 },
    );
  }

  return null;
}
