/** @jsxImportSource react */
// ---------------------------------------------------------------------------
// Crayon visual style — React-PDF components
// Palette: Helvetica (Caveat fallback) / #E74C3C accent / #FFF3F0 secondary
// ---------------------------------------------------------------------------
// TODO: Register Caveat web font with Font.register() once font assets are
// bundled. Until then, Helvetica is used as a playful stand-in.
// ---------------------------------------------------------------------------

import React from "react";
import { Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { TrimSpec } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PT_PER_IN = 72;

const ACCENT = "#E74C3C";
const ACCENT_BLUE = "#3498DB";
const SECONDARY = "#FFF3F0";
const TEXT_DARK = "#2C0A08";
const TEXT_MID = "#8B3A35";
const SANS = "Helvetica";
const SANS_BOLD = "Helvetica-Bold";
const SANS_OBLIQUE = "Helvetica-Oblique";

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
 * Crayon-style border: thick dashed View border slightly imprecise via
 * differing border-radius values per corner.
 */
const CrayonBorder: React.FC<{
  top: number;
  left: number;
  width: number;
  height: number;
}> = ({ top, left, width, height }) => {
  const THICKNESS = 6;

  const styles = StyleSheet.create({
    border: {
      position: "absolute",
      top,
      left,
      width,
      height,
      borderWidth: THICKNESS,
      borderColor: ACCENT,
      // Slightly varied radius per corner gives the hand-drawn feel.
      // react-pdf supports borderRadius as a single value or shorthand.
      borderRadius: 4,
      borderStyle: "dashed",
    },
  });

  return <View style={styles.border} />;
};

/**
 * Zigzag decoration along the top edge: series of small rotated squares
 * that create a wavy/zigzag visual rhythm.
 */
const ZigzagTop: React.FC<{ widthPt: number; y: number }> = ({
  widthPt,
  y,
}) => {
  const TILE_SIZE = 8;
  const SPACING = 14;
  const count = Math.floor(widthPt / SPACING);

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const x = i * SPACING + SPACING / 2;
        // Alternate between 45° and -45° for zigzag feel
        const angleDeg = i % 2 === 0 ? 45 : -45;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              top: y - TILE_SIZE / 2,
              left: x - TILE_SIZE / 2,
              width: TILE_SIZE,
              height: TILE_SIZE,
              backgroundColor: ACCENT,
              opacity: 0.7,
              transform: `rotate(${angleDeg}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Star doodles: rotated squares scattered as decoration.
 */
const StarDoodles: React.FC<{ widthPt: number; heightPt: number }> = ({
  widthPt,
  heightPt,
}) => {
  // Fixed positions relative to page dimensions for deterministic layout
  const stars = [
    { xRatio: 0.08, yRatio: 0.12, size: 10, color: ACCENT },
    { xRatio: 0.92, yRatio: 0.1, size: 8, color: ACCENT_BLUE },
    { xRatio: 0.06, yRatio: 0.82, size: 9, color: ACCENT_BLUE },
    { xRatio: 0.9, yRatio: 0.8, size: 11, color: ACCENT },
    { xRatio: 0.5, yRatio: 0.07, size: 7, color: ACCENT },
  ];

  return (
    <>
      {stars.map(({ xRatio, yRatio, size, color }, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: heightPt * yRatio - size / 2,
            left: widthPt * xRatio - size / 2,
            width: size,
            height: size,
            backgroundColor: color,
            opacity: 0.6,
            transform: "rotate(45deg)",
          }}
        />
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// CrayonCoverLayout
// ---------------------------------------------------------------------------

export type CrayonCoverLayoutProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  childName: string;
  coverImageSrc: string;
};

export const CrayonCoverLayout: React.FC<CrayonCoverLayoutProps> = ({
  trim,
  title,
  subtitle,
  coverImageSrc,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  const textAreaHeight = subtitle ? 80 : 56;
  const borderPad = 6;
  const imageTop = inset;
  const imageLeft = inset;
  const imageWidth = widthPt - inset * 2;
  const imageHeight = heightPt - inset * 2 - textAreaHeight;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: SECONDARY,
      position: "relative",
    },
    coverImage: {
      position: "absolute",
      top: imageTop,
      left: imageLeft,
      width: imageWidth,
      height: imageHeight,
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
      fontFamily: SANS_BOLD,
      fontSize: 27,
      color: ACCENT,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    subtitle: {
      fontFamily: SANS,
      fontSize: 13,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 5,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <Image src={coverImageSrc} style={styles.coverImage} />
      {/* Thick crayon-style border around the image area */}
      <CrayonBorder
        top={imageTop - borderPad}
        left={imageLeft - borderPad}
        width={imageWidth + borderPad * 2}
        height={imageHeight + borderPad * 2}
      />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// CrayonPageLayout
// ---------------------------------------------------------------------------

export type CrayonPageLayoutProps = {
  trim: TrimSpec;
  lineArtSrc: string;
  caption?: string;
  pageNumber: number;
};

export const CrayonPageLayout: React.FC<CrayonPageLayoutProps> = ({
  trim,
  lineArtSrc,
  caption,
  pageNumber,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;
  const zigzagHeight = 14;
  const pageNumAreaHeight = 24;
  const captionAreaHeight = caption ? 28 : 0;
  const artAreaHeight =
    heightPt - inset * 2 - pageNumAreaHeight - captionAreaHeight - zigzagHeight;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: "#FFFFFF",
      position: "relative",
    },
    artContainer: {
      position: "absolute",
      top: inset + zigzagHeight,
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
      fontFamily: SANS_OBLIQUE,
      fontSize: 11,
      color: ACCENT,
    },
    pageNumber: {
      position: "absolute",
      bottom: inset,
      left: inset,
      right: inset,
      textAlign: "center",
      fontFamily: SANS,
      fontSize: 9,
      color: TEXT_MID,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <ZigzagTop widthPt={widthPt} y={inset + 7} />
      <View style={styles.artContainer}>
        <Image src={lineArtSrc} style={styles.lineArt} />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Text style={styles.pageNumber}>{pageNumber}</Text>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// CrayonTitlePage
// ---------------------------------------------------------------------------

export type CrayonTitlePageProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  dedication?: string;
  authorLine?: string;
};

export const CrayonTitlePage: React.FC<CrayonTitlePageProps> = ({
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
      fontFamily: SANS_BOLD,
      fontSize: 32,
      color: ACCENT,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    subtitle: {
      fontFamily: SANS_BOLD,
      fontSize: 16,
      color: ACCENT_BLUE,
      textAlign: "center",
      marginTop: 10,
    },
    divider: {
      width: 90,
      borderBottomWidth: 2,
      borderBottomColor: ACCENT,
      borderStyle: "dashed",
      marginTop: 24,
      marginBottom: 24,
    },
    dedication: {
      fontFamily: SANS_OBLIQUE,
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
      fontFamily: SANS,
      fontSize: 10,
      color: TEXT_MID,
    },
  });

  const hasDedicationSection = dedication || authorLine;

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <StarDoodles widthPt={widthPt} heightPt={heightPt} />
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
    </Page>
  );
};

// ---------------------------------------------------------------------------
// CrayonBackPage
// ---------------------------------------------------------------------------

export type CrayonBackPageProps = {
  trim: TrimSpec;
  authorLine?: string;
  createdOn: string;
};

export const CrayonBackPage: React.FC<CrayonBackPageProps> = ({
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
      fontFamily: SANS_OBLIQUE,
      fontSize: 18,
      color: ACCENT,
      textAlign: "center",
    },
    // Crayon-scribble divider: dashed line in accent color
    scribbleDivider: {
      width: 100,
      borderBottomWidth: 3,
      borderBottomColor: ACCENT,
      borderStyle: "dashed",
      marginTop: 16,
      marginBottom: 16,
    },
    authorLine: {
      fontFamily: SANS,
      fontSize: 12,
      color: TEXT_DARK,
      textAlign: "center",
      marginTop: 8,
    },
    createdOn: {
      fontFamily: SANS,
      fontSize: 10,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 8,
    },
    site: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 10,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 20,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <View style={styles.inner}>
        <Text style={styles.madeWith}>Colored with love</Text>
        <View style={styles.scribbleDivider} />
        {authorLine ? (
          <Text style={styles.authorLine}>{authorLine}</Text>
        ) : null}
        <Text style={styles.createdOn}>{createdOn}</Text>
        <Text style={styles.site}>littlecolorbook.com</Text>
      </View>
    </Page>
  );
};
