// The Claude-powered brief agent.
//
// Reads a context snapshot (matching the shape /api/agent/context
// returns) and decides 0..N structured proposals to submit. Each
// proposal is validated against the same `agentProposalInputSchema`
// the HTTP endpoint uses, so it's safe to hand straight to
// insertAgentProposal or POST to /api/agent/propose.
//
// Prompt caching:
//   - Tools render at position 0 (~1600 tokens of JSON schemas)
//   - System prompt renders at position 1 (~2000 tokens, stable)
//   - Cache breakpoint placed on the last system block → caches
//     tools + system together on every call after the first
//   - User message = context snapshot JSON. NOT cached (volatile).
//
// Sonnet 4.6's minimum cacheable prefix is 2048 tokens; our tools +
// system together exceed that. Verify with `response.usage.cache_read_input_tokens`
// on the second call.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { agentProposalInputSchema, type AgentProposalInput } from "../agent-proposals";
import { AGENT_SYSTEM_PROMPT } from "./system-prompt";
import { AGENT_TOOLS } from "./tools";

export type BriefAgentConfig = {
  /** Anthropic client. Inject for tests; otherwise uses ANTHROPIC_API_KEY. */
  client?: Anthropic;
  /** Override the default Sonnet 4.6 model (e.g., for evals). */
  model?: string;
  /** Max tokens for the response. Default 4096 — enough for 10 proposals. */
  maxTokens?: number;
  /** Agent identity written to the `x-agent-id` equivalent + journal entries. */
  agentId?: string;
};

export type BriefAgentUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  /** True when the response read at least 1 cached token. */
  cacheHit: boolean;
};

export type BriefAgentResult = {
  /** Validated, schema-checked proposals ready to submit. */
  proposals: AgentProposalInput[];
  /** Raw tool_use blocks that failed validation (zod errors). Don't submit these. */
  rejected: Array<{
    toolName: string;
    toolUseId: string;
    input: unknown;
    error: string;
  }>;
  /** Any free-form text Claude emitted (should be empty — system prompt forbids it). */
  preamble: string;
  usage: BriefAgentUsage;
  stopReason: Anthropic.Messages.Message["stop_reason"];
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Run one agent pass: send the context snapshot to Claude, parse the
 * tool_use blocks back into validated AgentProposalInput values.
 *
 * Does NOT call the DB or any HTTP endpoint. Caller decides what to do
 * with the proposals (usually: POST to /api/agent/propose or call
 * insertAgentProposal directly from a cron).
 */
export async function runBriefAgent(
  context: unknown,
  config: BriefAgentConfig = {},
): Promise<BriefAgentResult> {
  const client = config.client ?? new Anthropic();
  const model = config.model ?? DEFAULT_MODEL;
  const maxTokens = config.maxTokens ?? 4096;

  // The system prompt is passed as an array of text blocks so we can
  // attach cache_control to the last one. With render order
  // tools → system → messages, a marker on the last system block
  // caches tools + system together.
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: AGENT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: AGENT_TOOLS,
    // tool_choice: "auto" — Claude decides whether to act. It's valid to
    // respond with zero tool calls when the account is on track.
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here is the current account snapshot. Decide what, if anything, we should do.\n\nContext:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``,
          },
        ],
      },
    ],
  });

  return parseResponse(response);
}

// ─── Response parser — exported for tests ─────────────────────────────────

export function parseResponse(response: Anthropic.Messages.Message): BriefAgentResult {
  const proposals: AgentProposalInput[] = [];
  const rejected: BriefAgentResult["rejected"] = [];
  const preambleParts: string[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      preambleParts.push(block.text);
      continue;
    }
    if (block.type !== "tool_use") continue;

    const candidate = { kind: block.name, payload: block.input };
    const parsed = agentProposalInputSchema.safeParse(candidate);
    if (parsed.success) {
      proposals.push(parsed.data);
    } else {
      rejected.push({
        toolName: block.name,
        toolUseId: block.id,
        input: block.input,
        error: formatZodError(parsed.error),
      });
    }
  }

  const usage = response.usage;
  return {
    proposals,
    rejected,
    preamble: preambleParts.join("\n").trim(),
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
    },
    stopReason: response.stop_reason,
  };
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}
