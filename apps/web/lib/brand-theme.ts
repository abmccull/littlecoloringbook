export const brandTheme = {
  palette: {
    cream: "#FFF8F2",
    paper: "#FFFDFC",
    ink: "#241813",
    coral: "#D95B42",
    apricot: "#F8C8AA",
    sunshine: "#F6D660",
    mint: "#72C8A0",
    sky: "#9ADAF5",
    cocoa: "#7D4D3B",
    fog: "#F4E7DA",
  },
  typography: {
    display: "Bree Serif",
    body: "Nunito Sans",
    accent: "Patrick Hand",
  },
  radii: {
    xl: "36px",
    lg: "28px",
    md: "20px",
    pill: "999px",
  },
  shadows: {
    soft: "0 20px 60px rgba(83, 49, 31, 0.1)",
    lift: "0 26px 80px rgba(217, 91, 66, 0.2)",
    inset: "inset 0 0 0 1px rgba(43, 31, 26, 0.08)",
  },
  badges: {
    primary: {
      background: "#FFD65A",
      color: "#2B1F1A",
    },
    accent: {
      background: "#FFC7A5",
      color: "#2B1F1A",
    },
    mint: {
      background: "#DDF4EA",
      color: "#1E5E45",
    },
    sky: {
      background: "#DDF5FF",
      color: "#175B77",
    },
  },
  imageFrames: {
    photo: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,244,236,0.9))",
    page: "linear-gradient(180deg, rgba(255,255,255,1), rgba(250,247,242,0.96))",
    book: "linear-gradient(180deg, rgba(255,199,165,0.48), rgba(255,255,255,0.95))",
  },
} as const;

export type BrandTheme = typeof brandTheme;
