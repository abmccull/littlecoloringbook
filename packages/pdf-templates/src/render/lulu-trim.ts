import type { TrimSpec } from "../types";

type LuluProduct = {
  podPackageId: string;
  label: string;
  trim: TrimSpec;
  minPages: number;
  maxPages: number;
  spineWidthPerPage: number;
  baseSpine: number;
};

const PRODUCTS: Record<string, LuluProduct> = {
  // 8.5 × 11 coil-bound, standard color, 60# uncoated
  "0850X1100FCCOBU060UW444GXX": {
    podPackageId: "0850X1100FCCOBU060UW444GXX",
    label: "8.5×11 Coil-Bound Color",
    trim: {
      widthIn: 8.5,
      heightIn: 11,
      bleedIn: 0.125,
      safeIn: 0.25,
    },
    minPages: 24,
    maxPages: 300,
    spineWidthPerPage: 0.0025,
    baseSpine: 0.08,
  },
  // 8.5 × 8.5 coil-bound square
  "0850X0850FCCOBU060UW444GXX": {
    podPackageId: "0850X0850FCCOBU060UW444GXX",
    label: "8.5×8.5 Coil-Bound Square",
    trim: {
      widthIn: 8.5,
      heightIn: 8.5,
      bleedIn: 0.125,
      safeIn: 0.25,
    },
    minPages: 24,
    maxPages: 300,
    spineWidthPerPage: 0.0025,
    baseSpine: 0.08,
  },
};

const DEFAULT_SKU = "0850X1100FCCOBU060UW444GXX";

export function getTrim(sku?: string): TrimSpec {
  const product = PRODUCTS[sku ?? DEFAULT_SKU];
  if (!product) throw new Error(`Unknown Lulu SKU: ${sku}`);
  return product.trim;
}

export function getSpineWidth(pageCount: number, sku?: string): number {
  const product = PRODUCTS[sku ?? DEFAULT_SKU];
  if (!product) throw new Error(`Unknown Lulu SKU: ${sku}`);
  return product.baseSpine + product.spineWidthPerPage * pageCount;
}

export function getProduct(sku?: string): LuluProduct {
  const product = PRODUCTS[sku ?? DEFAULT_SKU];
  if (!product) throw new Error(`Unknown Lulu SKU: ${sku}`);
  return product;
}

export function ensurePageCountParity(contentPages: number): number {
  return contentPages % 2 === 0 ? contentPages : contentPages + 1;
}

export { DEFAULT_SKU, PRODUCTS };
