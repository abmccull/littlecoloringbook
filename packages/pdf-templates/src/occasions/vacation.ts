import type { OccasionModule } from "../types.js";

export const vacationOccasion: OccasionModule = {
  id: "vacation",
  category: "travel",
  label: "Our Vacation",
  titleTemplate: "Our Trip to {location}",
  subtitleTemplate: "{childName}'s coloring book from {location} · {year}",
  requiredContext: ["childName", "location"],
  styleConstraints: null,
  dedicationPrompt: "Where did you go, and what do you want to remember forever?",
  captionPrompt: "Where was this photo taken?",
  backMatter: "A little coloring book from our trip to {location} — made with love by {authorLine}",
};
