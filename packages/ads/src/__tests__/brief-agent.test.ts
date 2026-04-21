import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { parseResponse, AGENT_TOOLS } from "../agent";

function mockMessage(
  content: Array<Partial<Anthropic.Messages.ContentBlock> & { type: string }>,
  overrides: Partial<Anthropic.Messages.Message> = {},
): Anthropic.Messages.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: content as Anthropic.Messages.ContentBlock[],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      service_tier: null,
      server_tool_use: null,
    },
    ...overrides,
  } as Anthropic.Messages.Message;
}

describe("AGENT_TOOLS", () => {
  it("defines exactly the 8 proposal kinds", () => {
    const names = AGENT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "pause_ad",
        "scale_budget",
        "duplicate_to_scaling_campaign",
        "request_creative",
        "update_targeting",
        "update_audience",
        "report_insight",
        "flag_risk",
      ].sort(),
    );
  });

  it("every tool's input_schema is a strict object schema", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema.additionalProperties).toBe(false);
    }
  });

  it("ordering is stable (cache-critical)", () => {
    // First and last positions lock — if this test fails, somebody
    // re-sorted the array and invalidated the prompt cache prefix for
    // every deploy. Fix by preserving original order.
    expect(AGENT_TOOLS[0].name).toBe("pause_ad");
    expect(AGENT_TOOLS[AGENT_TOOLS.length - 1].name).toBe("flag_risk");
  });
});

describe("parseResponse", () => {
  it("returns empty proposals when Claude emits no tool_use", () => {
    const result = parseResponse(
      mockMessage([{ type: "text", text: "No action required.", citations: null }]),
    );
    expect(result.proposals).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(result.preamble).toBe("No action required.");
    expect(result.stopReason).toBe("end_turn");
  });

  it("parses valid pause_ad tool_use", () => {
    const result = parseResponse(
      mockMessage([
        {
          type: "tool_use",
          id: "toolu_1",
          name: "pause_ad",
          input: { adId: "120210000000000000" },
        },
      ]),
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toEqual({
      kind: "pause_ad",
      payload: { adId: "120210000000000000" },
    });
    expect(result.rejected).toHaveLength(0);
  });

  it("parses valid scale_budget tool_use", () => {
    const result = parseResponse(
      mockMessage([
        {
          type: "tool_use",
          id: "toolu_2",
          name: "scale_budget",
          input: { entity: "adset", entityId: "120210abc", newDailyBudgetCents: 2500 },
        },
      ]),
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].kind).toBe("scale_budget");
  });

  it("rejects a tool_use with an invalid payload", () => {
    const result = parseResponse(
      mockMessage([
        {
          type: "tool_use",
          id: "toolu_3",
          name: "scale_budget",
          // Missing entityId — schema requires it
          input: { entity: "adset", newDailyBudgetCents: 2500 },
        },
      ]),
    );
    expect(result.proposals).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].toolName).toBe("scale_budget");
    expect(result.rejected[0].error).toMatch(/entityId/);
  });

  it("rejects an unknown tool name", () => {
    const result = parseResponse(
      mockMessage([
        {
          type: "tool_use",
          id: "toolu_4",
          name: "do_something_weird",
          input: {},
        },
      ]),
    );
    expect(result.proposals).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });

  it("splits mixed valid + invalid + text blocks cleanly", () => {
    const result = parseResponse(
      mockMessage([
        { type: "text", text: "Analyzing…", citations: null },
        { type: "tool_use", id: "a", name: "pause_ad", input: { adId: "ad_1" } },
        { type: "tool_use", id: "b", name: "pause_ad", input: {} }, // bad
        {
          type: "tool_use",
          id: "c",
          name: "report_insight",
          input: { observation: "Birthday angle CPA 2× evergreen on weekends." },
        },
      ]),
    );
    expect(result.proposals).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.preamble).toBe("Analyzing…");
  });

  it("surfaces cache-hit status in usage", () => {
    const hot = parseResponse(
      mockMessage([], {
        usage: {
          input_tokens: 50,
          output_tokens: 10,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 3500,
          service_tier: null,
          server_tool_use: null,
        } as Anthropic.Messages.Usage,
      }),
    );
    expect(hot.usage.cacheHit).toBe(true);
    expect(hot.usage.cacheReadInputTokens).toBe(3500);

    const cold = parseResponse(
      mockMessage([], {
        usage: {
          input_tokens: 4000,
          output_tokens: 10,
          cache_creation_input_tokens: 3500,
          cache_read_input_tokens: 0,
          service_tier: null,
          server_tool_use: null,
        } as Anthropic.Messages.Usage,
      }),
    );
    expect(cold.usage.cacheHit).toBe(false);
    expect(cold.usage.cacheCreationInputTokens).toBe(3500);
  });
});
