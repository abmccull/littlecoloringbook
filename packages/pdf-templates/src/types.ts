// ---------------------------------------------------------------------------
// Core data contract — every template, renderer, and fixture speaks this type.
// ---------------------------------------------------------------------------

export type ImageRef = {
  url: string;
  widthPx: number;
  heightPx: number;
};

export type TrimSpec = {
  widthIn: number;
  heightIn: number;
  bleedIn: number;
  safeIn: number;
};

// ---- Axis 1 — Visual style (typography, color, decoration) ----------------

export type StyleId = "sunshine" | "crayon" | "storybook" | "minimal";

export type StyleModule = {
  id: StyleId;
  label: string;
  fontFamily: string;
  accentColor: string;
  secondaryColor: string;
};

// ---- Axis 2 — Occasion theme (motifs, copy, extra pages) -----------------

export type OccasionId =
  | "everyday"
  | "birthday"
  | "milestone-birthday"
  | "first-birthday"
  | "graduation"
  | "wedding-day"
  | "quinceañera-bar-bat-mitzvah"
  | "pet-keepsake"
  | "gotcha-day"
  | "new-pet"
  | "pet-memorial"
  | "vacation"
  | "road-trip"
  | "national-park"
  | "disney-parks"
  | "beach-trip"
  | "christmas"
  | "hanukkah"
  | "halloween"
  | "thanksgiving"
  | "easter"
  | "valentines"
  | "lunar-new-year"
  | "diwali"
  | "grandparents-keepsake"
  | "new-baby"
  | "big-sibling"
  | "family-reunion"
  | "adoption-day"
  | "school-year"
  | "first-day-of-school"
  | "sports-season"
  | "dance-recital"
  | "in-memory"
  | "moving-new-home";

export type OccasionCategory =
  | "everyday"
  | "celebrations"
  | "pets"
  | "travel"
  | "holidays"
  | "family"
  | "school";

export type OccasionModule = {
  id: OccasionId;
  category: OccasionCategory;
  label: string;
  titleTemplate: string;
  subtitleTemplate: string;
  requiredContext: Array<keyof OccasionContext>;
  styleConstraints: StyleId[] | null;
  dedicationPrompt: string;
  captionPrompt: string;
  backMatter: string;
};

// ---- Occasion context — tokens that templates interpolate ----------------

export type OccasionContext = {
  childName: string;
  age?: number;
  year?: number;
  location?: string;
  petName?: string;
  petSpecies?: "dog" | "cat" | "bunny" | "other";
  role?: "flower girl" | "ring bearer";
  lastName?: string;
  grade?: string;
  sport?: string;
  ceremony?: "quinceañera" | "bar mitzvah" | "bat mitzvah";
};

// ---- Stock cover art library ----------------------------------------------

export type StockCoverLean = "girls" | "boys" | "neutral";
export type StockCoverAge = "2-4" | "5-8" | "9-12";

export type StockCoverId = string;

export type StockCover = {
  id: StockCoverId;
  label: string;
  ageRange: StockCoverAge;
  lean: StockCoverLean;
  tags: string[];
  pdfPath: string;
  thumbPath: string;
  textSafeZone: { x: number; y: number; width: number; height: number };
};

// ---- Cover source ---------------------------------------------------------

export type CoverSource =
  | { type: "customer-photo"; photo: ImageRef }
  | { type: "stock-art"; stockArtId: StockCoverId };

// ---- Coloring page entry --------------------------------------------------

export type ColoringPageEntry = {
  lineArt: ImageRef;
  caption?: string;
  sourcePhotoThumb?: ImageRef;
};

// ---- Extras for occasion-specific pages -----------------------------------

export type BookExtras = {
  santaLetter?: string;
  thankfulList?: string[];
  itinerary?: Array<{ day: number; caption: string; photo?: ImageRef }>;
  familyTree?: Array<{ name: string; relation: string }>;
  petProfile?: { breed?: string; age?: number; favorites?: string[] };
};

// ---- Top-level payload — the single blob that drives everything -----------

export type BookPayload = {
  trim: TrimSpec;
  spineWidthIn: number;
  pageCount: number;

  style: StyleId;
  occasion: OccasionId;

  occasionContext: OccasionContext;

  meta: {
    title?: string;
    subtitle?: string;
    dedication?: string;
    authorLine?: string;
    createdOn: string;
  };

  cover: CoverSource;

  pages: ColoringPageEntry[];

  extras?: BookExtras;
};
