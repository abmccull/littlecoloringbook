/** @jsxImportSource react */
// ---------------------------------------------------------------------------
// Sunshine visual style — React-PDF components
// Palette: Helvetica (Fredoka fallback) / #F4B400 accent / #FFF8E1 secondary
// ---------------------------------------------------------------------------
// TODO: Register Fredoka web font with Font.register() once font assets are
// bundled. Until then, Helvetica is used as a stand-in.
// ---------------------------------------------------------------------------

import React from "react";
import { Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { TrimSpec } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PT_PER_IN = 72;

const ACCENT = "#F4B400";
const SECONDARY = "#FFF8E1";
const TEXT_DARK = "#5A4000";
const TEXT_MID = "#8A6800";
const SANS = "Helvetica";
const SANS_BOLD = "Helvetica-Bold";
const SANS_OBLIQUE = "Helvetica-Oblique";

// Sun decorative sizing
const SUN_RADIUS = 8;
const RAY_COUNT = 8;
const RAY_LENGTH = 10;
const RAY_THICKNESS = 2;

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
 * Small sun icon: filled circle + 8 radiating line stubs drawn with View.
 * Centered at (cx, cy) in absolute coordinates.
 */
const SunIcon: React.FC<{ cx: number; cy: number; size?: number }> = ({
  cx,
  cy,
  size = 1,
}) => {
  const r = SUN_RADIUS * size;
  const rayLen = RAY_LENGTH * size;
  const rayThick = RAY_THICKNESS * size;

  // Build rays at evenly-spaced angles
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    const angleDeg = (360 / RAY_COUNT) * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    // Ray starts just outside the circle
    const startDist = r + 3 * size;
    const x = cx + Math.cos(angleRad) * startDist;
    const y = cy + Math.sin(angleRad) * startDist;
    return { angleDeg, x, y };
  });

  return (
    <>
      {/* Core circle */}
      <View
        style={{
          position: "absolute",
          top: cy - r,
          left: cx - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: ACCENT,
        }}
      />
      {/* Rays */}
      {rays.map(({ angleDeg, x, y }, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: y - rayThick / 2,
            left: x - rayThick / 2,
            width: rayLen,
            height: rayThick,
            backgroundColor: ACCENT,
            transform: `rotate(${angleDeg}deg)`,
            transformOrigin: "0% 50%",
          }}
        />
      ))}
    </>
  );
};

/**
 * Corner sun-ray lines radiating from top-right corner of the page.
 * Purely decorative — thin gold lines spread across the upper-right quadrant.
 */
const SunRaysCorner: React.FC<{ widthPt: number }> = ({ widthPt }) => {
  const rayAngles = [200, 215, 230, 245, 260];
  const rayLen = 120;
  const originX = widthPt;
  const originY = 0;

  return (
    <>
      {rayAngles.map((angleDeg, i) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        const endX = originX + Math.cos(angleRad) * rayLen;
        const endY = originY + Math.sin(angleRad) * rayLen;
        // Represent as a thin rotated View starting from the corner
        const dx = endX - originX;
        const dy = endY - originY;
        const len = Math.sqrt(dx * dx + dy * dy);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              top: originY,
              left: originX - len,
              width: len,
              height: 1.5,
              backgroundColor: ACCENT,
              opacity: 0.35,
              transform: `rotate(${angleDeg}deg)`,
              transformOrigin: "100% 50%",
            }}
          />
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// SunshineCoverLayout
// ---------------------------------------------------------------------------

export type SunshineCoverLayoutProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  childName: string;
  coverImageSrc: string;
};

export const SunshineCoverLayout: React.FC<SunshineCoverLayoutProps> = ({
  trim,
  title,
  subtitle,
  coverImageSrc,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  // Warm gradient band at bottom behind title text
  const gradientBandHeight = subtitle ? 90 : 66;

  const styles = StyleSheet.create({
    page: {
      width: widthPt,
      height: heightPt,
      backgroundColor: SECONDARY,
      position: "relative",
    },
    coverImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: widthPt,
      height: heightPt,
      objectFit: "cover",
    },
    // Warm gradient band — simulated as a semi-opaque overlay at the bottom
    gradientBand: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: gradientBandHeight + inset,
      backgroundColor: SECONDARY,
      opacity: 0.88,
    },
    textContainer: {
      position: "absolute",
      bottom: inset,
      left: inset,
      right: inset,
      height: gradientBandHeight,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontFamily: SANS_BOLD,
      fontSize: 26,
      color: TEXT_DARK,
      textAlign: "center",
      letterSpacing: 0.5,
    },
    subtitle: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 13,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 5,
    },
  });

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <Image src={coverImageSrc} style={styles.coverImage} />
      <View style={styles.gradientBand} />
      <SunRaysCorner widthPt={widthPt} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Page>
  );
};

// ---------------------------------------------------------------------------
// SunshinePageLayout
// ---------------------------------------------------------------------------

export type SunshinePageLayoutProps = {
  trim: TrimSpec;
  lineArtSrc: string;
  caption?: string;
  pageNumber: number;
};

export const SunshinePageLayout: React.FC<SunshinePageLayoutProps> = ({
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

  // Sun icon sits in the top-left corner area
  const sunCx = inset + 18;
  const sunCy = inset + 18;

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
      <View style={styles.artContainer}>
        <Image src={lineArtSrc} style={styles.lineArt} />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Text style={styles.pageNumber}>{pageNumber}</Text>
      <SunIcon cx={sunCx} cy={sunCy} size={0.85} />
    </Page>
  );
};

// ---------------------------------------------------------------------------
// SunshineTitlePage
// ---------------------------------------------------------------------------

export type SunshineTitlePageProps = {
  trim: TrimSpec;
  title: string;
  subtitle?: string;
  dedication?: string;
  authorLine?: string;
};

export const SunshineTitlePage: React.FC<SunshineTitlePageProps> = ({
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
      fontSize: 30,
      color: TEXT_DARK,
      textAlign: "center",
      letterSpacing: 0.5,
      marginTop: 12,
    },
    subtitle: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 15,
      color: TEXT_MID,
      textAlign: "center",
      marginTop: 10,
    },
    divider: {
      width: 80,
      borderBottomWidth: 1.5,
      borderBottomColor: ACCENT,
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

  // Center the sun icon above the title
  const centerX = widthPt / 2;
  const sunY = heightPt / 2 - 80;

  return (
    <Page size={{ width: widthPt, height: heightPt }} style={styles.page}>
      <SunIcon cx={centerX} cy={sunY} size={1.4} />
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
// SunshineBackPage
// ---------------------------------------------------------------------------

export type SunshineBackPageProps = {
  trim: TrimSpec;
  authorLine?: string;
  createdOn: string;
};

export const SunshineBackPage: React.FC<SunshineBackPageProps> = ({
  trim,
  authorLine,
  createdOn,
}) => {
  const { widthPt, heightPt, bleedPt, safePt } = pageDims(trim);
  const inset = bleedPt + safePt;

  const centerX = widthPt / 2;
  const sunY = heightPt / 2 - 70;

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
      marginTop: 40,
    },
    madeWith: {
      fontFamily: SANS_OBLIQUE,
      fontSize: 18,
      color: ACCENT,
      textAlign: "center",
    },
    authorLine: {
      fontFamily: SANS,
      fontSize: 12,
      color: TEXT_DARK,
      textAlign: "center",
      marginTop: 14,
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
      <SunIcon cx={centerX} cy={sunY} size={1.6} />
      <View style={styles.inner}>
        <Text style={styles.madeWith}>Made with sunshine and love</Text>
        {authorLine ? (
          <Text style={styles.authorLine}>{authorLine}</Text>
        ) : null}
        <Text style={styles.createdOn}>{createdOn}</Text>
        <Text style={styles.site}>littlecolorbook.com</Text>
      </View>
    </Page>
  );
};
