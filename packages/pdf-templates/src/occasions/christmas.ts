import type { OccasionModule } from "../types";

export const christmasOccasion: OccasionModule = {
  id: "christmas",
  category: "holidays",
  label: "Christmas",
  titleTemplate: "{childName}'s Christmas {year}",
  subtitleTemplate: "A holiday coloring book",
  requiredContext: ["childName", "year"],
  styleConstraints: null,
  dedicationPrompt: "What Christmas wish do you want to write?",
  captionPrompt: "What holiday moment does this capture?",
  backMatter: "Merry Christmas, {childName}! Made with love by {authorLine} · {year}",
};
