#!/usr/bin/env node
/**
 * LittleColorBook MCP Server
 *
 * Thin HTTP forwarder that exposes the Phase 4 agent control plane as
 * first-class MCP tools for Claude Desktop (and any MCP-aware client).
 *
 * Environment variables required at runtime:
 *   AGENT_API_BASE_URL  — defaults to https://littlecolorbook.com
 *   AGENT_API_KEY       — required; forwarded as X-Agent-Key header
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Runtime config ──────────────────────────────────────────────────────────

const BASE_URL = (process.env.AGENT_API_BASE_URL ?? "https://littlecolorbook.com").replace(
  /\/$/,
  "",
);

const AGENT_API_KEY = process.env.AGENT_API_KEY;
if (!AGENT_API_KEY) {
  process.stderr.write(
    "[lcb-mcp-server] ERROR: AGENT_API_KEY environment variable is required.\n",
  );
  process.exit(1);
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_agent_context",
    description:
      "Returns a shaped snapshot of the current ad system state: active campaigns, ads with kill/winner/fatigue flags, top/bottom performers, budget utilization, and the 10 most recent proposals and journal entries.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "propose_action",
    description:
      "Submit a typed agent proposal. Kinds: pause_ad, scale_budget, duplicate_to_scaling_campaign, request_creative, update_targeting, update_audience, report_insight, flag_risk. Low-risk kinds are auto-approved; others enter a pending queue for human review.",
    inputSchema: {
      type: "object" as const,
      required: ["kind", "payload"],
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: [
            "pause_ad",
            "scale_budget",
            "duplicate_to_scaling_campaign",
            "request_creative",
            "update_targeting",
            "update_audience",
            "report_insight",
            "flag_risk",
          ],
          description: "The proposal kind. Determines which payload fields are required.",
        },
        payload: {
          type: "object",
          description:
            "Kind-specific payload. pause_ad: {adId}. scale_budget: {entity, entityId, newDailyBudgetCents}. duplicate_to_scaling_campaign: {adId, scalingCampaignId, newDailyBudgetCents}. request_creative: {brief}. update_targeting: {adSetId, targetingPatch}. update_audience: {adSetId, customAudiences?, excludedCustomAudiences?}. report_insight: {observation, supporting_metrics?}. flag_risk: {severity, observation, suggested_action?}.",
          additionalProperties: true,
        },
        rationale: {
          type: "string",
          description: "Optional free-text rationale explaining why this action is recommended.",
        },
      },
    },
  },
  {
    name: "execute_proposal",
    description:
      "Execute an approved proposal by ID. The proposal must have status='approved' and must not have expired. Sends the actual Meta API call.",
    inputSchema: {
      type: "object" as const,
      required: ["id"],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "The proposal ID (e.g. prop_abc123...).",
        },
      },
    },
  },
  {
    name: "list_journal",
    description:
      "Read recent agent journal entries. Supports optional filters: kind (event type), limit (max 200), offset (pagination), relatedProposalId (narrow to one proposal's events).",
    inputSchema: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: [
            "proposal_created",
            "proposal_executed",
            "proposal_rejected",
            "outcome_observed_24h",
            "outcome_observed_72h",
            "risk_flagged",
            "insight_recorded",
            "system_note",
          ],
          description: "Filter by journal entry kind.",
        },
        limit: {
          type: "number",
          description: "Maximum entries to return (1–200). Defaults to 50.",
        },
        offset: {
          type: "number",
          description: "Pagination offset. Defaults to 0.",
        },
        relatedProposalId: {
          type: "string",
          description: "Filter entries related to a specific proposal ID.",
        },
      },
    },
  },
  {
    name: "approve_proposal",
    description:
      "Approve a pending proposal (admin action). Requires adminEmail to be in the server's ADMIN_EMAILS list. After approval, the agent can call execute_proposal to run it.",
    inputSchema: {
      type: "object" as const,
      required: ["id", "adminEmail"],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "The proposal ID to approve.",
        },
        adminEmail: {
          type: "string",
          description: "Admin email address. Must be in the ADMIN_EMAILS env var on the server.",
        },
      },
    },
  },
  {
    name: "reject_proposal",
    description:
      "Reject a pending or approved proposal (admin action). Requires adminEmail to be in the server's ADMIN_EMAILS list.",
    inputSchema: {
      type: "object" as const,
      required: ["id", "adminEmail"],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "The proposal ID to reject.",
        },
        adminEmail: {
          type: "string",
          description: "Admin email address. Must be in the ADMIN_EMAILS env var on the server.",
        },
        reason: {
          type: "string",
          description: "Optional human-readable reason for rejection.",
        },
      },
    },
  },
] as const;

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function agentFetch(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<CallToolResult> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "X-Agent-Key": AGENT_API_KEY as string,
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    let data: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    const text = JSON.stringify(data, null, 2);

    if (!res.ok) {
      return {
        content: [{ type: "text", text: `HTTP ${res.status} from ${path}:\n${text}` }],
        isError: true,
      };
    }

    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error calling ${path}: ${message}` }],
      isError: true,
    };
  }
}

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleGetAgentContext(): Promise<CallToolResult> {
  return agentFetch("/api/agent/context");
}

async function handleProposeAction(args: Record<string, unknown>): Promise<CallToolResult> {
  const { kind, payload, rationale } = args;

  if (typeof kind !== "string" || typeof payload !== "object" || payload === null) {
    return {
      content: [{ type: "text", text: "Error: 'kind' (string) and 'payload' (object) are required." }],
      isError: true,
    };
  }

  const body: Record<string, unknown> = { kind, payload };
  if (typeof rationale === "string") {
    body.rationale = rationale;
  }

  return agentFetch("/api/agent/propose", { method: "POST", body });
}

async function handleExecuteProposal(args: Record<string, unknown>): Promise<CallToolResult> {
  const { id } = args;
  if (typeof id !== "string" || !id.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'id' (string) is required." }],
      isError: true,
    };
  }
  return agentFetch(`/api/agent/execute/${encodeURIComponent(id)}`, { method: "POST" });
}

async function handleListJournal(args: Record<string, unknown>): Promise<CallToolResult> {
  const params = new URLSearchParams();

  if (typeof args.kind === "string") params.set("kind", args.kind);
  if (typeof args.limit === "number") params.set("limit", String(Math.floor(args.limit)));
  if (typeof args.offset === "number") params.set("offset", String(Math.floor(args.offset)));
  if (typeof args.relatedProposalId === "string") params.set("relatedProposalId", args.relatedProposalId);

  const qs = params.toString();
  return agentFetch(`/api/agent/journal${qs ? `?${qs}` : ""}`);
}

async function handleApproveProposal(args: Record<string, unknown>): Promise<CallToolResult> {
  const { id, adminEmail } = args;
  if (typeof id !== "string" || !id.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'id' (string) is required." }],
      isError: true,
    };
  }
  if (typeof adminEmail !== "string" || !adminEmail.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'adminEmail' (string) is required." }],
      isError: true,
    };
  }
  return agentFetch(`/api/agent/approve/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "X-Admin-Email": adminEmail },
  });
}

async function handleRejectProposal(args: Record<string, unknown>): Promise<CallToolResult> {
  const { id, adminEmail, reason } = args;
  if (typeof id !== "string" || !id.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'id' (string) is required." }],
      isError: true,
    };
  }
  if (typeof adminEmail !== "string" || !adminEmail.trim()) {
    return {
      content: [{ type: "text", text: "Error: 'adminEmail' (string) is required." }],
      isError: true,
    };
  }

  const body: Record<string, unknown> = {};
  if (typeof reason === "string" && reason.trim()) {
    body.reason = reason;
  }

  return agentFetch(`/api/agent/reject/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "X-Admin-Email": adminEmail },
    body: Object.keys(body).length > 0 ? body : undefined,
  });
}

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "littlecolorbook-growth",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  switch (name) {
    case "get_agent_context":
      return handleGetAgentContext();
    case "propose_action":
      return handleProposeAction(args);
    case "execute_proposal":
      return handleExecuteProposal(args);
    case "list_journal":
      return handleListJournal(args);
    case "approve_proposal":
      return handleApproveProposal(args);
    case "reject_proposal":
      return handleRejectProposal(args);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[lcb-mcp-server] Connected via stdio. Waiting for requests.\n");
}

main().catch((err) => {
  process.stderr.write(`[lcb-mcp-server] Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
