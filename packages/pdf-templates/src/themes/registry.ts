import type { StyleId, StyleModule } from "../types.js";

// ---------------------------------------------------------------------------
// Style registry — one entry per visual style axis value.
// ---------------------------------------------------------------------------

const sunshine: StyleModule = {
  id: "sunshine",
  label: "Sunshine",
  fontFamily: "Fredoka",
  accentColor: "#F4B400",
  secondaryColor: "#FFF8E1",
};

const crayon: StyleModule = {
  id: "crayon",
  label: "Crayon",
  fontFamily: "Caveat",
  accentColor: "#E74C3C",
  secondaryColor: "#FFF3F0",
};

const storybook: StyleModule = {
  id: "storybook",
  label: "Storybook",
  fontFamily: "Playfair Display",
  accentColor: "#6B4226",
  secondaryColor: "#FFF8F1",
};

const minimal: StyleModule = {
  id: "minimal",
  label: "Minimal",
  fontFamily: "Inter",
  accentColor: "#111111",
  secondaryColor: "#F5F5F5",
};

export const styles: Record<StyleId, StyleModule> = {
  sunshine,
  crayon,
  storybook,
  minimal,
};

export function getStyle(id: StyleId): StyleModule {
  const style = styles[id];
  if (!style) {
    throw new Error(`Unknown style id: ${id}`);
  }
  return style;
}
