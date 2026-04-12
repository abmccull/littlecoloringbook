import type { BookPayload } from "../types";

export const milaSwordPlayFixture: BookPayload = {
  trim: { widthIn: 8.5, heightIn: 11, bleedIn: 0.125, safeIn: 0.25 },
  spineWidthIn: 0.15,
  pageCount: 6,
  style: "storybook",
  occasion: "everyday",
  occasionContext: { childName: "Mila" },
  meta: {
    title: "Mila's Coloring Book",
    subtitle: "A little coloring book",
    dedication: "For our favorite little artist",
    authorLine: "Mom & Dad",
    createdOn: "2026-04-11",
  },
  cover: {
    type: "customer-photo",
    photo: {
      url: "/proof/real-sword-play-photo.jpeg",
      widthPx: 1200,
      heightPx: 900,
    },
  },
  pages: [
    {
      lineArt: { url: "/proof/real-sword-play-coloring-page.jpeg", widthPx: 1200, heightPx: 900 },
      caption: "Sword fight in the living room",
    },
    {
      lineArt: { url: "/proof/real-family-play-coloring-page.jpeg", widthPx: 1200, heightPx: 900 },
      caption: "Family playtime",
    },
    {
      lineArt: { url: "/proof/kid-page.png", widthPx: 800, heightPx: 600 },
    },
    {
      lineArt: { url: "/proof/pet-page.png", widthPx: 800, heightPx: 600 },
      caption: "Our furry friend",
    },
  ],
};
