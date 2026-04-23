export type CoverDesignGroup = "featured" | "more";

export type CoverDesignMotif =
  | "linen-frame"
  | "storybook-window"
  | "memory-album"
  | "heritage-crest"
  | "grandparent-keepsake"
  | "birthday-capsule"
  | "adventure-map"
  | "field-notebook"
  | "space-explorer"
  | "ocean-porthole"
  | "dino-discovery"
  | "wild-safari"
  | "superhero-spotlight"
  | "comic-panels"
  | "sports-all-star"
  | "creative-studio"
  | "fairy-garden"
  | "starry-stage"
  | "bedtime-story"
  | "pet-club";

export type CoverDesignTypography = "editorial" | "clean" | "playful" | "hand";

export type CoverDesign = {
  id: string;
  label: string;
  shortLabel: string;
  group: CoverDesignGroup;
  description: string;
  bestFor: string;
  motif: CoverDesignMotif;
  typography: CoverDesignTypography;
  heroTreatment: "photo-frame" | "line-art-window" | "graphic-badge" | "panel-stack";
  palette: {
    paper: string;
    paperAlt: string;
    ink: string;
    muted: string;
    accent: string;
    accent2: string;
    accent3: string;
    foil: string;
  };
};

export const coverDesigns = [
  {
    id: "signature-linen",
    label: "Signature Linen Frame",
    shortLabel: "Signature Linen",
    group: "featured",
    description: "Boutique keepsake cover with linen texture, refined frame lines, and an heirloom title plate.",
    bestFor: "The safest premium default for parents and grandparents.",
    motif: "linen-frame",
    typography: "editorial",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#F8F1E6",
      paperAlt: "#EFE1CE",
      ink: "#17233B",
      muted: "#7A685A",
      accent: "#B98B59",
      accent2: "#234B46",
      accent3: "#D8A9A1",
      foil: "#C6A15B",
    },
  },
  {
    id: "modern-storybook",
    label: "Modern Storybook Window",
    shortLabel: "Storybook Window",
    group: "featured",
    description: "A rounded storybook window, soft color blocking, and polished kid-friendly details.",
    bestFor: "The strongest universal kid-facing cover.",
    motif: "storybook-window",
    typography: "playful",
    heroTreatment: "line-art-window",
    palette: {
      paper: "#F5EBDD",
      paperAlt: "#DFE9E8",
      ink: "#283247",
      muted: "#6D7483",
      accent: "#C86F55",
      accent2: "#8CA995",
      accent3: "#F0C85F",
      foil: "#C09147",
    },
  },
  {
    id: "family-memory-album",
    label: "Family Memory Album",
    shortLabel: "Memory Album",
    group: "featured",
    description: "Layered photo cards, deckled paper notes, tape details, and a warm family album feel.",
    bestFor: "Photo-rich books with siblings, trips, birthdays, and family moments.",
    motif: "memory-album",
    typography: "editorial",
    heroTreatment: "panel-stack",
    palette: {
      paper: "#F7EFE3",
      paperAlt: "#EBDCC8",
      ink: "#2C231F",
      muted: "#746A60",
      accent: "#C48363",
      accent2: "#6F8F7A",
      accent3: "#D8C39F",
      foil: "#B8894F",
    },
  },
  {
    id: "heritage-crest",
    label: "Heritage Crest",
    shortLabel: "Heritage Crest",
    group: "featured",
    description: "A custom family-badge direction with classic crests, icons, and deep keepsake color.",
    bestFor: "Older kids and gift buyers who want premium without needing a cover photo.",
    motif: "heritage-crest",
    typography: "editorial",
    heroTreatment: "graphic-badge",
    palette: {
      paper: "#F5EADC",
      paperAlt: "#E8D4BC",
      ink: "#24362E",
      muted: "#756455",
      accent: "#6F1F2A",
      accent2: "#285546",
      accent3: "#D4A65A",
      foil: "#D4A65A",
    },
  },
  {
    id: "grandparent-keepsake",
    label: "Grandparent Keepsake Edition",
    shortLabel: "Grandparent Keepsake",
    group: "featured",
    description: "Soft botanicals, dedication ribbon, and a sentimental gift-ready frame.",
    bestFor: "Books made for grandparents or from grandparents.",
    motif: "grandparent-keepsake",
    typography: "editorial",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#FFF4EA",
      paperAlt: "#F1DED1",
      ink: "#382A26",
      muted: "#7C6860",
      accent: "#BE6F68",
      accent2: "#78977C",
      accent3: "#E8C6A6",
      foil: "#B78B52",
    },
  },
  {
    id: "birthday-time-capsule",
    label: "Birthday Time Capsule",
    shortLabel: "Birthday Capsule",
    group: "featured",
    description: "Party-invitation polish with an oversized age mark, confetti, candles, and a keepsake frame.",
    bestFor: "Birthday books that need to feel celebratory but not cheap.",
    motif: "birthday-capsule",
    typography: "playful",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#FFF2DD",
      paperAlt: "#FFE0D1",
      ink: "#32213A",
      muted: "#7E6274",
      accent: "#E35D5B",
      accent2: "#F4B64A",
      accent3: "#80A7D8",
      foil: "#D99A32",
    },
  },
  {
    id: "adventure-map",
    label: "Adventure Map",
    shortLabel: "Adventure Map",
    group: "featured",
    description: "A refined map cover with route lines, compass details, and small memory-place icons.",
    bestFor: "Travel, outdoor, beach, park, and vacation books.",
    motif: "adventure-map",
    typography: "clean",
    heroTreatment: "line-art-window",
    palette: {
      paper: "#F3ECD8",
      paperAlt: "#D9E5D2",
      ink: "#263B39",
      muted: "#6C746B",
      accent: "#C66A3D",
      accent2: "#527D76",
      accent3: "#D8B462",
      foil: "#B98D3C",
    },
  },
  {
    id: "creative-studio",
    label: "Creative Studio",
    shortLabel: "Creative Studio",
    group: "featured",
    description: "A boutique art-studio sketchbook with swatches, taped corners, pencil marks, and a signature line.",
    bestFor: "Artsy kids and older-kid books that should feel less babyish.",
    motif: "creative-studio",
    typography: "hand",
    heroTreatment: "panel-stack",
    palette: {
      paper: "#FCF7EC",
      paperAlt: "#EFE5D1",
      ink: "#26211C",
      muted: "#71685F",
      accent: "#D16F4D",
      accent2: "#3F6F70",
      accent3: "#E5BF57",
      foil: "#B9873D",
    },
  },
  {
    id: "field-notebook",
    label: "Adventure Badge Field Notebook",
    shortLabel: "Field Notebook",
    group: "more",
    description: "Patch-covered field journal energy with stamps, stitched badges, and a centered name label.",
    bestFor: "Camp, scouts, parks, and kids who like collecting badges.",
    motif: "field-notebook",
    typography: "clean",
    heroTreatment: "graphic-badge",
    palette: {
      paper: "#EEE0C7",
      paperAlt: "#D6C09C",
      ink: "#2F2B1F",
      muted: "#746A50",
      accent: "#B95D35",
      accent2: "#596D3C",
      accent3: "#C99A45",
      foil: "#A57C35",
    },
  },
  {
    id: "space-explorer",
    label: "Space Explorer",
    shortLabel: "Space Explorer",
    group: "more",
    description: "Museum-gift-shop space cover with constellations, orbit lines, and a circular mission frame.",
    bestFor: "Kids who love rockets, stars, planets, and science.",
    motif: "space-explorer",
    typography: "clean",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#111B33",
      paperAlt: "#1E2B4D",
      ink: "#F6F0E6",
      muted: "#B7C0D9",
      accent: "#E6B85C",
      accent2: "#74A7D8",
      accent3: "#D88B8D",
      foil: "#E6B85C",
    },
  },
  {
    id: "ocean-porthole",
    label: "Ocean Explorer Porthole",
    shortLabel: "Ocean Porthole",
    group: "more",
    description: "A polished porthole cover with wave bands, shells, coral marks, and captain-log labeling.",
    bestFor: "Beach trips, lake days, cruises, and ocean-loving kids.",
    motif: "ocean-porthole",
    typography: "clean",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#E8F3F1",
      paperAlt: "#CFE4E1",
      ink: "#173E49",
      muted: "#5F7980",
      accent: "#D4865E",
      accent2: "#2C7685",
      accent3: "#F2C869",
      foil: "#C08B45",
    },
  },
  {
    id: "dino-discovery",
    label: "Dino Discovery",
    shortLabel: "Dino Discovery",
    group: "more",
    description: "A refined fossil notebook with excavation marks, labels, stone texture, and dinosaur silhouettes.",
    bestFor: "Dinosaur-loving kids ages 5 to 8.",
    motif: "dino-discovery",
    typography: "clean",
    heroTreatment: "graphic-badge",
    palette: {
      paper: "#EFE4CF",
      paperAlt: "#D7C9AF",
      ink: "#343225",
      muted: "#7A715F",
      accent: "#9C6B3E",
      accent2: "#5F744E",
      accent3: "#C8A960",
      foil: "#A77C3F",
    },
  },
  {
    id: "wild-safari",
    label: "Wild Safari",
    shortLabel: "Wild Safari",
    group: "more",
    description: "Leaf canopies, paw tracks, sun disks, and refined animal silhouettes without cartoon clutter.",
    bestFor: "Animal-loving kids and outdoor family moments.",
    motif: "wild-safari",
    typography: "playful",
    heroTreatment: "line-art-window",
    palette: {
      paper: "#F4E8CF",
      paperAlt: "#DBCC9F",
      ink: "#2E3422",
      muted: "#6F725F",
      accent: "#B96E38",
      accent2: "#607A43",
      accent3: "#E0B957",
      foil: "#B7893F",
    },
  },
  {
    id: "superhero-spotlight",
    label: "Superhero Spotlight",
    shortLabel: "Superhero",
    group: "more",
    description: "Graphic rays, shield framing, and controlled action energy that still feels giftable.",
    bestFor: "High-energy kids who want to feel like the star.",
    motif: "superhero-spotlight",
    typography: "playful",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#F6E8D7",
      paperAlt: "#F9D65B",
      ink: "#1F2746",
      muted: "#676B82",
      accent: "#C9433D",
      accent2: "#315BA7",
      accent3: "#F2B84B",
      foil: "#D79B2E",
    },
  },
  {
    id: "comic-panel-adventure",
    label: "Comic Panel Adventure",
    shortLabel: "Comic Panels",
    group: "more",
    description: "A clean graphic-novel grid that can hint at the pages inside without looking disposable.",
    bestFor: "Older kids, sibling books, and action-heavy memories.",
    motif: "comic-panels",
    typography: "clean",
    heroTreatment: "panel-stack",
    palette: {
      paper: "#FFF7E8",
      paperAlt: "#F3DFB5",
      ink: "#171717",
      muted: "#5E5A54",
      accent: "#D9473F",
      accent2: "#2C6EAC",
      accent3: "#EBC34A",
      foil: "#BD8A2F",
    },
  },
  {
    id: "sports-all-star",
    label: "Sports All-Star",
    shortLabel: "All-Star",
    group: "more",
    description: "Varsity stripes, ticket-stub details, number blocks, and athletic framing.",
    bestFor: "Sports, dance, gymnastics, and performance seasons.",
    motif: "sports-all-star",
    typography: "clean",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#F4EFE6",
      paperAlt: "#E7D8C2",
      ink: "#1F2E36",
      muted: "#64717A",
      accent: "#B73E35",
      accent2: "#244F73",
      accent3: "#D5A843",
      foil: "#C59237",
    },
  },
  {
    id: "fairy-garden",
    label: "Fairy Garden",
    shortLabel: "Fairy Garden",
    group: "more",
    description: "Botanical arch, tiny stars, mushrooms, butterflies, and premium woodland softness.",
    bestFor: "Whimsical younger-kid books without going full princess.",
    motif: "fairy-garden",
    typography: "editorial",
    heroTreatment: "line-art-window",
    palette: {
      paper: "#FFF1EA",
      paperAlt: "#E5D7E8",
      ink: "#3D2D3F",
      muted: "#786A7A",
      accent: "#B66F89",
      accent2: "#799F73",
      accent3: "#E5BD6B",
      foil: "#C69B4C",
    },
  },
  {
    id: "starry-stage",
    label: "Starry Stage",
    shortLabel: "Starry Stage",
    group: "more",
    description: "Marquee lights, stage curtains, spotlight arcs, and theatrical title structure.",
    bestFor: "Dance recitals, performances, theater kids, and big-personality books.",
    motif: "starry-stage",
    typography: "editorial",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#2B1530",
      paperAlt: "#4D244F",
      ink: "#FFF4E7",
      muted: "#DBC5DB",
      accent: "#D44D5C",
      accent2: "#F0B84A",
      accent3: "#7EA6D9",
      foil: "#F0B84A",
    },
  },
  {
    id: "cozy-bedtime-story",
    label: "Cozy Bedtime Story",
    shortLabel: "Bedtime Story",
    group: "more",
    description: "Moon, window, quilt, lamp, and quiet-time details in a calm giftable palette.",
    bestFor: "Younger kids and mellow screen-free evening books.",
    motif: "bedtime-story",
    typography: "editorial",
    heroTreatment: "line-art-window",
    palette: {
      paper: "#F4E8DC",
      paperAlt: "#D7DCE8",
      ink: "#263049",
      muted: "#6E7283",
      accent: "#8A6F9E",
      accent2: "#D39E62",
      accent3: "#8CA6A6",
      foil: "#C59551",
    },
  },
  {
    id: "pet-best-friend-club",
    label: "Pet Best Friend Club",
    shortLabel: "Pet Club",
    group: "more",
    description: "Warm child-and-pet club-badge cover with paw marks, tag details, and sentimental framing.",
    bestFor: "Pet-heavy books and child-plus-best-friend memories.",
    motif: "pet-club",
    typography: "playful",
    heroTreatment: "photo-frame",
    palette: {
      paper: "#FFF0DF",
      paperAlt: "#EDD7BE",
      ink: "#33261F",
      muted: "#76665A",
      accent: "#C56F45",
      accent2: "#628263",
      accent3: "#E6B65B",
      foil: "#BA8541",
    },
  },
] as const satisfies readonly CoverDesign[];

export type CoverStyleCode = (typeof coverDesigns)[number]["id"];

export const coverStyleValues = coverDesigns.map((design) => design.id) as CoverStyleCode[];

export const defaultCoverStyle: CoverStyleCode = "signature-linen";

const coverStyleValueSet = new Set<string>(coverStyleValues);

const legacyCoverStyleMap: Record<string, CoverStyleCode> = {
  adventure: "adventure-map",
  crayon: "creative-studio",
  minimal: "signature-linen",
  storybook: "signature-linen",
  sunshine: "modern-storybook",
};

export function normalizeCoverStyle(value?: string | null): CoverStyleCode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return defaultCoverStyle;
  }

  if (coverStyleValueSet.has(normalized)) {
    return normalized as CoverStyleCode;
  }

  return legacyCoverStyleMap[normalized] ?? defaultCoverStyle;
}

export function getCoverDesign(id?: string | null): CoverDesign {
  const normalized = normalizeCoverStyle(id);
  return coverDesigns.find((design) => design.id === normalized) ?? coverDesigns[0]!;
}

export const featuredCoverDesigns = coverDesigns.filter((design) => design.group === "featured");
export const moreCoverDesigns = coverDesigns.filter((design) => design.group === "more");
