// ---------------------------------------------------------------------------
// renderPhotoPickerGuidePdf — the "Best Photo Picker Guide" bonus PDF.
// One-page US Letter checklist that parents can print and consult when
// picking photos for their next book. Static content (no per-customer
// personalization), so the buffer can be cached if desired.
// ---------------------------------------------------------------------------

import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { registerFonts } from "../fonts/register";

registerFonts();

const LETTER_WIDTH_PT = 612; // 8.5 × 72
const LETTER_HEIGHT_PT = 792; // 11 × 72

const COLORS = {
  ink: "#211915",
  muted: "#5c4b3d",
  accent: "#ff6b57", // coral — brand primary
  mint: "#1c9474",
  paper: "#fffaf5",
  hairline: "#e7d7c4",
};

const styles = StyleSheet.create({
  page: {
    width: LETTER_WIDTH_PT,
    height: LETTER_HEIGHT_PT,
    backgroundColor: COLORS.paper,
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 56,
    paddingRight: 56,
    fontFamily: "Inter",
  },
  eyebrow: {
    fontFamily: "Fredoka",
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Fredoka",
    fontSize: 28,
    fontWeight: 700,
    color: COLORS.ink,
    lineHeight: 1.15,
    marginBottom: 10,
  },
  lede: {
    fontFamily: "Inter",
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 1.45,
    marginBottom: 22,
  },
  sectionHeading: {
    fontFamily: "Fredoka",
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.ink,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionHeadingGreat: {
    color: COLORS.mint,
  },
  sectionHeadingSkip: {
    color: COLORS.accent,
  },
  itemRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    width: 18,
    fontFamily: "Fredoka",
    fontSize: 12,
    color: COLORS.muted,
  },
  itemText: {
    flex: 1,
    fontFamily: "Inter",
    fontSize: 11,
    color: COLORS.ink,
    lineHeight: 1.45,
  },
  rule: {
    marginTop: 22,
    padding: 14,
    backgroundColor: "#fff3e8",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  ruleLabel: {
    fontFamily: "Fredoka",
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  ruleText: {
    fontFamily: "Inter",
    fontSize: 12,
    fontStyle: "italic",
    color: COLORS.ink,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    paddingTop: 10,
  },
  footerText: {
    fontFamily: "Inter",
    fontSize: 9,
    color: COLORS.muted,
  },
});

const worksGreat = [
  "A single clear face, filling most of the frame",
  "Candid action shots — mid-laugh, mid-jump, mid-zoomie",
  "Pets up close, one pet per photo",
  "Siblings piled on the couch, cuddling, or mid-wrestle",
  "The grandparent-and-kid shot where you can see both faces",
  "Birthday cake moments, blowing out candles, first bite",
];

const worksOkay = [
  "Posed school or studio photos (cleaner background = cleaner page)",
  "Group shots where your kid is clearly in the front and center",
  "Holiday photos with good lighting on faces",
];

const skip = [
  "Dim lighting or heavy shadow across faces",
  "Very wide landscape shots — faces end up tiny",
  "Crowded backgrounds with lots of distracting detail",
  "Heavy filters, stickers, or text already on the photo",
  "Screenshots of other photos (quality drops fast)",
];

export async function renderPhotoPickerGuidePdf(): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
        <Text style={styles.eyebrow}>The Little Color Book bonus</Text>
        <Text style={styles.title}>Best Photo Picker Guide</Text>
        <Text style={styles.lede}>
          A one-page cheat sheet for the photos that turn into the cleanest coloring pages. Keep this
          near your camera roll for the next book.
        </Text>

        <Text style={[styles.sectionHeading, styles.sectionHeadingGreat]}>Works great</Text>
        {worksGreat.map((item, i) => (
          <View key={`g-${i}`} style={styles.itemRow}>
            <Text style={styles.bullet}>✓</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}

        <Text style={styles.sectionHeading}>Works okay</Text>
        {worksOkay.map((item, i) => (
          <View key={`o-${i}`} style={styles.itemRow}>
            <Text style={styles.bullet}>·</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}

        <Text style={[styles.sectionHeading, styles.sectionHeadingSkip]}>Skip these</Text>
        {skip.map((item, i) => (
          <View key={`s-${i}`} style={styles.itemRow}>
            <Text style={styles.bullet}>✗</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}

        <View style={styles.rule}>
          <Text style={styles.ruleLabel}>The magic rule</Text>
          <Text style={styles.ruleText}>
            One photo, one hero. If your camera roll has a blurry laughing shot you almost deleted —
            send that. They make the best pages.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Little Color Book · Best Photo Picker Guide</Text>
          <Text style={styles.footerText}>littlecolorbook.com</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
