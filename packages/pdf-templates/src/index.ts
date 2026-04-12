export type {
  BookPayload,
  BookExtras,
  ColoringPageEntry,
  CoverSource,
  ImageRef,
  OccasionCategory,
  OccasionContext,
  OccasionId,
  OccasionModule,
  StockCover,
  StockCoverAge,
  StockCoverId,
  StockCoverLean,
  StyleId,
  StyleModule,
  TrimSpec,
} from "./types.js";

export { stockCovers, getStockCover, filterStockCovers } from "./covers/manifest.js";
export { getTrim, getSpineWidth, getProduct, ensurePageCountParity, DEFAULT_SKU } from "./render/lulu-trim.js";

export { styles, getStyle } from "./themes/registry.js";
export { occasions, getOccasion } from "./occasions/registry.js";
export { interpolate } from "./occasions/interpolate.js";
export { validateOccasionContext } from "./occasions/validate.js";

export { renderCoverPdf } from "./render/render-cover.js";
export { renderInteriorPdf } from "./render/render-interior.js";

export { milaSwordPlayFixture } from "./fixtures/mila-sword-play.js";
