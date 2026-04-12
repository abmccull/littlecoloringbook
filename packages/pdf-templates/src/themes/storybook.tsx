/** @jsxImportSource react */
// ---------------------------------------------------------------------------
// Storybook visual style — React-PDF components
// Palette: Playfair Display / #6B4226 accent / #FFF8F1 secondary
// ---------------------------------------------------------------------------
// NOTE: The pragma above overrides the package-level jsxImportSource
// (@react-pdf/renderer) because react-pdf v4 does not ship a jsx-runtime
// module. React's own JSX transform is used instead; react-pdf components
// are fully compatible with it since they extend React.Component internally.
// ---------------------------------------------------------------------------
// TODO: Register Playfair Display web font with Font.register() once the
// font assets are bundled. Until then, Times-Roman is used as a system serif
// stand-in that preserves the editorial character of the style.
// ---------------------------------------------------------------------------

import React from "react";
import { Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { TrimSpec } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PT_PER_IN = 72;

const ACCENT = "#6B4226";
const SECONDARY = "#FFF8F1";
const TEXT_DARK = "#2C1810";
const TEXT_MID = "#7A5C4A";
const SERIF = "Times-Roman";
const SERIF_BOLD = "Times-Bold";
const SERIF_ITALIC = "Times-Italic";

// Corner ornament size in points
const CORNER_SIZE = 18;
const CORNER_THICKNESS = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert inches to points */
function pt(inches: number): number {
  return inches * PT_PER_IN;
}

/**
 * Derive page dimensions and safe-area insets from a TrimSpec.
 * React-PDF Page `size` includes the bleed on each side.
 */
function pageDims(trim: TrimSpec): {
  widthPt: number;
  heightPt: number;
  bleedPt: number;
  safePt: number;
} {
  return {
    widthPt: pt(trim.widthIn + trim.bleedIn * 2),
    heightPt: pt(trim.heightIn + trim.bleedIn * 2),
    bleedPt: pt(trim.bleedIn),
    safePt: pt(trim.safeIn),
  };
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/**
 * Four L-shaped corner ornaments drawn with View borders.
 * Positioned at the corners of the safe area with absolute coordinates.
 */
const CornerOrnaments: React.FC<{
  insetPt: number;
}> = ({ insetPt }) => {
  const s = StyleSheet.create({
    base: {
      position: "absolute",
      width: CORNER_SIZE,
      height: CORNER_SIZE,
    },
    topLeft: {
      top: insetPt,
      left: insetPt,
      borderTopWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderTopColor: ACCENT,
      borderLeftColor: ACCENT,
    },
    topRight: {
      top: insetPt,
      right: insetPt,
      borderTopWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderTopColor: ACCENT,
      borderRightColor: ACCENT,
    },
    bottomLeft: {
      bottom: insetPt,
      left: insetPt,
      borderBottomWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderBottomColor: ACCENT,
      borderLeftColor: ACCENT,
    },
    bottomRight: {
      bottom: insetPt,
      right: insetPt,
      borderBottomWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderBottomColor: ACCENT,
      borderRightColor: ACCENT,
    },
  });

  return (
    <>
      <View style={[s.base, s.topLeft]} />
      <View style={[s.base, s.topRight]} />
      <View style={[s.base, s.bottomLeft]} />
      <View style={[s.base, s.bottomRight]} />
    </>
  );
};

// ---------------------------------------------------------------------------
// StorybookCoverLayout
// ---------------------------------------------------------------------------

export type StorybookCoverLayoutProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  childName: string;
  coverImageSrc: string;
};

export const StorybookCoverLayout: React.FC<StorybookCoverLayoutProps> = ({
  trim,
  title,
  subtitle,
  coverImageSrc,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);

  // Text area height at bottom of safe area
  const textAreaHeight = subtitle ? 80 : 56;
  const inset = bleedPt + safePt;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: SECONDARY,
      position: "relative",
    },
    coverImage: {
      position: "absolute",
      top: inset,
      left: inset,
      width: widthPt - inset * 2,
      height: heightPt - inset * 2 - textAreaHeight,
      objectFit: "cover",
    },
    textContainer: {
      position: "absolute",
      bottom: inset,
      left: inset,
      right: inset,
      height: textAreaHeight,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontFamily: SERIF_BOLD,
      fontSize: 26,
      color: ACCENT,
      textAlign: "center",
      letterSpacing: 0.8,
    },
    subtitle: {
      fontFamily: SERIF_ITALIC,
      fontSize: 13,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 4,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <Image src={coverImageSrc} style={styles.coverImage} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <CornerOrnaments insetPt={inset} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// StorybookPageLayout
// ---------------------------------------------------------------------------

export type StorybookPageLayoutProps = {
  trim: TrimSpec;
  lineArtSrc: string;
  caption?: string;
  pageNumber: number;
};

export const StorybookPageLayout: React.FC<StorybookPageLayoutProps> = ({
  trim,
  lineArtSrc,
  caption,
  pageNumber,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);

  const inset = bleedPt + safePt;
  const pageNumAreaHeight = 24;
  const captionAreaHeight = caption ? 28 : 0;
  const artAreaHeight =
    heightPt - inset * 2 - pageNumAreaHeight - captionAreaHeight;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: "#FFFFFF",
      position: "relative",
    },
    artContainer: {
      position: "absolute",
      top: inset,
      left: inset,
      width: widthPt - inset * 2,
      height: artAreaHeight,
      alignItems: "center",
      justifyContent: "center",
    },
    lineArt: {
      maxWidth: widthPt - inset * 2,
      maxHeight: artAreaHeight,
      objectFit: "contain",
    },
    caption: {
      position: "absolute",
      left: inset,
      right: inset,
      bottom: inset + pageNumAreaHeight,
      textAlign: "center",
      fontFamily: SERIF_ITALIC,
      fontSize: 11,
      color: ACCENT,
    },
    pageNumber: {
      position: "absolute",
      bottom: inset,
      left: inset,
      right: inset,
      textAlign: "center",
      fontFamily: SERIF,
      fontSize: 9,
      color: TEXT_MID,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <View style={styles.artContainer}>
        <Image src={lineArtSrc} style={styles.lineArt} />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Text style={styles.pageNumber}>{pageNumber}</Text>
      <CornerOrnaments insetPt={inset} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// StorybookTitlePage
// ---------------------------------------------------------------------------

export type StorybookTitlePageProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  dedication?: string;
  authorLine?: string;
};

export const StorybookTitlePage: React.FC<StorybookTitlePageProps> = ({
  trim,
  title,
  subtitle,
  dedication,
  authorLine,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: SECONDARY,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    inner: {
      width: widthPt - inset * 2,
      alignItems: "center",
    },
    title: {
      fontFamily: SERIF_BOLD,
      fontSize: 30,
      color: ACCENT,
      textAlign: "center",
      letterSpacing: 0.6,
    },
    subtitle: {
      fontFamily: SERIF_ITALIC,
      fontSize: 15,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 10,
    },
    divider: {
      width: 80,
      borderBottomWidth: 1,
      borderBottomColor: ACCENT,
      marginTop: 24,
      marginBottom: 24,
    },
    dedication: {
      fontFamily: SERIF_ITALIC,
      fontSize: 13,
      color: TEXT_DARK,
      textAlign: "center",
      lineHeight: 1.5,
    },
    authorLine: {
      position: "absolute",
      bottom: inset,
      left: inset,
      right: inset,
      textAlign: "center",
      fontFamily: SERIF,
      fontSize: 10,
      color: TEXT_MID,
    },
  });

  const hasDedicationSection = dedication || authorLine;

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <View style={styles.inner}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {hasDedicationSection ? (
          <>
            <View style={styles.divider} />
            {dedication ? (
              <Text style={styles.dedication}>{dedication}</Text>
            ) : null}
          </>
        ) : null}
      </View>
      {authorLine ? (
        <Text style={styles.authorLine}>{authorLine}</Text>
      ) : null}
      <CornerOrnaments insetPt={inset} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// StorybookBackPage
// ---------------------------------------------------------------------------

export type StorybookBackPageProps = {
  trim: TrimSpec;
  authorLine?: string;
  createdOn: string;
};

export const StorybookBackPage: React.FC<StorybookBackPageProps> = ({
  trim,
  authorLine,
  createdOn,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: SECONDARY,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    inner: {
      width: widthPt - inset * 2,
      alignItems: "center",
    },
    madeWith: {
      fontFamily: SERIF_ITALIC,
      fontSize: 18,
      color: ACCENT,
      textAlign: "center",
    },
    authorLine: {
      fontFamily: SERIF,
      fontSize: 12,
      color: TEXT_DARK,
      textAlign: "center",
      marginTop: 14,
    },
    createdOn: {
      fontFamily: SERIF,
      fontSize: 10,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 8,
    },
    site: {
      fontFamily: SERIF_ITALIC,
      fontSize: 10,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 20,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <View style={styles.inner}>
        <Text style={styles.madeWith}>Made with love</Text>
        {authorLine ? (
          <Text style={styles.authorLine}>{authorLine}</Text>
        ) : null}
        <Text style={styles.createdOn}>{createdOn}</Text>
        <Text style={styles.site}>littlecolorbook.com</Text>
      </View>
      <CornerOrnaments insetPt={inset} />
    </Page>
  );
};
