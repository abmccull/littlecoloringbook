import type { OccasionModule } from "../types.js";

export const birthdayOccasion: OccasionModule = {
  id: "birthday",
  category: "celebrations",
  label: "Birthday",
  titleTemplate: "{childName} Turns {age}!",
  subtitleTemplate: "A birthday coloring book",
  requiredContext: ["childName", "age"],
  styleConstraints: null,
  dedicationPrompt: "What birthday wish do you want to write?",
  captionPrompt: "What birthday moment does this capture?",
  backMatter: "Happy birthday, {childName}! Made with love by {authorLine}",
};
