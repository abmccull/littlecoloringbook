/**
 * llm-compliance.ts
 *
 * Phase 2c — Claude Haiku LLM second-pass compliance reviewer.
 *
 * This module calls Claude Haiku to evaluate ad copy that the regex scanner
 * has already cleared (passed or warned). The LLM catches nuanced violations
 * that regexes cannot: context-dependent personal-attribute phrasing, Meta
 * policy edge cases, and implied-claim patterns.
 *
 * Cost model (Haiku claude-haiku-4-5-20251001):
 *   - ~$1.00/MTok input  / ~$5.00/MTok output
 *   - Prompt cache hit:   ~$0.10/MTok input
 *   - Typical call:       ~800 tok in + ~300 tok out
 *   - Uncached:           ~$0.002/call
 *   - Cached sys prompt:  ~$0.0008/call
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicEnv } from "@littlecolorbook/shared/env";
import type { ComplianceReport, ComplianceIssue } from "./types";

// ─── Public constants ─────────────────────────────────────────────────────────

export const LLM_POLICY_VERSION = "2026-04-a-haiku";
export const COMBINED_POLICY_VERSION = "2026-04-a+haiku";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComplianceScanInput = {
  caption?: string | null;
  hook?: string | null;
  body?: string | null;
  cta?: string | null;
  imageTagsOrAltText?: string | null;
  landingPageUrl?: string | null;
};

/** Raw JSON shape the LLM is instructed to emit. */
type LlmRawOutput = {
  status: "passed" | "warned" | "rejected";
  warnings: Array<{ code: string; message: string; evidence: string }>;
  errors: Array<{ code: string; message: string; evidence: string }>;
  reasoning: string;
};

// ─── System prompt (stable across calls — prompt-cached) ──────────────────────

const SYSTEM_PROMPT = `You are a Meta Advertising Policy compliance reviewer. \
Your job is to evaluate ad copy for "little color book" — a brand that makes \
personalized coloring books from family photos — and determine whether the copy \
complies with Meta's advertising policies.

## Meta Policy Summary

### Children and Family Policy
- PROHIBITED: Any language that implies personal attributes about a user's child \
or family member (e.g., "we know your child is artistic", "for your autistic kid", \
"for your gifted toddler"). The prohibition applies even when phrased indirectly \
or through implication.
- PROHIBITED: Before-and-after imagery or language combined with children.
- PROHIBITED: Fearmongering about children's development, screen addiction, \
or behavioral issues.
- PROHIBITED: Language identifying a child's age, diagnosis, ability level, \
or developmental stage in the targeting frame.

### Claims Policy
- PROHIBITED: Unsubstantiated superlatives ("best", "#1", "world's greatest", \
"most loved") without a credible, verifiable source cited in the ad itself.
- PROHIBITED: Fake urgency — countdown language, "only X left", "selling fast!!!", \
"48 hours only" — that cannot be substantiated.
- PROHIBITED: Health claims implying cures, treatments, or medical benefits.
- PROHIBITED: Guaranteed financial returns or earnings.

### Content Standards
- PROHIBITED: Excessive punctuation (3+ exclamation marks in a row), ALL-CAPS \
spam patterns, or clickbait phrases ("you won't believe").
- PROHIBITED: Sensationalist language ("shocking", "outrageous").
- PROHIBITED: Crypto/NFT investment solicitation.

### What IS allowed for "little color book"
- Positive, benefit-led copy about personalized coloring books.
- "Your family", "your kids", "your photo" — generic possessives that don't \
imply personal attributes.
- "Transform your family photo into a coloring page" — transformation framing \
is acceptable if it does not include explicit before/after combined with a child.
- One or two emojis used tastefully.
- "Limited time offer" without excessive punctuation is borderline acceptable.

## Output Format

Respond with ONLY valid JSON matching this exact schema — no markdown, no \
explanation outside the JSON:

{
  "status": "passed" | "warned" | "rejected",
  "warnings": [{ "code": string, "message": string, "evidence": string }],
  "errors": [{ "code": string, "message": string, "evidence": string }],
  "reasoning": string
}

Rules:
- "status" must be "rejected" if any errors exist, "warned" if only warnings \
exist, "passed" if neither.
- "errors" are hard violations that would cause Meta to reject or restrict the ad.
- "warnings" are soft flags that may reduce delivery or increase scrutiny risk.
- "evidence" is the exact excerpt from the input that triggered the issue (max \
120 characters).
- "reasoning" is a brief (1–3 sentence) explanation of your overall assessment.
- If the copy is clean, return empty arrays for warnings and errors.`;

// ─── Lazy Anthropic client (singleton per API key) ────────────────────────────
// The singleton is keyed by API key so that:
//   (a) We don't create a new HTTP client on every compliance call (efficiency).
//   (b) When the env key changes (e.g., in tests), we create a fresh client.

let _clientKey: string | null = null;
let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const { apiKey } = getAnthropicEnv();
  if (!apiKey) return null;
  if (_client === null || _clientKey !== apiKey) {
    _client = new Anthropic({ apiKey });
    _clientKey = apiKey;
  }
  return _client;
}

/** Reset the cached client singleton. For use in tests only. */
export function _resetClientForTests(): void {
  _client = null;
  _clientKey = null;
}

// ─── Core LLM scanner ────────────────────────────────────────────────────────

/**
 * Scan ad copy with Claude Haiku.
 *
 * Returns a ComplianceReport. On any error (API failure, timeout, malformed
 * JSON), returns a warning-level report so the caller can decide how to proceed.
 *
 * If ANTHROPIC_API_KEY is not configured, throws — callers should guard with
 * isAnthropicConfigured() or catch. The exported scanWithLlm wrapper handles
 * the graceful fallback.
 */
export async function scanComplianceWithLlm(
  input: ComplianceScanInput,
  options?: { timeoutMs?: number },
): Promise<ComplianceReport> {
  // Read env once so we get a consistent view for both the API key check and
  // the timeout / model values. (getClient() also calls getAnthropicEnv()
  // internally, but after we confirm apiKey is non-null here we pass it along.)
  const env = getAnthropicEnv();

  if (!env.apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured — cannot call LLM compliance scanner");
  }

  const timeoutMs = options?.timeoutMs ?? env.llmComplianceTimeoutMs;

  const client = getClient();
  if (!client) {
    // getClient() already checked apiKey, so this branch is unreachable in
    // normal operation — but it keeps TypeScript happy.
    throw new Error("ANTHROPIC_API_KEY is not configured — cannot call LLM compliance scanner");
  }

  const userMessage = buildUserMessage(input);

  // AbortController for timeout
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let rawText: string;

  try {
    const response = await client.messages.create(
      {
        model: env.model,
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            // Prompt caching — the system prompt is stable across all calls in
            // this process, so subsequent calls after the first will hit cache
            // and cost ~0.10/MTok instead of ~1.00/MTok.
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      },
      {
        signal: controller.signal,
      },
    );

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("LLM returned no text content block");
    }
    rawText = firstBlock.text;
  } finally {
    clearTimeout(timeoutHandle);
  }

  return parseLlmResponse(rawText);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserMessage(input: ComplianceScanInput): string {
  const lines = [
    "Brand: little color book (personalized coloring books made from family photos)",
    `Hook: ${input.hook ?? "(none)"}`,
    `Body: ${input.body ?? "(none)"}`,
    `CTA: ${input.cta ?? "(none)"}`,
    `Caption: ${input.caption ?? "(none)"}`,
    `ImageAltOrTags: ${input.imageTagsOrAltText ?? "(none)"}`,
    `LandingPageUrl: ${input.landingPageUrl ?? "(none)"}`,
  ];
  return lines.join("\n");
}

function parseLlmResponse(raw: string): ComplianceReport {
  let parsed: unknown;

  // Strip any accidental markdown fences the model emits despite instructions
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      status: "warned",
      warnings: [
        {
          code: "llm_parse_error",
          message: `LLM returned non-JSON response: ${cleaned.slice(0, 200)}`,
          evidence: cleaned.slice(0, 120),
        },
      ],
      errors: [],
      policyVersion: LLM_POLICY_VERSION,
    };
  }

  if (!isLlmRawOutput(parsed)) {
    return {
      status: "warned",
      warnings: [
        {
          code: "llm_parse_error",
          message: "LLM response did not match expected schema",
          evidence: cleaned.slice(0, 120),
        },
      ],
      errors: [],
      policyVersion: LLM_POLICY_VERSION,
    };
  }

  return {
    status: parsed.status,
    warnings: parsed.warnings.map(normaliseIssue),
    errors: parsed.errors.map(normaliseIssue),
    policyVersion: LLM_POLICY_VERSION,
  };
}

function normaliseIssue(raw: { code: string; message: string; evidence: string }): ComplianceIssue {
  return {
    code: raw.code,
    message: raw.message,
    evidence: raw.evidence.slice(0, 120),
  };
}

function isLlmRawOutput(value: unknown): value is LlmRawOutput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!["passed", "warned", "rejected"].includes(v["status"] as string)) return false;
  if (!Array.isArray(v["warnings"])) return false;
  if (!Array.isArray(v["errors"])) return false;
  return true;
}
