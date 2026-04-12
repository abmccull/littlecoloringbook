import type { OccasionContext } from "../types";

/**
 * Replaces {token} placeholders in a template string with values from context.
 *
 * Token resolution order:
 * 1. extras (e.g. authorLine passed in from meta)
 * 2. OccasionContext fields
 *
 * If a token is present in the template but has no resolved value, the
 * braces are stripped and the raw token name is output (e.g. {age} → "age").
 */
export function interpolate(
  template: string,
  context: OccasionContext,
  extras?: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    // 1. Check extras first (e.g. authorLine)
    if (extras !== undefined && Object.prototype.hasOwnProperty.call(extras, token)) {
      return extras[token] ?? token;
    }

    // 2. Check OccasionContext
    if (Object.prototype.hasOwnProperty.call(context, token)) {
      const value = (context as Record<string, unknown>)[token];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }

    // 3. Token exists in template but value is undefined — return token name without braces
    return token;
  });
}
