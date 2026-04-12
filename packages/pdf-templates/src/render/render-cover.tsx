// ---------------------------------------------------------------------------
// renderCoverPdf — produces a single-page front-cover PDF for Lulu coil-bound.
//
// For coil-bound products Lulu expects the cover as a single front-cover page
// (not a full spread).  Dimensions = (trimWidth + 2×bleed) × (trimHeight + 2×bleed).
// ---------------------------------------------------------------------------

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { BookPayload } from "../types.js";

const PT_PER_IN = 72;

function inToPt(inches: number): number {
  return inches * PT_PER_IN;
}

// ---------------------------------------------------------------------------
// Cover page component
// ---------------------------------------------------------------------------

function buildCoverPage(payload: BookPayload): React.ReactElement {
  const { trim, cover, meta } = payload;

  const pageWidthPt = inToPt(trim.widthIn + 2 * trim.bleedIn);
  const pageHeightPt = inToPt(trim.heightIn + 2 * trim.bleedIn);
  const bleedPt = inToPt(trim.bleedIn);
  const safePt = inToPt(trim.safeIn);

  // Safe area inset from bleed edge
  const safeInset = bleedPt + safePt;
  const safeWidth = pageWidthPt - 2 * safeInset;

  const title = meta.title ?? "My Coloring Book";
  const subtitle = meta.subtitle;

  // Dynamic font size: scale down for long titles, cap at 32pt
  const titleFontSize = Math.min(32, Math.floor(safeWidth / (title.length * 0.62 + 1)));

  const styles = StyleSheet.create({
    page: {
      width: pageWidthPt,
      height: pageHeightPt,
      position: "relative",
      backgroundColor: "#ffffff",
    },
    // Full-bleed image fills the entire page
    fullBleedImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: pageWidthPt,
      height: pageHeightPt,
      objectFit: "cover",
    },
    // Stock art placeholder background
    stockPlaceholder: {
      position: "absolute",
      top: 0,
      left: 0,
      width: pageWidthPt,
      height: pageHeightPt,
      backgroundColor: "#e8f4f8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    stockPlaceholderText: {
      fontSize: 14,
      color: "#6b8fa3",
      fontFamily: "Helvetica",
    },
    // Semi-transparent overlay strip at bottom of safe area
    textOverlay: {
      position: "absolute",
      bottom: safeInset,
      left: safeInset,
      width: safeWidth,
      backgroundColor: "rgba(0,0,0,0.45)",
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 14,
      paddingRight: 14,
      borderRadius: 4,
    },
    titleText: {
      fontFamily: "Helvetica-Bold",
      fontSize: titleFontSize,
      color: "#ffffff",
      textAlign: "center",
    },
    subtitleText: {
      fontFamily: "Helvetica",
      fontSize: 14,
      color: "#ffffffcc",
      textAlign: "center",
      marginTop: 4,
    },
    // Stock-art text overlay (no dark background, positioned inside safe area)
    stockTextOverlay: {
      position: "absolute",
      bottom: safeInset,
      left: safeInset,
      width: safeWidth,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 12,
    },
    stockTitleText: {
      fontFamily: "Helvetica-Bold",
      fontSize: Math.min(30, titleFontSize),
      color: "#1a1a1a",
      textAlign: "center",
    },
    stockSubtitleText: {
      fontFamily: "Helvetica",
      fontSize: 13,
      color: "#444444",
      textAlign: "center",
      marginTop: 4,
    },
  });

  if (cover.type === "customer-photo") {
    return (
      <Page size={{ width: pageWidthPt, height: pageHeightPt }} style={styles.page}>
        {/* Full-bleed customer photo */}
        <Image src={cover.photo.url} style={styles.fullBleedImage} />

        {/* Title / subtitle overlay */}
        <View style={styles.textOverlay}>
          <Text style={styles.titleText}>{title}</Text>
          {subtitle != null && subtitle !== "" && (
            <Text style={styles.subtitleText}>{subtitle}</Text>
          )}
        </View>
      </Page>
    );
  }

  // stock-art: placeholder background + text.
  // Real stock art PDFs are composited in a later pipeline step.
  return (
    <Page size={{ width: pageWidthPt, height: pageHeightPt }} style={styles.page}>
      {/* Placeholder — real art will be composited post-render */}
      <View style={styles.stockPlaceholder}>
        <Text style={styles.stockPlaceholderText}>
          [Stock art: {cover.stockArtId}]
        </Text>
      </View>

      {/* Title overlay */}
      <View style={styles.stockTextOverlay}>
        <Text style={styles.stockTitleText}>{title}</Text>
        {subtitle != null && subtitle !== "" && (
          <Text style={styles.stockSubtitleText}>{subtitle}</Text>
        )}
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderCoverPdf(payload: BookPayload): Promise<Buffer> {
  const coverPage = buildCoverPage(payload);

  const doc = <Document>{coverPage}</Document>;

  return renderToBuffer(doc);
}
