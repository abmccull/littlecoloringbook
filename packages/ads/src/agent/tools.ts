// Claude tool definitions for the 8 agent proposal kinds.
//
// These mirror the zod payload schemas in ../agent-proposals.ts but in
// the Anthropic SDK's JSON-schema shape. The `name` on each tool is
// the proposal `kind` — the brief-agent parses tool_use blocks back
// into AgentProposalInput objects by matching on this name.
//
// IMPORTANT for prompt caching: these definitions are a stable
// prefix. Do NOT re-order, re-generate, or re-sort the array between
// requests — any byte change invalidates the cached tool+system
// prefix. Exported as a const so TS freezes ordering.

import type Anthropic from "@anthropic-ai/sdk";

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "pause_ad",
    description:
      "Pause a specific Meta ad. Use when an ad has tripped a kill rule (e.g., $15+ spent with 0 adds-to-cart, CPA > 2.5× target, or the same creative angle has lost 3+ times). Always auto-approved.",
    input_schema: {
      type: "object",
      properties: {
        adId: {
          type: "string",
          description:
            "The ad's meta_id (not the internal DB id). Pull this from the `ads[].meta_id` field of the context snapshot.",
        },
      },
      required: ["adId"],
      additionalProperties: false,
    },
  },
  {
    name: "scale_budget",
    description:
      "Increase (or decrease) the daily budget of an ad, adset, or campaign. Auto-approved only when scaling adsets/campaigns to ≤2× current AND ≤$30/day; larger scale-ups require human approval. Use when an entity consistently hits the winner criteria (≥$25 spent, CPA ≤ target, ≥3 purchases).",
    input_schema: {
      type: "object",
      properties: {
        entity: { type: "string", enum: ["ad", "adset", "campaign"] },
        entityId: {
          type: "string",
          description: "The entity's meta_id.",
        },
        newDailyBudgetCents: {
          type: "integer",
          description:
            "The proposed new daily budget in cents (e.g., 1000 = $10/day). Ads inherit budget from adsets — for ad-level scale, typically duplicate to a scaling campaign instead.",
          minimum: 100,
        },
      },
      required: ["entity", "entityId", "newDailyBudgetCents"],
      additionalProperties: false,
    },
  },
  {
    name: "duplicate_to_scaling_campaign",
    description:
      "Duplicate a winning ad into the higher-budget scaling campaign. Use when an ad passes winner rules and you want to scale it without disturbing the discovery campaign's learning phase. Requires human approval.",
    input_schema: {
      type: "object",
      properties: {
        adId: { type: "string", description: "Meta_id of the winning ad to duplicate." },
        scalingCampaignId: {
          type: "string",
          description: "Meta_id of the destination scaling campaign.",
        },
        newDailyBudgetCents: {
          type: "integer",
          description: "Daily budget for the duplicated ad's new adset.",
          minimum: 100,
        },
      },
      required: ["adId", "scalingCampaignId", "newDailyBudgetCents"],
      additionalProperties: false,
    },
  },
  {
    name: "request_creative",
    description:
      "Request new creative assets be generated. Use when a concept is fatiguing (CTR decline ≥15% over 7d and frequency ≥3) and you want fresh variants, or when a winning concept should spawn descendants (same angle, one variable changed: hook, visual, avatar, voice, CTA, occasion, length). Always auto-approved — the creative team handles compliance review.",
    input_schema: {
      type: "object",
      properties: {
        brief: {
          type: "string",
          description:
            "Detailed brief: pillar, persona, occasion, offer, hook family, and what variable to vary from the parent. Be specific about the constraint — vague briefs waste credits.",
        },
      },
      required: ["brief"],
      additionalProperties: false,
    },
  },
  {
    name: "update_targeting",
    description:
      "Propose a targeting change on an adset (interests, behaviors, age/gender). Requires human approval. Use sparingly — audience changes reset the learning phase.",
    input_schema: {
      type: "object",
      properties: {
        adSetId: { type: "string", description: "Meta_id of the adset to update." },
        targetingPatch: {
          type: "object",
          description:
            "Partial targeting spec in Meta's targeting format. Will be merged with existing targeting.",
          additionalProperties: true,
        },
      },
      required: ["adSetId", "targetingPatch"],
      additionalProperties: false,
    },
  },
  {
    name: "update_audience",
    description:
      "Attach or detach custom/lookalike audiences on an adset. Requires human approval.",
    input_schema: {
      type: "object",
      properties: {
        adSetId: { type: "string", description: "Meta_id of the adset." },
        customAudiences: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          description: "Custom audiences to include.",
        },
        excludedCustomAudiences: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          description: "Custom audiences to exclude.",
        },
      },
      required: ["adSetId"],
      additionalProperties: false,
    },
  },
  {
    name: "report_insight",
    description:
      "Record a structured observation about patterns in the data (e.g., 'grandparent-gift angle outperforms evergreen on weekends'). No state change — this just appends to the agent journal for the human reviewer. Always auto-approved.",
    input_schema: {
      type: "object",
      properties: {
        observation: {
          type: "string",
          description: "A clear, specific observation grounded in the metrics you see.",
        },
        supporting_metrics: {
          type: "object",
          description:
            "Optional. Specific metric values that support the claim. E.g., { 'grandparent_gift_weekend_cpa_cents': 1800, 'evergreen_weekend_cpa_cents': 3400 }.",
          additionalProperties: true,
        },
      },
      required: ["observation"],
      additionalProperties: false,
    },
  },
  {
    name: "flag_risk",
    description:
      "Flag a risk that should interrupt normal operation — account-flag risk, clear policy violation, sudden metric collapse, or any situation that needs human attention now. Always auto-approved; review frequency is up to operators.",
    input_schema: {
      type: "object",
      properties: {
        severity: { type: "string", enum: ["low", "medium", "high"] },
        observation: {
          type: "string",
          description: "What's happening and why it's a risk.",
        },
        suggested_action: {
          type: "string",
          description: "What a human should consider doing. Optional.",
        },
      },
      required: ["severity", "observation"],
      additionalProperties: false,
    },
  },
];
