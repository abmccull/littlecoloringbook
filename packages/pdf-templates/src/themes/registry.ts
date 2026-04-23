import { coverDesigns } from "@littlecolorbook/shared";
import type { StyleId, StyleModule } from "../types";

const fontByTypography = {
  clean: "Inter",
  editorial: "Playfair Display",
  hand: "Caveat",
  playful: "Fredoka",
} as const;

export const styles = Object.fromEntries(
  coverDesigns.map((design) => [
    design.id,
    {
      id: design.id,
      label: design.label,
      fontFamily: fontByTypography[design.typography],
      accentColor: design.palette.accent,
      secondaryColor: design.palette.paperAlt,
    },
  ]),
) as Record<StyleId, StyleModule>;

export function getStyle(id: StyleId): StyleModule {
  const style = styles[id];
  if (!style) {
    throw new Error(`Unknown style id: ${id}`);
  }
  return style;
}
