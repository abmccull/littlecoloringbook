export const coverStyleValues = ["storybook", "sunshine", "adventure"] as const;

export type CoverStyleCode = (typeof coverStyleValues)[number];
export type CopyNameList = Array<string | null>;

export const defaultCoverStyle: CoverStyleCode = "storybook";

export function normalizeCoverStyle(value?: string | null): CoverStyleCode {
  return coverStyleValues.includes(value as CoverStyleCode) ? (value as CoverStyleCode) : defaultCoverStyle;
}

export function normalizeCopyNames(values?: Array<string | null | undefined> | null, quantity = 1): CopyNameList | null {
  const safeQuantity = Math.max(1, Math.trunc(quantity));
  const normalized = Array.from({ length: safeQuantity }, (_, index) => {
    const value = values?.[index]?.trim();
    return value ? value.slice(0, 80) : null;
  });

  return normalized.some((value) => value) ? normalized : null;
}
