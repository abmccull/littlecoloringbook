import React from "react";
import {
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { getCoverDesign, normalizeCoverStyle, type CoverDesign } from "@littlecolorbook/shared";
import type { BookPayload, ImageRef, TrimSpec } from "../types";

const PT_PER_IN = 72;

export type PageDims = {
  widthPt: number;
  heightPt: number;
  safeInset: number;
  contentWidth: number;
  contentHeight: number;
};

function inToPt(inches: number): number {
  return inches * PT_PER_IN;
}

export function computePageDims(trim: TrimSpec): PageDims {
  const widthPt = inToPt(trim.widthIn + 2 * trim.bleedIn);
  const heightPt = inToPt(trim.heightIn + 2 * trim.bleedIn);
  const bleedPt = inToPt(trim.bleedIn);
  const safeInset = bleedPt + inToPt(trim.safeIn);
  const contentWidth = widthPt - 2 * safeInset;
  const contentHeight = heightPt - 2 * safeInset;
  return { widthPt, heightPt, safeInset, contentWidth, contentHeight };
}

const fontByTypography = {
  clean: "Inter",
  editorial: "Playfair Display",
  hand: "Caveat",
  playful: "Fredoka",
} as const;

function getDesign(payload: BookPayload): CoverDesign {
  return getCoverDesign(normalizeCoverStyle(payload.style));
}

function getTitle(payload: BookPayload) {
  return payload.meta.title?.trim() || "My Coloring Book";
}

function getSubtitle(payload: BookPayload) {
  return payload.meta.subtitle?.trim() || "A Little Color Book";
}

function getChildName(payload: BookPayload) {
  return payload.occasionContext.childName?.trim() || getTitle(payload).replace(/'s .+$/i, "").trim() || "My";
}

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "LC";
}

function getImageUrl(ref?: ImageRef | null) {
  const url = ref?.url?.trim();
  return url ? url : null;
}

function getHeroImage(payload: BookPayload) {
  if (payload.cover.type === "customer-photo") {
    return getImageUrl(payload.cover.photo);
  }

  const firstPage = payload.pages[0];
  return getImageUrl(firstPage?.sourcePhotoThumb) ?? getImageUrl(firstPage?.lineArt);
}

function titleSize(title: string, max = 52, min = 28) {
  return Math.max(min, Math.min(max, Math.floor(760 / Math.max(title.length, 12))));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => `${char}${char}`).join("")
    : value.padEnd(6, "0").slice(0, 6);

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function blend(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const weight = Math.abs(amount);
  const channel = (value: number) => Math.round(value + (target - value) * weight);
  return `#${[channel(r), channel(g), channel(b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function MotifLayer({ design, dims }: { design: CoverDesign; dims: PageDims }) {
  const p = design.palette;
  const pageW = dims.widthPt;
  const pageH = dims.heightPt;
  const dot = 7;

  const circle = (key: string, left: number, top: number, size: number, color: string, opacity = 1) => (
    <View
      key={key}
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );

  const line = (key: string, left: number, top: number, width: number, height: number, color: string, opacity = 1) => (
    <View
      key={key}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        backgroundColor: color,
        opacity,
      }}
    />
  );

  const rect = (
    key: string,
    left: number,
    top: number,
    width: number,
    height: number,
    color: string,
    radius = 0,
    opacity = 1,
  ) => (
    <View
      key={key}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: radius,
        backgroundColor: color,
        opacity,
      }}
    />
  );

  const ring = (key: string, left: number, top: number, size: number, color: string, width = 2, opacity = 1) => (
    <View
      key={key}
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: width,
        borderColor: color,
        opacity,
      }}
    />
  );

  const defaultFrame = [
    ring("frame-a", 44, 46, pageW - 88, p.accent, 1.4, 0.32),
    ring("frame-b", 62, 64, pageW - 124, p.foil, 1, 0.28),
    circle("dot-tl", 38, 44, dot, p.accent, 0.5),
    circle("dot-tr", pageW - 45, 44, dot, p.accent, 0.5),
    circle("dot-bl", 38, pageH - 54, dot, p.accent, 0.5),
    circle("dot-br", pageW - 45, pageH - 54, dot, p.accent, 0.5),
  ];

  switch (design.motif) {
    case "storybook-window":
      return (
        <>
          {rect("block-top", pageW - 210, 0, 210, 265, p.paperAlt, 0, 0.86)}
          {rect("block-bottom", 0, pageH - 190, pageW, 190, blend(p.accent3, 0.45), 0, 0.76)}
          {circle("star-a", 74, 88, 9, p.accent3, 0.9)}
          {circle("star-b", pageW - 86, 128, 7, p.accent, 0.82)}
          {ring("arch-shadow", 116, 132, 380, p.accent2, 3, 0.24)}
        </>
      );
    case "memory-album":
      return (
        <>
          {rect("paper-a", 70, 118, 190, 250, blend(p.paperAlt, 0.25), 18, 0.9)}
          {rect("paper-b", pageW - 256, 92, 172, 230, blend(p.accent3, 0.48), 16, 0.76)}
          {rect("tape-a", 108, 102, 88, 22, p.accent, 8, 0.5)}
          {rect("tape-b", pageW - 190, 78, 82, 20, p.accent2, 8, 0.5)}
          {line("deckle", 55, pageH - 182, pageW - 110, 2, p.accent, 0.28)}
        </>
      );
    case "heritage-crest":
      return (
        <>
          {defaultFrame}
          {ring("crest-outer", pageW / 2 - 124, 116, 248, p.foil, 4, 0.45)}
          {ring("crest-inner", pageW / 2 - 94, 146, 188, p.accent2, 2, 0.55)}
          {line("crest-line-a", pageW / 2 - 115, 246, 230, 2, p.accent, 0.45)}
          {line("crest-line-b", pageW / 2, 158, 2, 178, p.accent, 0.32)}
        </>
      );
    case "grandparent-keepsake":
    case "fairy-garden":
      return (
        <>
          {defaultFrame}
          {circle("botanical-a", 56, 94, 34, p.accent2, 0.24)}
          {circle("botanical-b", 82, 124, 18, p.accent2, 0.34)}
          {circle("botanical-c", pageW - 92, 104, 30, p.accent2, 0.24)}
          {circle("botanical-d", pageW - 114, 138, 16, p.accent, 0.3)}
          {line("ribbon", 86, pageH - 212, pageW - 172, 18, p.accent, 0.42)}
        </>
      );
    case "birthday-capsule":
      return (
        <>
          {rect("birthday-band", 0, 0, pageW, 96, p.accent3, 0, 0.72)}
          {circle("confetti-a", 68, 92, 9, p.accent, 0.9)}
          {circle("confetti-b", 130, 66, 7, p.accent2, 0.9)}
          {circle("confetti-c", pageW - 112, 82, 11, p.accent, 0.85)}
          {circle("confetti-d", pageW - 160, 128, 8, p.accent3, 0.95)}
          {line("candle-a", pageW - 80, 38, 8, 46, p.accent, 0.8)}
          {line("candle-b", pageW - 104, 46, 8, 38, p.accent2, 0.8)}
        </>
      );
    case "adventure-map":
      return (
        <>
          {rect("map-strip", 0, pageH - 170, pageW, 170, p.paperAlt, 0, 0.76)}
          {line("route-a", 62, 132, pageW - 124, 2, p.accent, 0.36)}
          {line("route-b", 102, 194, pageW - 204, 2, p.accent2, 0.36)}
          {ring("compass", pageW - 132, 88, 72, p.foil, 2, 0.62)}
          {circle("route-dot-a", 122, 127, 13, p.accent, 0.8)}
          {circle("route-dot-b", pageW - 176, 189, 13, p.accent2, 0.8)}
        </>
      );
    case "field-notebook":
      return (
        <>
          {rect("notebook-spine", 0, 0, 54, pageH, p.accent2, 0, 0.5)}
          {ring("badge-a", 82, 92, 82, p.accent, 3, 0.72)}
          {ring("badge-b", pageW - 164, 126, 76, p.foil, 3, 0.72)}
          {ring("badge-c", pageW - 138, pageH - 228, 74, p.accent2, 3, 0.72)}
          {line("stamp-line", 88, pageH - 166, pageW - 176, 2, p.accent, 0.28)}
        </>
      );
    case "space-explorer":
      return (
        <>
          {ring("orbit-a", pageW - 300, 58, 420, p.accent2, 2, 0.28)}
          {ring("orbit-b", -80, 206, 280, p.accent, 2, 0.28)}
          {circle("star-1", 78, 88, 5, p.ink, 0.9)}
          {circle("star-2", 158, 154, 4, p.accent, 0.9)}
          {circle("star-3", pageW - 96, 102, 6, p.ink, 0.9)}
          {circle("planet", pageW - 158, pageH - 225, 68, p.accent3, 0.72)}
        </>
      );
    case "ocean-porthole":
      return (
        <>
          {rect("wave-a", 0, pageH - 210, pageW, 74, p.accent2, 0, 0.42)}
          {rect("wave-b", 0, pageH - 146, pageW, 54, p.paperAlt, 0, 0.9)}
          {ring("porthole", pageW / 2 - 152, 118, 304, p.foil, 8, 0.58)}
          {circle("bubble-a", 72, 116, 20, p.accent2, 0.24)}
          {circle("bubble-b", pageW - 118, 184, 14, p.accent2, 0.3)}
        </>
      );
    case "dino-discovery":
      return (
        <>
          {rect("fossil-plate", 62, 92, pageW - 124, 260, blend(p.paperAlt, 0.2), 28, 0.84)}
          {ring("fossil-a", 96, 134, 58, p.accent, 2, 0.44)}
          {ring("fossil-b", pageW - 168, 168, 72, p.accent2, 2, 0.44)}
          {line("label-a", 108, 292, 130, 2, p.muted, 0.42)}
          {line("label-b", pageW - 236, 286, 122, 2, p.muted, 0.42)}
        </>
      );
    case "wild-safari":
      return (
        <>
          {rect("sun", pageW - 160, 78, 98, 98, p.accent3, 49, 0.58)}
          {circle("leaf-a", 54, 80, 54, p.accent2, 0.28)}
          {circle("leaf-b", 86, 118, 38, p.accent2, 0.32)}
          {circle("paw-a", pageW - 102, pageH - 188, 12, p.accent, 0.5)}
          {circle("paw-b", pageW - 82, pageH - 168, 9, p.accent, 0.5)}
        </>
      );
    case "superhero-spotlight":
      return (
        <>
          {line("ray-a", pageW / 2, 90, 4, 360, p.accent3, 0.62)}
          {line("ray-b", pageW / 2 - 118, 126, 4, 300, p.accent2, 0.42)}
          {line("ray-c", pageW / 2 + 116, 126, 4, 300, p.accent, 0.42)}
          {ring("hero-shield", pageW / 2 - 146, 112, 292, p.accent, 5, 0.48)}
        </>
      );
    case "comic-panels":
      return (
        <>
          {rect("panel-a", 52, 78, 210, 170, p.paperAlt, 12, 0.88)}
          {rect("panel-b", pageW - 250, 96, 190, 152, p.accent3, 12, 0.64)}
          {rect("panel-c", 94, 276, pageW - 188, 106, p.accent2, 12, 0.24)}
          {line("comic-line", 44, 264, pageW - 88, 5, p.ink, 0.6)}
        </>
      );
    case "sports-all-star":
      return (
        <>
          {rect("stripe-a", 0, 82, pageW, 34, p.accent, 0, 0.72)}
          {rect("stripe-b", 0, 126, pageW, 18, p.accent2, 0, 0.72)}
          {ring("number-block", pageW - 176, 178, 104, p.foil, 4, 0.6)}
          {line("ticket", 72, pageH - 188, pageW - 144, 2, p.accent2, 0.34)}
        </>
      );
    case "starry-stage":
      return (
        <>
          {rect("curtain-left", 0, 0, 92, pageH, p.accent, 0, 0.42)}
          {rect("curtain-right", pageW - 92, 0, 92, pageH, p.accent, 0, 0.42)}
          {ring("spotlight", pageW / 2 - 162, 92, 324, p.foil, 3, 0.32)}
          {circle("marquee-a", 74, 70, 8, p.foil, 0.9)}
          {circle("marquee-b", pageW - 82, 70, 8, p.foil, 0.9)}
          {circle("marquee-c", pageW / 2 - 4, 54, 8, p.foil, 0.9)}
        </>
      );
    case "bedtime-story":
      return (
        <>
          {circle("moon", pageW - 142, 88, 74, p.accent3, 0.62)}
          {rect("window", 80, 116, 122, 154, p.paperAlt, 18, 0.84)}
          {line("window-x", 141, 116, 2, 154, p.accent2, 0.34)}
          {line("window-y", 80, 193, 122, 2, p.accent2, 0.34)}
          {circle("star-a", pageW - 210, 108, 6, p.foil, 0.8)}
          {circle("star-b", pageW - 86, 186, 5, p.foil, 0.8)}
        </>
      );
    case "pet-club":
      return (
        <>
          {ring("club-badge", pageW / 2 - 136, 110, 272, p.accent2, 5, 0.42)}
          {circle("paw-1", 92, 112, 15, p.accent, 0.42)}
          {circle("paw-2", 118, 138, 10, p.accent, 0.42)}
          {circle("paw-3", pageW - 108, 138, 15, p.accent, 0.42)}
          {circle("paw-4", pageW - 136, 164, 10, p.accent, 0.42)}
        </>
      );
    case "creative-studio":
      return (
        <>
          {rect("swatch-a", 74, 88, 92, 126, p.accent, 14, 0.44)}
          {rect("swatch-b", 150, 126, 104, 138, p.accent2, 14, 0.34)}
          {rect("swatch-c", pageW - 188, 94, 102, 128, p.accent3, 14, 0.55)}
          {line("pencil", pageW - 90, 240, 2, 196, p.ink, 0.45)}
          {line("signature", 104, pageH - 174, 164, 2, p.accent, 0.45)}
        </>
      );
    case "linen-frame":
    default:
      return <>{defaultFrame}</>;
  }
}

function CoverHero({ design, payload, dims }: { design: CoverDesign; payload: BookPayload; dims: PageDims }) {
  const p = design.palette;
  const childName = getChildName(payload);
  const heroImage = getHeroImage(payload);
  const isBadge = design.heroTreatment === "graphic-badge";
  const isPanel = design.heroTreatment === "panel-stack";
  const frameW = isBadge ? dims.widthPt * 0.34 : isPanel ? dims.widthPt * 0.37 : dims.widthPt * 0.32;
  const frameAspect = isBadge ? 1 : isPanel ? 0.8 : 0.72;
  const frameH = frameW / frameAspect;
  const left = dims.widthPt / 2 - frameW / 2;
  const top = dims.heightPt * 0.17;
  const frameRadius = isBadge ? frameH / 2 : design.heroTreatment === "line-art-window" ? 42 : 28;
  const heroZoom = isBadge ? 1 : isPanel ? 1.12 : 1.18;
  const heroInnerWidth = frameW - 24;
  const heroInnerHeight = frameH - 24;

  const styles = StyleSheet.create({
    heroFrame: {
      position: "absolute",
      left,
      top,
      width: frameW,
      height: frameH,
      borderRadius: frameRadius,
      borderWidth: isBadge ? 4 : 3,
      borderColor: p.foil,
      backgroundColor: blend(p.paper, 0.18),
      overflow: "hidden",
      padding: 12,
    },
    heroInner: {
      flex: 1,
      borderRadius: Math.max(18, frameRadius - 8),
      borderWidth: 1,
      borderColor: blend(p.accent, 0.35),
      backgroundColor: blend(p.paperAlt, 0.24),
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    heroImage: {
      width: heroInnerWidth * heroZoom,
      height: heroInnerHeight * heroZoom,
      objectFit: "cover",
    },
    heroInitials: {
      fontFamily: fontByTypography[design.typography],
      fontSize: isBadge ? 56 : 42,
      color: p.accent,
      textAlign: "center",
    },
    heroLabel: {
      marginTop: 6,
      fontFamily: "Inter",
      fontSize: 8,
      letterSpacing: 1.8,
      color: p.muted,
      textTransform: "uppercase",
      textAlign: "center",
    },
  });

  return (
    <View style={styles.heroFrame}>
      <View style={styles.heroInner}>
        {heroImage ? (
          <Image src={heroImage} style={styles.heroImage} />
        ) : (
          <>
            <Text style={styles.heroInitials}>{getInitials(childName)}</Text>
            <Text style={styles.heroLabel}>Coloring Book</Text>
          </>
        )}
      </View>
    </View>
  );
}

export function PremiumCoverPage({
  payload,
  dims,
}: {
  payload: BookPayload;
  dims: PageDims;
}): React.ReactElement {
  const design = getDesign(payload);
  const p = design.palette;
  const title = getTitle(payload);
  const subtitle = getSubtitle(payload);
  const headingFont = fontByTypography[design.typography];
  const pageW = dims.widthPt;
  const pageH = dims.heightPt;
  const titleTop = pageH * 0.62;
  const safeInset = Math.max(dims.safeInset, 28);

  const styles = StyleSheet.create({
    page: {
      width: pageW,
      height: pageH,
      position: "relative",
      backgroundColor: p.paper,
      color: p.ink,
    },
    textureA: {
      position: "absolute",
      left: 0,
      top: 0,
      width: pageW,
      height: pageH,
      backgroundColor: p.paperAlt,
      opacity: design.palette.paper === "#111B33" || design.palette.paper === "#2B1530" ? 0.16 : 0.28,
    },
    titlePlate: {
      position: "absolute",
      left: safeInset + 28,
      right: safeInset + 28,
      top: titleTop,
      paddingTop: 24,
      paddingBottom: 24,
      paddingLeft: 26,
      paddingRight: 26,
      borderRadius: 30,
      backgroundColor: blend(p.paper, design.palette.paper === "#111B33" || design.palette.paper === "#2B1530" ? 0.08 : 0.28),
      borderWidth: 1,
      borderColor: blend(p.foil, 0.25),
    },
    title: {
      fontFamily: headingFont,
      fontSize: titleSize(title),
      lineHeight: 0.95,
      color: p.ink,
      textAlign: "center",
    },
    subtitle: {
      marginTop: 12,
      fontFamily: "Inter",
      fontSize: 11,
      letterSpacing: 2,
      color: p.muted,
      textAlign: "center",
      textTransform: "uppercase",
    },
    footer: {
      position: "absolute",
      left: safeInset,
      right: safeInset,
      bottom: safeInset + 18,
      fontFamily: "Inter",
      fontSize: 8,
      letterSpacing: 1.8,
      color: p.muted,
      textAlign: "center",
      textTransform: "uppercase",
    },
    coilRail: {
      position: "absolute",
      left: 0,
      top: 0,
      width: 24,
      height: pageH,
      backgroundColor: blend(p.ink, 0.78),
      opacity: 0.14,
    },
  });

  return (
    <Page size={{ width: pageW, height: pageH }} style={styles.page}>
      <View style={styles.textureA} />
      <View style={styles.coilRail} />
      <MotifLayer design={design} dims={dims} />
      <CoverHero design={design} payload={payload} dims={dims} />
      <View style={styles.titlePlate}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.footer}>littlecolorbook.com</Text>
    </Page>
  );
}

export function PremiumTitlePage({
  payload,
  dims,
}: {
  payload: BookPayload;
  dims: PageDims;
}): React.ReactElement {
  const design = getDesign(payload);
  const p = design.palette;
  const childName = getChildName(payload);
  const dedication = payload.meta.dedication?.trim();
  const createdOn = payload.meta.createdOn;
  const styles = StyleSheet.create({
    page: {
      width: dims.widthPt,
      height: dims.heightPt,
      position: "relative",
      backgroundColor: blend(p.paper, 0.42),
      color: p.ink,
      padding: Math.max(dims.safeInset, 46),
    },
    frame: {
      flex: 1,
      borderWidth: 2,
      borderColor: blend(p.foil, 0.18),
      borderRadius: 34,
      padding: 38,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: blend(p.paper, 0.24),
    },
    kicker: {
      fontFamily: "Inter",
      fontSize: 10,
      letterSpacing: 2.5,
      textTransform: "uppercase",
      color: p.muted,
      marginBottom: 28,
    },
    name: {
      fontFamily: fontByTypography[design.typography],
      fontSize: 58,
      lineHeight: 0.95,
      color: p.ink,
      textAlign: "center",
      marginBottom: 18,
    },
    subline: {
      fontFamily: "Inter",
      fontSize: 14,
      color: p.muted,
      textAlign: "center",
      marginBottom: 32,
    },
    divider: {
      width: 120,
      height: 2,
      backgroundColor: p.accent,
      opacity: 0.48,
      marginBottom: 30,
    },
    dedication: {
      fontFamily: "Playfair Display",
      fontSize: 17,
      lineHeight: 1.45,
      color: p.ink,
      textAlign: "center",
      marginBottom: 26,
      maxWidth: 400,
    },
    created: {
      fontFamily: "Inter",
      fontSize: 9,
      letterSpacing: 1.8,
      color: p.muted,
      textTransform: "uppercase",
    },
    cornerDot: {
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: p.accent,
      opacity: 0.36,
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={styles.page}>
      <View style={[styles.cornerDot, { left: 42, top: 42 }]} />
      <View style={[styles.cornerDot, { right: 42, top: 42 }]} />
      <View style={[styles.cornerDot, { left: 42, bottom: 42 }]} />
      <View style={[styles.cornerDot, { right: 42, bottom: 42 }]} />
      <View style={styles.frame}>
        <Text style={styles.kicker}>This book belongs to</Text>
        <Text style={styles.name}>{childName}</Text>
        <Text style={styles.subline}>{getSubtitle(payload)}</Text>
        <View style={styles.divider} />
        {dedication ? (
          <Text style={styles.dedication}>{dedication}</Text>
        ) : (
          <Text style={styles.dedication}>A book of favorite memories, ready to color.</Text>
        )}
        <Text style={styles.created}>Created {createdOn}</Text>
      </View>
    </Page>
  );
}

export function PremiumClosingPage({
  payload,
  dims,
}: {
  payload: BookPayload;
  dims: PageDims;
}): React.ReactElement {
  const design = getDesign(payload);
  const p = design.palette;
  const styles = StyleSheet.create({
    page: {
      width: dims.widthPt,
      height: dims.heightPt,
      position: "relative",
      backgroundColor: blend(p.paper, 0.5),
      color: p.ink,
      padding: Math.max(dims.safeInset, 48),
    },
    card: {
      flex: 1,
      borderRadius: 32,
      borderWidth: 1.5,
      borderColor: blend(p.foil, 0.2),
      backgroundColor: blend(p.paper, 0.18),
      padding: 44,
      justifyContent: "center",
    },
    kicker: {
      fontFamily: "Inter",
      fontSize: 10,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      color: p.muted,
      marginBottom: 22,
      textAlign: "center",
    },
    title: {
      fontFamily: fontByTypography[design.typography],
      fontSize: 42,
      lineHeight: 1,
      color: p.ink,
      textAlign: "center",
      marginBottom: 18,
    },
    body: {
      fontFamily: "Inter",
      fontSize: 13,
      lineHeight: 1.55,
      color: p.muted,
      textAlign: "center",
      marginBottom: 34,
    },
    prompt: {
      fontFamily: "Inter",
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: p.ink,
      marginBottom: 14,
    },
    line: {
      height: 1.4,
      backgroundColor: blend(p.muted, 0.46),
      marginBottom: 18,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 34,
      fontFamily: "Inter",
      fontSize: 9,
      letterSpacing: 1.8,
      color: p.muted,
      textAlign: "center",
      textTransform: "uppercase",
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Before you close the book</Text>
        <Text style={styles.title}>Favorite pages to color again</Text>
        <Text style={styles.body}>
          Mark the pages worth printing again, gifting, or saving for the next family coloring book.
        </Text>
        <Text style={styles.prompt}>My top three pages</Text>
        <View style={styles.line} />
        <View style={styles.line} />
        <View style={styles.line} />
      </View>
      <Text style={styles.footer}>Made by littlecolorbook.com</Text>
    </Page>
  );
}

export function PremiumNotesPage({
  payload,
  dims,
}: {
  payload: BookPayload;
  dims: PageDims;
}): React.ReactElement {
  const design = getDesign(payload);
  const p = design.palette;
  const styles = StyleSheet.create({
    page: {
      width: dims.widthPt,
      height: dims.heightPt,
      backgroundColor: "#FFFFFF",
      padding: Math.max(dims.safeInset, 52),
      color: p.ink,
    },
    title: {
      fontFamily: fontByTypography[design.typography],
      fontSize: 34,
      color: p.ink,
      marginBottom: 14,
    },
    body: {
      fontFamily: "Inter",
      fontSize: 12,
      color: p.muted,
      marginBottom: 30,
    },
    line: {
      height: 1,
      backgroundColor: blend(p.muted, 0.52),
      marginBottom: 28,
    },
  });

  return (
    <Page size={{ width: dims.widthPt, height: dims.heightPt }} style={styles.page}>
      <Text style={styles.title}>Ideas for the next book</Text>
      <Text style={styles.body}>Trips, pets, birthdays, school days, grandparents, and favorite everyday moments.</Text>
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
      <View style={styles.line} />
    </Page>
  );
}
