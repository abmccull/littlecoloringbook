import type { OccasionContext, OccasionModule } from "../types";

/**
 * Validates that context contains all required fields declared by the occasion.
 *
 * A required field is considered present when it exists on the context object
 * AND its value is not undefined.
 */
export function validateOccasionContext(
  occasion: OccasionModule,
  context: OccasionContext,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const key of occasion.requiredContext) {
    const value = (context as Record<string, unknown>)[key];
    if (value === undefined || value === null) {
      missing.push(key);
    }
  }

  return { valid: missing.length === 0, missing };
}
