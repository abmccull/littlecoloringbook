import type { OccasionModule } from "../types.js";

export const grandparentsKeepsakeOccasion: OccasionModule = {
  id: "grandparents-keepsake",
  category: "family",
  label: "Grandparents Keepsake",
  titleTemplate: "For Grandma & Grandpa, From {childName}",
  subtitleTemplate: "A coloring book made just for you",
  requiredContext: ["childName"],
  styleConstraints: null,
  dedicationPrompt: "What do you want to say to Grandma and Grandpa?",
  captionPrompt: "What's your favorite memory with your grandparents?",
  backMatter: "Made with love for the best grandparents — from {childName}",
};
