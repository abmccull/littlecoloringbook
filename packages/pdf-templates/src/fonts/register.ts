import path from "node:path";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fontPath = (name: string): string => path.join(__dirname, name);

/**
 * Register all Google Fonts with React-PDF.
 * Call this once before any renderToBuffer / renderToStream call.
 * Font.register is idempotent — repeated calls are safe.
 */
export function registerFonts(): void {
  // Playfair Display — serif, editorial (storybook style)
  Font.register({
    family: "Playfair Display",
    fonts: [
      { src: fontPath("PlayfairDisplay-Regular.ttf") },
      { src: fontPath("PlayfairDisplay-Bold.ttf"), fontWeight: 700 },
      { src: fontPath("PlayfairDisplay-Italic.ttf"), fontStyle: "italic" },
    ],
  });

  // Fredoka — rounded sans, playful (sunshine style)
  Font.register({
    family: "Fredoka",
    fonts: [
      { src: fontPath("Fredoka-Regular.ttf") },
      { src: fontPath("Fredoka-Bold.ttf"), fontWeight: 700 },
    ],
  });

  // Caveat — handwritten (crayon style)
  Font.register({
    family: "Caveat",
    fonts: [
      { src: fontPath("Caveat-Regular.ttf") },
      { src: fontPath("Caveat-Bold.ttf"), fontWeight: 700 },
    ],
  });

  // Inter — clean sans-serif (minimal style)
  Font.register({
    family: "Inter",
    fonts: [
      { src: fontPath("Inter-Regular.ttf") },
      { src: fontPath("Inter-Bold.ttf"), fontWeight: 700 },
      { src: fontPath("Inter-Italic.ttf"), fontStyle: "italic" },
    ],
  });
}
