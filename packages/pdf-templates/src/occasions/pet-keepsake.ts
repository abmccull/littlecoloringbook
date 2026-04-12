import type { OccasionModule } from "../types.js";

export const petKeepsakeOccasion: OccasionModule = {
  id: "pet-keepsake",
  category: "pets",
  label: "Pet Keepsake",
  titleTemplate: "{petName}: A Coloring Book",
  subtitleTemplate: "Our favorite moments with {petName}",
  requiredContext: ["childName", "petName"],
  styleConstraints: null,
  dedicationPrompt: "What makes your pet special?",
  captionPrompt: "What is your pet doing in this photo?",
  backMatter: "A little coloring book celebrating {petName} — made with love by {authorLine}",
};
