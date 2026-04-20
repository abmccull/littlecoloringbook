/**
 * Brand constants mirrored from brand/brand-guidelines.md.
 *
 * Keep in sync with the markdown when the brand team revises colors
 * or type. These are the *rendering* constants used by the sharp
 * compositor — they do not override any design-system vars in the web
 * app (those live in CSS).
 */

export const BRAND_COLORS = {
  ink: "#241813",
  coral: "#D95B42",
  cream: "#FFF8F2",
  paper: "#FFFDFC",
  apricot: "#F8C8AA",
  sunshine: "#F6D660",
  mint: "#72C8A0",
  sky: "#9ADAF5",
  cocoa: "#7D4D3B",
  fog: "#F4E7DA",
} as const;

export type BrandColor = keyof typeof BRAND_COLORS;

/**
 * Font stacks. We use web-safe fallbacks here because Vercel serverless
 * functions render SVG via librsvg with a limited system font set.
 * Upgrade to bundled base64-encoded TTFs (Bree Serif / Nunito Sans /
 * Patrick Hand) in a follow-up if exact type fidelity matters more than
 * serverless cold-start weight.
 */
export const BRAND_FONTS = {
  display: "'Georgia', 'Cambria', 'Times New Roman', serif",
  body: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
  accent: "'Comic Sans MS', 'Marker Felt', cursive",
} as const;

export type BrandFont = keyof typeof BRAND_FONTS;
