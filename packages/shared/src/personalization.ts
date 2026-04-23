export {
  coverDesigns,
  coverStyleValues,
  defaultCoverStyle,
  featuredCoverDesigns,
  getCoverDesign,
  moreCoverDesigns,
  normalizeCoverStyle,
  type CoverDesign,
  type CoverDesignGroup,
  type CoverDesignMotif,
  type CoverDesignTypography,
  type CoverStyleCode,
} from "./cover-designs";

export type CopyNameList = Array<string | null>;

export function normalizeCopyNames(values?: Array<string | null | undefined> | null, quantity = 1): CopyNameList | null {
  const safeQuantity = Math.max(1, Math.trunc(quantity));
  const normalized = Array.from({ length: safeQuantity }, (_, index) => {
    const value = values?.[index]?.trim();
    return value ? value.slice(0, 80) : null;
  });

  return normalized.some((value) => value) ? normalized : null;
}
