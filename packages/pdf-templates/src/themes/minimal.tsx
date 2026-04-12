/** @jsxImportSource react */
// ---------------------------------------------------------------------------
// Minimal visual style — React-PDF components
// Palette: Helvetica (Inter fallback) / #111111 accent / #F5F5F5 secondary
// ---------------------------------------------------------------------------
// TODO: Register Inter web font with Font.register() once font assets are
// bundled. Until then, Helvetica is used as a clean sans-serif stand-in.
// ---------------------------------------------------------------------------

import React from "react";
import { Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { TrimSpec } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PT_PER_IN = 72;

const ACCENT = "#111111";
const SECONDARY = "#F5F5F5";
const TEXT_MUTED = "#666666";
const SANS = "Helvetica";
const SANS_BOLD = "Helvetica-Bold";
const SANS_OBLIQUE = "Helvetica-Oblique";

// Thin geometric frame width
const FRAME_WIDTH = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert inches to points */
function pt(inches: number): number {
  return inches * PT_PER_IN;
}

/**
 * Derive page dimensions and safe-area insets from a TrimSpec.
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
 * Thin 1pt geometric frame inset from the bleed edge.
 * Clean and editorial — no decorative flourishes.
 */
const GeometricFrame: React.FC<{
  widthPt: number;
  heightPt: number;
  insetPt: number;
}> = ({ widthPt, heightPt, insetPt }) => {
  const styles = StyleSheet.create({
    frame: {
      position: "absolute",
      top: insetPt,
      left: insetPt,
      width: widthPt - insetPt * 2,
      height: heightPt - insetPt * 2,
      borderWidth: FRAME_WIDTH,
      borderColor: ACCENT,
    },
  });

  return <View style={styles.frame} />;
};

// ---------------------------------------------------------------------------
// MinimalCoverLayout
// ---------------------------------------------------------------------------

export type MinimalCoverLayoutProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  childName: string;
  coverImageSrc: string;
};

export const MinimalCoverLayout: React.FC<MinimalCoverLayoutProps> = ({
  trim,
  title,
  subtitle,
  coverImageSrc,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  // Title anchored bottom-left with generous whitespace
  const titleBlockHeight = subtitle ? 72 : 52;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: "#FFFFFF",
      position: "relative",
    },
    // Edge-to-edge image
    coverImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: widthPt,
      height: heightPt,
      objectFit: "cover",
    },
    // Clean white title block anchored bottom-left
    titleBlock: {
      position: "absolute",
      bottom: inset,
      left: inset,
      width: widthPt * 0.65,
      height: titleBlockHeight,
      backgroundColor: "rgba(255,255,255,0.92)",
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: "center",
    },
    title: {
      fontFamily: SANS_BOLD,
      fontSize: 18,
      color: ACCENT,
      // Small caps approximated via uppercase + letter spacing
      textTransform: "uppercase",
      letterSpacing: 2.5,
    },
    subtitle: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 11,
      color: TEXT_MUTED,
      marginTop: 4,
      letterSpacing: 0.5,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <Image src={coverImageSrc} style={styles.coverImage} />
      {/* 1pt geometric frame inset from bleed */}
      <GeometricFrame widthPt={widthPt} heightPt={heightPt} insetPt={bleedPt + 4} />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// MinimalPageLayout
// ---------------------------------------------------------------------------

export type MinimalPageLayoutProps = {
  trim: TrimSpec;
  lineArtSrc: string;
  caption?: string;
  pageNumber: number;
};

export const MinimalPageLayout: React.FC<MinimalPageLayoutProps> = ({
  trim,
  lineArtSrc,
  caption,
  pageNumber,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;
  const pageNumAreaHeight = 20;
  const captionAreaHeight = caption ? 24 : 0;
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
    // Small muted caption — no decoration
    caption: {
      position: "absolute",
      left: inset,
      right: inset,
      bottom: inset + pageNumAreaHeight,
      textAlign: "center",
      fontFamily: SANS_OBLIQUE,
      fontSize: 9,
      color: TEXT_MUTED,
      letterSpacing: 0.3,
    },
    // Page number bottom-right, small
    pageNumber: {
      position: "absolute",
      bottom: inset,
      right: inset,
      textAlign: "right",
      fontFamily: SANS,
      fontSize: 8,
      color: TEXT_MUTED,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <View style={styles.artContainer}>
        <Image src={lineArtSrc} style={styles.lineArt} />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Text style={styles.pageNumber}>{pageNumber}</Text>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// MinimalTitlePage
// ---------------------------------------------------------------------------

export type MinimalTitlePageProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  dedication?: string;
  authorLine?: string;
};

export const MinimalTitlePage: React.FC<MinimalTitlePageProps> = ({
  trim,
  title,
  subtitle,
  dedication,
  authorLine,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  // Asymmetric editorial layout: title left-aligned at 1/3 from top
  const titleTopOffset = heightPt / 3;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: SECONDARY,
      position: "relative",
    },
    // Title block anchored at 1/3 from top, left-aligned
    titleBlock: {
      position: "absolute",
      top: titleTopOffset,
      left: inset,
      width: widthPt - inset * 2,
    },
    title: {
      fontFamily: SANS_BOLD,
      fontSize: 28,
      color: ACCENT,
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    subtitle: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 13,
      color: TEXT_MUTED,
      marginTop: 8,
      letterSpacing: 0.5,
    },
    // Thin horizontal rule below title
    rule: {
      width: widthPt - inset * 2,
      borderBottomWidth: FRAME_WIDTH,
      borderBottomColor: ACCENT,
      marginTop: 20,
      marginBottom: 20,
    },
    // Dedication right-aligned below the rule — editorial contrast
    dedication: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 12,
      color: TEXT_MUTED,
      textAlign: "right",
      lineHeight: 1.6,
    },
    authorLine: {
      position: "absolute",
      bottom: inset,
      left: inset,
      right: inset,
      textAlign: "left",
      fontFamily: SANS,
      fontSize: 9,
      color: TEXT_MUTED,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.rule} />
        {dedication ? (
          <Text style={styles.dedication}>{dedication}</Text>
        ) : null}
      </View>
      {authorLine ? (
        <Text style={styles.authorLine}>{authorLine}</Text>
      ) : null}
    </Page>
  );
};

// ---------------------------------------------------------------------------
// MinimalBackPage
// ---------------------------------------------------------------------------

export type MinimalBackPageProps = {
  trim: TrimSpec;
  authorLine?: string;
  createdOn: string;
};

export const MinimalBackPage: React.FC<MinimalBackPageProps> = ({
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
    // Single centered line — no decoration
    madeWith: {
      fontFamily: SANS,
      fontSize: 11,
      color: TEXT_MUTED,
      textAlign: "center",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    authorLine: {
      fontFamily: SANS,
      fontSize: 10,
      color: TEXT_MUTED,
      textAlign: "center",
      marginTop: 12,
    },
    createdOn: {
      fontFamily: SANS,
      fontSize: 9,
      color: TEXT_MUTED,
      textAlign: "center",
      marginTop: 6,
    },
    site: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 9,
      color: TEXT_MUTED,
      textAlign: "center",
      marginTop: 18,
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
    </Page>
  );
};
