import type { OccasionModule } from "../types";

export const everydayOccasion: OccasionModule = {
  id: "everyday",
  category: "everyday",
  label: "Everyday Keepsake",
  titleTemplate: "{childName}'s Coloring Book",
  subtitleTemplate: "A little coloring book",
  requiredContext: ["childName"],
  styleConstraints: null,
  dedicationPrompt: "Who is this book for? What makes them special?",
  captionPrompt: "What's happening in this photo?",
  backMatter: "A little coloring book made with love by {authorLine}",
};
