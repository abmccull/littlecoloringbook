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
import type { BookPayload, ColoringPageEntry } from "../types";
import { registerFonts } from "../fonts/register";
import {
  computePageDims,
  type PageDims,
  PremiumClosingPage,
  PremiumCoverPage,
  PremiumNotesPage,
  PremiumTitlePage,
} from "./premium-cover-components";

registerFonts();

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

const FOOTER_HEIGHT_PT = 36;

function getEntryAspect(entry: ColoringPageEntry, fallback: number) {
  if (entry.lineArt.widthPx > 0 && entry.lineArt.heightPx > 0) {
    return entry.lineArt.widthPx / entry.lineArt.heightPx;
  }

  return fallback;
}

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
  const boxAspect = dims.contentWidth / imageAreaHeight;
  const imgAspect = getEntryAspect(entry, boxAspect);

  let imgFitWidth: number;
  let imgFitHeight: number;
  if (imgAspect >= boxAspect) {
    imgFitWidth = dims.contentWidth;
    imgFitHeight = dims.contentWidth / imgAspect;
  } else {
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
      objectFit: "contain",
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
      fontFamily: "Inter",
      fontSize: 10,
      color: "#555555",
      textAlign: "center",
      marginBottom: 4,
    },
    pageNum: {
      fontFamily: "Inter",
      fontSize: 9,
      color: "#aaaaaa",
      textAlign: "center",
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={base.page}>
      <View style={base.safeArea}>
        <View style={styles.imageArea}>
          <Image src={entry.lineArt.url} style={styles.lineArtImage} />
        </View>
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

export async function renderInteriorPdf(payload: BookPayload): Promise<Buffer> {
  const dims = computePageDims(payload.trim);
  const pages = payload.pages ?? [];
  const includeCoverPage = payload.renderOptions?.includeCoverPage ?? payload.trim.bleedIn === 0;
  const forceEvenPages = payload.renderOptions?.forceEvenPages ?? payload.trim.bleedIn > 0;

  const pageElements: React.ReactElement[] = [];

  if (includeCoverPage) {
    pageElements.push(<PremiumCoverPage key="premium-cover" payload={payload} dims={dims} />);
  }

  pageElements.push(<PremiumTitlePage key="title" payload={payload} dims={dims} />);

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

  pageElements.push(<PremiumClosingPage key="closing" payload={payload} dims={dims} />);

  if (forceEvenPages && pageElements.length % 2 !== 0) {
    pageElements.push(<PremiumNotesPage key="notes-padding" payload={payload} dims={dims} />);
  }

  return renderToBuffer(<Document>{pageElements}</Document>);
}
