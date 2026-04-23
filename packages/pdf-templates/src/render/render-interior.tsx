// ---------------------------------------------------------------------------
// renderInteriorPdf — produces the full interior PDF for a personalized
// coloring book.
//
// Page order:
//   1.  Title page
//   2.  Blank verso  (required for book feel)
//   3…N. Coloring pages, one per payload.pages entry
//   N+1. Back page   ("Made with love by…")
//   N+2. Padding page (added when total count is odd — print requires even)
// ---------------------------------------------------------------------------

import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { BookPayload, ColoringPageEntry, TrimSpec } from "../types";
import { registerFonts } from "../fonts/register";

registerFonts();

const PT_PER_IN = 72;

function inToPt(inches: number): number {
  return inches * PT_PER_IN;
}

// ---------------------------------------------------------------------------
// Shared dimension helpers
// ---------------------------------------------------------------------------

type PageDims = {
  /** Full page width in points (trim + 2×bleed) */
  widthPt: number;
  /** Full page height in points (trim + 2×bleed) */
  heightPt: number;
  /** Safe area inset from page edge = bleed + safe margin, in points */
  safeInset: number;
  /** Usable content width inside safe area */
  contentWidth: number;
  /** Usable content height inside safe area */
  contentHeight: number;
};

function computePageDims(trim: TrimSpec): PageDims {
  const widthPt = inToPt(trim.widthIn + 2 * trim.bleedIn);
  const heightPt = inToPt(trim.heightIn + 2 * trim.bleedIn);
  const bleedPt = inToPt(trim.bleedIn);
  const safeInset = bleedPt + inToPt(trim.safeIn);
  const contentWidth = widthPt - 2 * safeInset;
  const contentHeight = heightPt - 2 * safeInset;
  return { widthPt, heightPt, safeInset, contentWidth, contentHeight };
}

// ---------------------------------------------------------------------------
// Shared base page styles
// ---------------------------------------------------------------------------

function makeBaseStyles(dims: PageDims) {
  return StyleSheet.create({
    page: {
      width: dims.widthPt,
      height: dims.heightPt,
      backgroundColor: "#ffffff",
      position: "relative",
    },
    safeArea: {
      position: "absolute",
      top: dims.safeInset,
      left: dims.safeInset,
      width: dims.contentWidth,
      height: dims.contentHeight,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Title page
// ---------------------------------------------------------------------------

function TitlePage({
  payload,
  dims,
}: {
  payload: BookPayload;
  dims: PageDims;
}): React.ReactElement {
  const { meta } = payload;
  const title = meta.title ?? "My Coloring Book";
  const subtitle = meta.subtitle;
  const dedication = meta.dedication;
  const authorLine = meta.authorLine;

  const base = makeBaseStyles(dims);

  const styles = StyleSheet.create({
    content: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 40,
      paddingBottom: 40,
    },
    title: {
      fontFamily: "Helvetica-Bold",
      fontSize: 36,
      color: "#1a1a1a",
      textAlign: "center",
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: "Helvetica",
      fontSize: 18,
      color: "#555555",
      textAlign: "center",
      marginBottom: 28,
    },
    divider: {
      width: 60,
      height: 2,
      backgroundColor: "#cccccc",
      marginBottom: 28,
    },
    dedication: {
      fontFamily: "Times-Italic",
      fontSize: 14,
      color: "#555555",
      textAlign: "center",
      marginBottom: 20,
      paddingLeft: 20,
      paddingRight: 20,
    },
    authorLine: {
      fontFamily: "Helvetica",
      fontSize: 12,
      color: "#888888",
      textAlign: "center",
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={base.page}>
      <View style={[base.safeArea, styles.content]}>
        <Text style={styles.title}>{title}</Text>

        {subtitle != null && subtitle !== "" && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}

        <View style={styles.divider} />

        {dedication != null && dedication !== "" && (
          <Text style={styles.dedication}>{dedication}</Text>
        )}

        {authorLine != null && authorLine !== "" && (
          <Text style={styles.authorLine}>— {authorLine}</Text>
        )}
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// 2. Blank page (used for verso and padding)
// ---------------------------------------------------------------------------

function BlankPage({ dims }: { dims: PageDims }): React.ReactElement {
  const base = makeBaseStyles(dims);
  return <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={base.page} />;
}

// ---------------------------------------------------------------------------
// 3. Coloring page
// ---------------------------------------------------------------------------

/** Height reserved at the bottom of the safe area for caption + page number */
const FOOTER_HEIGHT_PT = 36;

function ColoringPage({
  entry,
  pageNumber,
  dims,
}: {
  entry: ColoringPageEntry;
  pageNumber: number;
  dims: PageDims;
}): React.ReactElement {
  const base = makeBaseStyles(dims);

  const imageAreaHeight = dims.contentHeight - FOOTER_HEIGHT_PT;

  // Aspect-fit the line art into the available box
  const imgAspect = entry.lineArt.widthPx / entry.lineArt.heightPx;
  const boxAspect = dims.contentWidth / imageAreaHeight;

  let imgFitWidth: number;
  let imgFitHeight: number;
  if (imgAspect >= boxAspect) {
    // Wider than box — constrain by width
    imgFitWidth = dims.contentWidth;
    imgFitHeight = dims.contentWidth / imgAspect;
  } else {
    // Taller than box — constrain by height
    imgFitHeight = imageAreaHeight;
    imgFitWidth = imageAreaHeight * imgAspect;
  }

  const styles = StyleSheet.create({
    imageArea: {
      width: dims.contentWidth,
      height: imageAreaHeight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    lineArtImage: {
      width: imgFitWidth,
      height: imgFitHeight,
    },
    footer: {
      width: dims.contentWidth,
      height: FOOTER_HEIGHT_PT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 6,
    },
    caption: {
      fontFamily: "Helvetica",
      fontSize: 10,
      color: "#555555",
      textAlign: "center",
      marginBottom: 4,
    },
    pageNum: {
      fontFamily: "Helvetica",
      fontSize: 9,
      color: "#aaaaaa",
      textAlign: "center",
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={base.page}>
      <View style={base.safeArea}>
        {/* Line art, aspect-fitted inside image area */}
        <View style={styles.imageArea}>
          <Image src={entry.lineArt.url} style={styles.lineArtImage} />
        </View>

        {/* Footer: optional caption + page number */}
        <View style={styles.footer}>
          {entry.caption != null && entry.caption !== "" && (
            <Text style={styles.caption}>{entry.caption}</Text>
          )}
          <Text style={styles.pageNum}>{pageNumber}</Text>
        </View>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// 4. Back page
// ---------------------------------------------------------------------------

function BackPage({
  payload,
  dims,
}: {
  payload: BookPayload;
  dims: PageDims;
}): React.ReactElement {
  const base = makeBaseStyles(dims);
  const { meta } = payload;

  const parts: string[] = [];
  if (meta.authorLine != null && meta.authorLine !== "") {
    parts.push(`Made with love by ${meta.authorLine}`);
  } else {
    parts.push("Made with love");
  }
  parts.push(meta.createdOn);
  parts.push("littlecolorbook.com");

  const backText = parts.join(" · ");

  const styles = StyleSheet.create({
    content: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    backText: {
      fontFamily: "Helvetica",
      fontSize: 10,
      color: "#aaaaaa",
      textAlign: "center",
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={base.page}>
      <View style={[base.safeArea, styles.content]}>
        <Text style={styles.backText}>{backText}</Text>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderInteriorPdf(payload: BookPayload): Promise<Buffer> {
  const dims = computePageDims(payload.trim);
  const pages = payload.pages ?? [];

  const pageElements: React.ReactElement[] = [];

  // 1. Title page
  pageElements.push(<TitlePage key="title" payload={payload} dims={dims} />);

  // 2. Blank verso
  pageElements.push(<BlankPage key="blank-verso" dims={dims} />);

  // 3. Coloring pages — numbered from 1
  for (let i = 0; i < pages.length; i++) {
    pageElements.push(
      <ColoringPage
        key={`coloring-${i}`}
        entry={pages[i]!}
        pageNumber={i + 1}
        dims={dims}
      />,
    );
  }

  // 4. Back page
  pageElements.push(<BackPage key="back" payload={payload} dims={dims} />);

  // 5. Padding — ensure even total page count for print binding
  if (pageElements.length % 2 !== 0) {
    pageElements.push(<BlankPage key="padding" dims={dims} />);
  }

  const doc = <Document>{pageElements}</Document>;

  return renderToBuffer(doc);
}
