/**
 * Keyword-based auto-reply matcher.
 *
 * Accepts a list of KeywordResponse rules (ordered by created_at by the caller),
 * normalises the incoming text, and returns the first matching rule.
 *
 * Matching is intentionally pure/synchronous so it can be unit-tested without
 * any I/O. The caller is responsible for fetching rules and persisting matches.
 */

export type KeywordResponse = {
  id: string;
  matchKind: "exact" | "contains" | "prefix" | "regex";
  matchPattern: string;
  responseBody: string;
  /** null = applies to any platform */
  platform: "fb_messenger" | "ig_direct" | null;
};

/**
 * Returns the first matching KeywordResponse for the given text + platform,
 * or null if no rule matches.
 *
 * Rules are evaluated in the order they are provided (caller must pass them
 * ordered by created_at ascending for deterministic first-match-wins behaviour).
 */
export function matchAutoReply(
  incomingText: string,
  platform: "fb_messenger" | "ig_direct",
  rules: KeywordResponse[],
): KeywordResponse | null {
  // Normalise once — all comparisons use this value.
  const normalised = incomingText.toLowerCase().trim();

  for (const rule of rules) {
    // Platform filter: null = applies to both; otherwise must match exactly.
    if (rule.platform !== null && rule.platform !== platform) {
      continue;
    }

    const pattern = rule.matchPattern.toLowerCase().trim();

    switch (rule.matchKind) {
      case "exact":
        if (normalised === pattern) return rule;
        break;

      case "contains":
        if (normalised.includes(pattern)) return rule;
        break;

      case "prefix":
        if (normalised.startsWith(pattern)) return rule;
        break;

      case "regex": {
        let re: RegExp;
        try {
          re = new RegExp(rule.matchPattern, "i");
        } catch {
          // Invalid regex — skip silently rather than crashing the webhook.
          continue;
        }
        if (re.test(incomingText)) return rule;
        break;
      }

      default:
        // Unknown match kind — skip.
        break;
    }
  }

  return null;
}
