// ---------------------------------------------------------------------------
// renderPartyKitPdf — the "Coloring Party Kit" bonus PDF.
//
// 3 pages of US Letter content parents can print alongside the main book:
//   1. Cover sheet — "This book belongs to [childFirstName]" with decorative
//      border and blank spaces the child can color in.
//   2. Coloring tips — a warm, brief page of parent-facing advice on making
//      the first coloring session go well.
//   3. About the Artist — a kid-fillable portrait page where the child
//      draws themselves and fills in "My favorite color", "I am X years
//      old", etc.
//
// All content is print-ready and lightly personalized with the child's
// first name when provided.
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

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;

const COLORS = {
  ink: "#211915",
  muted: "#5c4b3d",
  accent: "#ff6b57",
  sun: "#ffb545",
  mint: "#1c9474",
  sky: "#2f83c7",
  paper: "#fffaf5",
  hairline: "#e7d7c4",
  fill: "#fff3e8",
};

export type PartyKitInput = {
  /** Child's first name, used on the cover sheet + about-the-artist page. */
  childFirstName?: string | null;
};

const basePage = {
  width: LETTER_WIDTH_PT,
  height: LETTER_HEIGHT_PT,
  backgroundColor: COLORS.paper,
  paddingTop: 48,
  paddingBottom: 48,
  paddingLeft: 56,
  paddingRight: 56,
  fontFamily: "Inter",
} as const;

const footer = StyleSheet.create({
  wrapper: {
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
  text: {
    fontFamily: "Inter",
    fontSize: 9,
    color: COLORS.muted,
  },
});

function Footer({ label }: { label: string }) {
  return (
    <View style={footer.wrapper} fixed>
      <Text style={footer.text}>Little Color Book · {label}</Text>
      <Text style={footer.text}>littlecolorbook.com</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 1 — Cover sheet
// ---------------------------------------------------------------------------

const coverStyles = StyleSheet.create({
  page: basePage,
  outerFrame: {
    flex: 1,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderStyle: "solid",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  innerFrame: {
    flex: 1,
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.ink,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: "Fredoka",
    fontSize: 13,
    color: COLORS.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  thisBookBelongsTo: {
    fontFamily: "Caveat",
    fontSize: 34,
    color: COLORS.ink,
    marginBottom: 8,
  },
  nameBlock: {
    fontFamily: "Fredoka",
    fontSize: 56,
    fontWeight: 700,
    color: COLORS.accent,
    lineHeight: 1.1,
    marginBottom: 18,
    textAlign: "center",
  },
  nameLine: {
    width: 280,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink,
    marginTop: 8,
    marginBottom: 18,
  },
  colorThisIn: {
    fontFamily: "Caveat",
    fontSize: 18,
    color: COLORS.muted,
    marginTop: 22,
    marginBottom: 10,
  },
  colorableRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 6,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderStyle: "solid",
  },
  note: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Caveat",
    fontSize: 14,
    color: COLORS.muted,
  },
});

function CoverSheet({ name }: { name: string | null }) {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={coverStyles.page}>
      <View style={coverStyles.outerFrame}>
        <View style={coverStyles.innerFrame}>
          <Text style={coverStyles.eyebrow}>The Coloring Party Kit</Text>
          <Text style={coverStyles.thisBookBelongsTo}>This book belongs to</Text>
          {name ? (
            <Text style={coverStyles.nameBlock}>{name}</Text>
          ) : (
            <View style={coverStyles.nameLine} />
          )}
          <Text style={coverStyles.colorThisIn}>~ color these in ~</Text>
          <View style={coverStyles.colorableRow}>
            <View style={coverStyles.circle} />
            <View style={coverStyles.circle} />
            <View style={coverStyles.circle} />
            <View style={coverStyles.circle} />
            <View style={coverStyles.circle} />
          </View>
          <Text style={coverStyles.note}>Cut along the dashed line, tape to the front, and you have a cover.</Text>
        </View>
      </View>
      <Footer label="The Coloring Party Kit · 1 of 3" />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Page 2 — Coloring tips
// ---------------------------------------------------------------------------

const tipsStyles = StyleSheet.create({
  page: basePage,
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
  tipRow: {
    flexDirection: "row",
    marginBottom: 14,
    paddingLeft: 4,
  },
  tipNumber: {
    width: 28,
    fontFamily: "Fredoka",
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.accent,
  },
  tipBody: {
    flex: 1,
  },
  tipHeading: {
    fontFamily: "Fredoka",
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.ink,
    marginBottom: 3,
  },
  tipText: {
    fontFamily: "Inter",
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 1.5,
  },
});

const tips: { heading: string; text: string }[] = [
  {
    heading: "Set up the spot first",
    text: "A clear table, a fresh box of crayons, good light. Thirty seconds of setup saves ten minutes of hunting for a sharp crayon halfway in.",
  },
  {
    heading: "Hand over one page, not the whole book",
    text: "Smaller stakes feel more doable. Let them finish the first page before picking the next. The book lasts longer that way.",
  },
  {
    heading: "Sit down too",
    text: "You don't have to color the whole page. Grab one small section and color along for ten minutes. Kids finish more when parents stay.",
  },
  {
    heading: "No rules about 'staying in the lines'",
    text: "The page is the start, not the scoreboard. Scribbles, wrong colors, dog made neon — all of it is the point.",
  },
  {
    heading: "Put the finished page somewhere it'll be seen",
    text: "The fridge, the bulletin board, grandma's mailbox. Pages that get noticed make kids want to color more of them.",
  },
  {
    heading: "Save a page for a rainy day",
    text: "Don't hand over all fifty pages at once. Keeping a few tucked away makes the book last weeks instead of an afternoon.",
  },
];

function TipsPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={tipsStyles.page}>
      <Text style={tipsStyles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={tipsStyles.title}>Six small things that make the first coloring session stick.</Text>
      <Text style={tipsStyles.lede}>
        You already have the book. These are the low-effort moves parents tell us made the difference
        between a page and a whole afternoon.
      </Text>

      {tips.map((tip, i) => (
        <View key={i} style={tipsStyles.tipRow}>
          <Text style={tipsStyles.tipNumber}>{i + 1}.</Text>
          <View style={tipsStyles.tipBody}>
            <Text style={tipsStyles.tipHeading}>{tip.heading}</Text>
            <Text style={tipsStyles.tipText}>{tip.text}</Text>
          </View>
        </View>
      ))}

      <Footer label="The Coloring Party Kit · 2 of 3" />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Page 3 — About the Artist (kid-fillable)
// ---------------------------------------------------------------------------

const artistStyles = StyleSheet.create({
  page: basePage,
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
    marginBottom: 16,
  },
  frameBox: {
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderRadius: 8,
    padding: 18,
    marginBottom: 18,
  },
  frameBoxLabel: {
    fontFamily: "Caveat",
    fontSize: 18,
    color: COLORS.muted,
    marginBottom: 8,
  },
  portraitBox: {
    height: 200,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitHint: {
    fontFamily: "Caveat",
    fontSize: 14,
    color: COLORS.muted,
  },
  fillRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
    gap: 8,
  },
  fillLabel: {
    fontFamily: "Fredoka",
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.ink,
    minWidth: 130,
  },
  fillLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    height: 18,
  },
  signature: {
    marginTop: 14,
    alignItems: "flex-end",
  },
  signatureLabel: {
    fontFamily: "Caveat",
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  signatureLine: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    height: 22,
  },
});

function AboutArtistPage({ name }: { name: string | null }) {
  const title = name ? `About the artist: ${name}` : "About the artist";
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={artistStyles.page}>
      <Text style={artistStyles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={artistStyles.title}>{title}</Text>

      <View style={artistStyles.frameBox}>
        <Text style={artistStyles.frameBoxLabel}>Draw a self-portrait here:</Text>
        <View style={artistStyles.portraitBox}>
          <Text style={artistStyles.portraitHint}>(or paste a photo on top)</Text>
        </View>
      </View>

      <View style={artistStyles.fillRow}>
        <Text style={artistStyles.fillLabel}>My name is</Text>
        <View style={artistStyles.fillLine} />
      </View>
      <View style={artistStyles.fillRow}>
        <Text style={artistStyles.fillLabel}>I am this many years old</Text>
        <View style={artistStyles.fillLine} />
      </View>
      <View style={artistStyles.fillRow}>
        <Text style={artistStyles.fillLabel}>My favorite color is</Text>
        <View style={artistStyles.fillLine} />
      </View>
      <View style={artistStyles.fillRow}>
        <Text style={artistStyles.fillLabel}>My favorite animal is</Text>
        <View style={artistStyles.fillLine} />
      </View>
      <View style={artistStyles.fillRow}>
        <Text style={artistStyles.fillLabel}>When I grow up I want to be</Text>
        <View style={artistStyles.fillLine} />
      </View>
      <View style={artistStyles.fillRow}>
        <Text style={artistStyles.fillLabel}>The best part of this book is</Text>
        <View style={artistStyles.fillLine} />
      </View>

      <View style={artistStyles.signature}>
        <Text style={artistStyles.signatureLabel}>Signed by the artist:</Text>
        <View style={artistStyles.signatureLine} />
      </View>

      <Footer label="The Coloring Party Kit · 3 of 3" />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderPartyKitPdf(input: PartyKitInput = {}): Promise<Buffer> {
  const trimmedName = input.childFirstName?.trim();
  const name = trimmedName && trimmedName.length > 0 ? trimmedName : null;

  const doc = (
    <Document>
      <CoverSheet name={name} />
      <TipsPage />
      <AboutArtistPage name={name} />
    </Document>
  );

  return renderToBuffer(doc);
}
