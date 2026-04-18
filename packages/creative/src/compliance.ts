import crypto from "node:crypto";
import type { ComplianceReport, ComplianceIssue } from "./types";
import { scanComplianceWithLlm, COMBINED_POLICY_VERSION, type ComplianceScanInput } from "./llm-compliance";

export const POLICY_VERSION = "2026-04-a";

type RuleEntry = {
  code: string;
  pattern: RegExp;
  severity: "error" | "warning";
  message: string;
};

// Each rule maps to a specific Meta Advertising Policy concern. Comments note
// the policy area when it's non-obvious.
const RULES: RuleEntry[] = [
  // ─── Personal attribute implications (Meta policy: Prohibited Content §4) ───
  {
    code: "PERSONAL_ATTR_KNOW_YOUR_CHILD",
    pattern: /know\s+your\s+child/i,
    severity: "error",
    message: 'Implies knowledge of user\'s child ("know your child"). Violates Meta personal attribute policy.',
  },
  {
    code: "PERSONAL_ATTR_YOUR_DINOSAUR_KID",
    pattern: /for\s+your\s+\w+\s+kid/i,
    severity: "error",
    message: "Implies personal attribute about user's child. Remove 'your [adjective] kid' framing.",
  },
  {
    code: "PERSONAL_ATTR_WE_KNOW_YOU_LOVE",
    pattern: /we\s+know\s+you\s+love/i,
    severity: "error",
    message: 'Implies knowledge of personal preference ("we know you love X"). Remove.',
  },
  {
    code: "PERSONAL_ATTR_YOUR_FAMILY_MEMBER",
    pattern: /\byour\s+(autistic|adhd|special needs|gifted|disabled)\b/i,
    severity: "error",
    message: "Implies a personal attribute about user's family member. Remove.",
  },

  // ─── Fearmongering about children ─────────────────────────────────────────
  {
    code: "FEARMONGERING_SCREEN_ADDICTION",
    pattern: /screen\s+(addict|addiction|dependent|dependency)/i,
    severity: "error",
    message: "Fearmongering about screen addiction in children. Rephrase to a positive angle.",
  },
  {
    code: "FEARMONGERING_DEVELOPMENTAL_HARM",
    pattern: /\b(stunting|developmental\s+harm|brain\s+damage)\b/i,
    severity: "error",
    message: "Fearmongering about developmental harm. Remove.",
  },

  // ─── Unsubstantiated superlatives (Meta policy: Misleading Content) ────────
  {
    code: "SUPERLATIVE_NUMBER_ONE_BEST",
    pattern: /#1\s+best|number\s+one\s+best/i,
    severity: "error",
    message: '"#1 best" is an unsubstantiated superlative. Use a specific, verifiable claim instead.',
  },
  {
    code: "SUPERLATIVE_WORLDS_GREATEST",
    pattern: /world'?s?\s+greatest/i,
    severity: "error",
    message: '"World\'s greatest" is an unsubstantiated superlative.',
  },
  {
    code: "SUPERLATIVE_BEST_IN_CLASS",
    pattern: /best[\s-]in[\s-]class/i,
    severity: "error",
    message: '"Best-in-class" without evidence is a prohibited superlative.',
  },

  // ─── Fake urgency (Meta policy: Prohibited Content §7) ────────────────────
  {
    code: "FAKE_URGENCY_48_HOURS",
    pattern: /48\s*hours?\s+only/i,
    severity: "error",
    message: 'Deceptive urgency ("48 hours only"). Remove or substantiate the deadline.',
  },
  {
    code: "FAKE_URGENCY_LIMITED_TIME_EXCLAMATION",
    pattern: /limited\s+time\s+offer[!]{2,}/i,
    severity: "error",
    message: "Fake urgency with excessive punctuation. Calm the copy.",
  },
  {
    code: "FAKE_URGENCY_SELLING_FAST",
    pattern: /selling\s+fast[!]{2,}|going\s+fast[!]{2,}/i,
    severity: "error",
    message: "Deceptive urgency signal. Remove or reduce exclamation marks.",
  },

  // ─── Crypto / financial / health claim patterns ────────────────────────────
  {
    code: "FINANCIAL_CLAIM_GET_RICH",
    pattern: /get\s+rich\s+(quick|fast|overnight)/i,
    severity: "error",
    message: "Financial get-rich-quick claim. Prohibited.",
  },
  {
    code: "FINANCIAL_CLAIM_GUARANTEED_RETURNS",
    pattern: /guaranteed\s+(returns?|profits?|income)/i,
    severity: "error",
    message: "Guaranteed financial returns claim. Prohibited.",
  },
  {
    code: "HEALTH_CLAIM_CURES",
    pattern: /\b(cures?|treats?|heals?|reverses?)\s+(disease|illness|condition|disorder)\b/i,
    severity: "error",
    message: "Health claim implying a cure. Prohibited without clinical substantiation.",
  },
  {
    code: "CRYPTO_CLAIM",
    pattern: /\b(bitcoin|crypto|nft|blockchain|token\s+sale)\b.*\b(invest|profit|earn|roi)\b/i,
    severity: "error",
    message: "Crypto investment claim pattern detected. Prohibited in this ad account context.",
  },

  // ─── Meta-specific: before-and-after + child imagery ─────────────────────
  // (Meta policy: Before-and-After Images §13)
  {
    code: "META_BEFORE_AFTER_CHILD",
    pattern: /before\s+(and|&)\s+after.{0,100}child|child.{0,100}before\s+(and|&)\s+after/is,
    severity: "error",
    message: "\"Before and after\" combined with child reference may trigger Meta policy §13. Reframe as 'transformation' or 'reveal'.",
  },

  // ─── Meta-specific: "personalized" + age-identifying language ─────────────
  {
    code: "META_PERSONALIZED_AGE",
    pattern: /personalized.{0,50}\b(toddler|infant|baby|age\s*\d|year[\s-]old)\b/is,
    severity: "error",
    message: '"Personalized" combined with age-identifying language may violate Meta personal attribute policy.',
  },

  // ─── Warnings ─────────────────────────────────────────────────────────────

  {
    code: "WARN_EXCESSIVE_EXCLAMATIONS",
    pattern: /!{3,}/,
    severity: "warning",
    message: "Three or more consecutive exclamation marks. Reduce to one.",
  },
  {
    code: "WARN_ALL_CAPS_WORD",
    // Match 2+ runs of 4+ char all-caps words (separated by spaces/punctuation)
    pattern: /\b[A-Z]{4,}\b(?:\s+[A-Z]{4,}\b){1,}/,
    severity: "warning",
    message: "Multiple ALL-CAPS words detected. Use sentence case to avoid spam classification.",
  },
  {
    code: "WARN_EMOJI_CLUSTER",
    // Matches 4+ consecutive emoji-like unicode sequences
    pattern: /[\p{Emoji}]{4,}/u,
    severity: "warning",
    message: "Emoji cluster (4+) detected. Reduce to 1–2 emojis to avoid spam signals.",
  },
  {
    code: "WARN_FREE_SPAM_PATTERN",
    pattern: /FREE[!]{2,}|FREE\s+FREE|100%\s+FREE/i,
    severity: "warning",
    message: '"FREE!!!" or repeated FREE patterns look spammy. Rewrite.',
  },
  {
    code: "WARN_CLICK_BAIT",
    pattern: /you\s+won'?t\s+believe|this\s+one\s+(weird|simple)\s+trick/i,
    severity: "warning",
    message: "Clickbait phrase detected. Meta may reduce delivery.",
  },
  {
    code: "WARN_SHOCKING_CONTENT",
    pattern: /\b(shocking|outrageous|unbelievable)\b/i,
    severity: "warning",
    message: "Sensationalist language. Consider a calmer phrasing.",
  },
];

// ComplianceScanInput is defined in llm-compliance.ts and re-exported from
// there. The regex-layer functions here accept the same shape.
export type { ComplianceScanInput } from "./llm-compliance";

// ─── LRU cache (in-process, non-persistent) ───────────────────────────────────
// Keyed by SHA-256 of the canonicalised input. Max 500 entries; evict oldest
// on overflow (insertion-order Map is LRU-friendly).

const LRU_MAX = 500;
const lruCache = new Map<string, ComplianceReport>();

function lruGet(key: string): ComplianceReport | undefined {
  const value = lruCache.get(key);
  if (value === undefined) return undefined;
  // Refresh LRU position
  lruCache.delete(key);
  lruCache.set(key, value);
  return value;
}

function lruSet(key: string, value: ComplianceReport): void {
  if (lruCache.has(key)) {
    lruCache.delete(key);
  } else if (lruCache.size >= LRU_MAX) {
    // Evict oldest (first inserted) entry
    const firstKey = lruCache.keys().next().value;
    if (firstKey !== undefined) lruCache.delete(firstKey);
  }
  lruCache.set(key, value);
}

/** Canonical, stable string for cache keying. Keys sorted so field order doesn't matter. */
function stableInputString(input: ComplianceScanInput): string {
  const obj: Record<string, string | null | undefined> = {
    caption: input.caption,
    hook: input.hook,
    body: input.body,
    cta: input.cta,
    imageTagsOrAltText: input.imageTagsOrAltText,
    landingPageUrl: input.landingPageUrl,
  };
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// ─── Report merge helpers ─────────────────────────────────────────────────────

const STATUS_RANK: Record<ComplianceReport["status"], number> = {
  passed: 0,
  warned: 1,
  rejected: 2,
};

function worstStatus(
  a: ComplianceReport["status"],
  b: ComplianceReport["status"],
): ComplianceReport["status"] {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

function dedupeIssues(issues: ComplianceIssue[]): ComplianceIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.code)) return false;
    seen.add(issue.code);
    return true;
  });
}

function mergeReports(regex: ComplianceReport, llm: ComplianceReport): ComplianceReport {
  const warnings = dedupeIssues([...regex.warnings, ...llm.warnings]);
  const errors = dedupeIssues([...regex.errors, ...llm.errors]);
  const status = worstStatus(
    worstStatus(regex.status, llm.status),
    errors.length > 0 ? "rejected" : warnings.length > 0 ? "warned" : "passed",
  );
  return {
    status,
    warnings,
    errors,
    policyVersion: COMBINED_POLICY_VERSION,
  };
}

function runRules(text: string): { warnings: ComplianceIssue[]; errors: ComplianceIssue[] } {
  const warnings: ComplianceIssue[] = [];
  const errors: ComplianceIssue[] = [];

  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (match) {
      const issue: ComplianceIssue = {
        code: rule.code,
        message: rule.message,
        evidence: match[0].slice(0, 120),
      };
      if (rule.severity === "error") {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }

  return { warnings, errors };
}

// ─── Public alias kept for backward compat with existing callers ──────────────
export function scanCompliance(input: ComplianceScanInput): ComplianceReport {
  return scanText(input);
}

export function scanText(input: ComplianceScanInput): ComplianceReport {
  const combined = [
    input.caption,
    input.hook,
    input.body,
    input.cta,
    input.imageTagsOrAltText,
    input.landingPageUrl,
  ]
    .filter(Boolean)
    .join(" ");

  const { warnings, errors } = runRules(combined);

  let status: ComplianceReport["status"];
  if (errors.length > 0) {
    status = "rejected";
  } else if (warnings.length > 0) {
    status = "warned";
  } else {
    status = "passed";
  }

  return {
    status,
    warnings,
    errors,
    policyVersion: POLICY_VERSION,
  };
}

/**
 * Phase 2c — LLM-enhanced compliance scan.
 *
 * Strategy:
 *  1. Run regex scanner first (free, instant).
 *  2. If regex → rejected (hard error), fast-fail — skip the LLM entirely.
 *  3. If regex → passed or warned, call Claude Haiku for a second-pass review.
 *  4. Merge results (worst-of status, concatenated + deduped issues).
 *  5. Cache merged result in-process (LRU 500) keyed by SHA-256 of input.
 *  6. On LLM failure, fail open: return regex result + llm_unavailable warning.
 *  7. If skipLlm or ANTHROPIC_API_KEY is absent, return regex result only.
 */
export async function scanWithLlm(
  input: ComplianceScanInput,
  options?: { skipLlm?: boolean },
): Promise<ComplianceReport> {
  const regex = scanCompliance(input);

  // Fast-fail path: hard errors caught by regex, no need to spend on LLM
  if (regex.status === "rejected" || options?.skipLlm) return regex;

  // Cache lookup
  const key = sha256(stableInputString(input));
  const cached = lruGet(key);
  if (cached !== undefined) return cached;

  try {
    const llm = await scanComplianceWithLlm(input);
    const merged = mergeReports(regex, llm);
    lruSet(key, merged);
    return merged;
  } catch (err) {
    // Fail open — surface regex result but flag that LLM was unavailable
    const message = err instanceof Error ? err.message : String(err);
    const fallback: ComplianceReport = {
      ...regex,
      warnings: [
        ...regex.warnings,
        { code: "llm_unavailable", message },
      ],
    };
    return fallback;
  }
}

// Export cache internals for test introspection only
export { lruCache as _lruCacheForTests };
