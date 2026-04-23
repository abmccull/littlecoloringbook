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
} from "./types";

export { stockCovers, getStockCover, filterStockCovers } from "./covers/manifest";
export { getTrim, getSpineWidth, getProduct, ensurePageCountParity, DEFAULT_SKU } from "./render/lulu-trim";

export { styles, getStyle } from "./themes/registry";
export { occasions, getOccasion } from "./occasions/registry";
export { interpolate } from "./occasions/interpolate";
export { validateOccasionContext } from "./occasions/validate";

export { renderCoverPdf } from "./render/render-cover";
export { renderInteriorPdf } from "./render/render-interior";
export { renderCameraRollPlaybookPdf, renderPhotoPickerGuidePdf } from "./render/render-photo-picker-guide";
export { renderPartyKitPdf, renderQuietTimePackPdf } from "./render/render-party-kit";
export { renderKeepsakeCompanionPdf } from "./render/render-keepsake-companion";
export type { PartyKitInput, QuietTimePackInput } from "./render/render-party-kit";
export type { CameraRollPlaybookInput } from "./render/render-photo-picker-guide";
export type { KeepsakeCompanionInput } from "./render/render-keepsake-companion";

export { milaSwordPlayFixture } from "./fixtures/mila-sword-play";
