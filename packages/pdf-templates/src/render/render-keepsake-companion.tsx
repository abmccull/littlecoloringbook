// ---------------------------------------------------------------------------
// renderKeepsakeCompanionPdf - the "Keepsake Companion" bonus PDF.
//
// A printable family keepsake companion built to make the book feel more
// giftable, more personal, and more likely to be saved:
//   1. Capture who the child is right now.
//   2. Tell the story behind the book and the season of life around it.
//   3. Add parent, grandparent, and family notes worth keeping.
//   4. Mark favorite pages and the day the book was finished.
//
// The PDF is lightly personalized with the child's name, dedication, and
// customer first name when available.
// ---------------------------------------------------------------------------

import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { registerFonts } from "../fonts/register";

registerFonts();

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;

const FONTS = {
  body: "Inter",
  display: "Fredoka",
  serif: "Playfair Display",
  script: "Caveat",
} as const;

const COLORS = {
  ink: "#211915",
  muted: "#5c4b3d",
  coral: "#d95b42",
  sun: "#ffb545",
  mint: "#1c9474",
  sky: "#2f83c7",
  paper: "#fffaf5",
  cream: "#fff3e8",
  paleMint: "#ecfaf4",
  paleSky: "#eef6fc",
  line: "#e7d7c4",
} as const;

export type KeepsakeCompanionInput = {
  childFirstName?: string | null;
  customerFirstName?: string | null;
  dedicationText?: string | null;
};

type PromptCard = {
  title: string;
  body: string;
};

const insideItems = [
  "Fill-in pages for what this age felt like right now.",
  "A page for the story behind the book and why it was made.",
  "Questions to ask while coloring so the pages become family memories.",
  "A parent note, a grandparent note, and pages worth saving later.",
  "A finish-the-book page so the whole thing feels kept, not just printed.",
];

const rightNowPrompts = [
  "I am this many years old",
  "People call me",
  "My funniest word right now is",
  "My favorite snack is",
  "My current obsession is",
  "The song I ask for most is",
  "The toy I carry everywhere is",
  "Something I say all the time is",
];

const storyPrompts: PromptCard[] = [
  {
    title: "Why we made this book",
    body: "Was it for a birthday, a rainy season, a grandparent, a gift, a hard week, or just because this age was too good not to keep?",
  },
  {
    title: "What season of life this was",
    body: "What did ordinary days look like right then? Preschool pickup, summer popsicles, dog walks, couch snuggles, cousins everywhere?",
  },
  {
    title: "Which page feels most true",
    body: "Pick the one page that feels most like your child right now and write why next to it.",
  },
  {
    title: "What you never want to forget",
    body: "The tiny thing, not the official milestone. The look, the joke, the made-up word, the post-bath hair, the way they ran to the dog.",
  },
];

const coloringQuestions: PromptCard[] = [
  {
    title: "What happened right before this page?",
    body: "This question almost always gets a better story than 'What is this picture?'",
  },
  {
    title: "Who else was there?",
    body: "Name the people, pets, cousins, and helpers that made the moment feel full.",
  },
  {
    title: "What was the funniest part?",
    body: "Funny details are often the first things to disappear later, so write them down while they are easy.",
  },
  {
    title: "What would this page be called?",
    body: "A tiny title turns a coloring page into a memory you can point to years from now.",
  },
  {
    title: "What do you want to remember about this age?",
    body: "Let the question stay small and specific. Big memory starts with little detail.",
  },
  {
    title: "Who should get a copy of this page?",
    body: "Grandma, Grandpa, cousins, babysitter, favorite aunt, or the family fridge all count.",
  },
];

const loveLists = [
  "People I love",
  "Pets I love",
  "Places I love",
  "Things that make me laugh",
  "Things I do when I am proud",
  "Things I want to do again",
];

const favoritePagePrompts = [
  "Page number",
  "Why this one mattered",
  "Who loved this page most",
];

const openAgainPrompts = [
  "Open this again when you need a reminder of this age.",
  "Open this again when someone asks what they were like back then.",
  "Open this again before making the next book.",
  "Open this again on a birthday, graduation, or grandparent visit.",
];

const basePage = {
  width: LETTER_WIDTH_PT,
  height: LETTER_HEIGHT_PT,
  backgroundColor: COLORS.paper,
  paddingTop: 42,
  paddingBottom: 44,
  paddingLeft: 48,
  paddingRight: 48,
  fontFamily: FONTS.body,
} as const;

const styles = StyleSheet.create({
  page: basePage,
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 9,
  },
  footerText: {
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.muted,
  },
  eyebrow: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: COLORS.coral,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.ink,
    lineHeight: 1.08,
    marginBottom: 10,
  },
  lede: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: COLORS.muted,
    lineHeight: 1.5,
    marginBottom: 18,
  },
  coverTitle: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.ink,
    lineHeight: 1.05,
    marginBottom: 10,
  },
  coverQuote: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    color: COLORS.ink,
    lineHeight: 1.35,
    marginBottom: 18,
  },
  panel: {
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    marginBottom: 12,
  },
  panelTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 6,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bullet: {
    width: 16,
    fontFamily: FONTS.display,
    fontSize: 10,
    color: COLORS.coral,
    paddingTop: 1,
  },
  listText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: COLORS.ink,
    lineHeight: 1.45,
  },
  noteBox: {
    marginTop: 8,
    padding: 14,
    backgroundColor: COLORS.paleMint,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.mint,
    borderRadius: 10,
  },
  noteLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.mint,
    marginBottom: 4,
  },
  noteText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.ink,
    lineHeight: 1.45,
  },
  fillRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
    gap: 8,
  },
  fillLabel: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
    minWidth: 150,
  },
  fillLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    height: 18,
  },
  widePrompt: {
    marginBottom: 14,
  },
  widePromptLabel: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 6,
  },
  writingBox: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
    padding: 12,
  },
  writingGuide: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    height: 16,
    marginBottom: 10,
  },
  cardGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  card: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cream,
    padding: 12,
  },
  cardTitle: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.muted,
    lineHeight: 1.42,
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    width: "48%",
  },
  sectionHeading: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 8,
  },
  quoteBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.paleSky,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.sky,
  },
  quoteTitle: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.sky,
    marginBottom: 6,
  },
  quoteText: {
    fontFamily: FONTS.serif,
    fontSize: 12,
    color: COLORS.ink,
    lineHeight: 1.45,
  },
  miniBox: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.paper,
    minHeight: 72,
    padding: 10,
    marginBottom: 10,
  },
  miniLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.ink,
    marginBottom: 5,
  },
  pageNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  pageNumberText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.coral,
  },
});

function Footer({ label }: { label: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Little Color Book - {label}</Text>
      <Text style={styles.footerText}>littlecolorbook.com</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.listRow}>
          <Text style={styles.bullet}>+</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function TitleBlock({ title, lede }: { title: string; lede: string }) {
  return (
    <View>
      <Text style={styles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.lede}>{lede}</Text>
    </View>
  );
}

function RenderPromptPairs({ items }: { items: PromptCard[] }) {
  const rows: PromptCard[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }

  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.cardGridRow}>
          {row.map((item) => (
            <View key={item.title} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          ))}
          {row.length === 1 ? <View style={{ width: "48%" }} /> : null}
        </View>
      ))}
    </View>
  );
}

function WritingBox({ lines = 4 }: { lines?: number }) {
  return (
    <View style={styles.writingBox}>
      {Array.from({ length: lines }).map((_, index) => (
        <View key={index} style={styles.writingGuide} />
      ))}
    </View>
  );
}

function CoverPage({
  childFirstName,
  dedicationText,
}: {
  childFirstName: string | null;
  dedicationText: string | null;
}) {
  const childLabel = childFirstName ? `${childFirstName}'s` : "Your";

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <Text style={styles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={styles.coverTitle}>Keepsake Companion</Text>
      <Text style={styles.coverQuote}>
        A small printable companion for the things you do not want to lose later: what this age felt
        like, why this book was made, and the little details that are easy to forget once everyone grows.
      </Text>
      <Text style={styles.lede}>
        Made to sit beside {childLabel} book so the finished pages feel more like a family keepsake and less
        like a file you printed once.
      </Text>

      {dedicationText?.trim() ? (
        <View style={styles.quoteBox}>
          <Text style={styles.quoteTitle}>Dedication from the book</Text>
          <Text style={styles.quoteText}>{dedicationText.trim()}</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Inside this companion</Text>
        <BulletList items={insideItems} />
      </View>

      <Footer label="Keepsake Companion - 1 of 9" />
    </Page>
  );
}

function RightNowPage({ childFirstName }: { childFirstName: string | null }) {
  const title = childFirstName ? `About ${childFirstName} right now` : "About this age right now";

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title={title}
        lede="This is the page for the details that never make it into milestones. The little things are usually the ones people miss most later."
      />

      {rightNowPrompts.map((prompt) => (
        <View key={prompt} style={styles.fillRow}>
          <Text style={styles.fillLabel}>{prompt}</Text>
          <View style={styles.fillLine} />
        </View>
      ))}

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>What belongs here</Text>
        <Text style={styles.noteText}>
          Think ordinary and specific. The made-up phrase. The favorite snack. The TV character. The way they mispronounce one word.
        </Text>
      </View>

      <Footer label="Keepsake Companion - 2 of 9" />
    </Page>
  );
}

function StoryBehindBookPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="The story behind this book"
        lede="This page turns the book from a nice idea into a piece of family history. Write down why it existed in the first place."
      />

      <RenderPromptPairs items={storyPrompts} />

      <View style={styles.widePrompt}>
        <Text style={styles.widePromptLabel}>A few lines about this season of life</Text>
        <WritingBox lines={5} />
      </View>

      <Footer label="Keepsake Companion - 3 of 9" />
    </Page>
  );
}

function ColoringQuestionsPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Questions to ask while you color"
        lede="You do not need perfect scrapbooking energy. One good question while the crayons are out is enough to save the part that matters."
      />

      <RenderPromptPairs items={coloringQuestions} />

      <View style={styles.quoteBox}>
        <Text style={styles.quoteTitle}>Use this rule</Text>
        <Text style={styles.quoteText}>
          Ask the smallest question that opens the biggest memory. Tiny prompts usually bring out the best answers.
        </Text>
      </View>

      <Footer label="Keepsake Companion - 4 of 9" />
    </Page>
  );
}

function LoveListsPage() {
  const leftItems = loveLists.slice(0, 3);
  const rightItems = loveLists.slice(3);

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Favorites, people, and little truths"
        lede="This is the quick snapshot page. Not polished. Just true."
      />

      <View style={styles.twoCol}>
        <View style={styles.col}>
          {leftItems.map((label) => (
            <View key={label} style={styles.miniBox}>
              <Text style={styles.miniLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.col}>
          {rightItems.map((label) => (
            <View key={label} style={styles.miniBox}>
              <Text style={styles.miniLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Footer label="Keepsake Companion - 5 of 9" />
    </Page>
  );
}

function ParentNotePage({
  childFirstName,
  customerFirstName,
}: {
  childFirstName: string | null;
  customerFirstName: string | null;
}) {
  const noteTo = childFirstName ? `A note to ${childFirstName}` : "A note to future you";
  const from = customerFirstName?.trim() ? `Signed, ${customerFirstName.trim()}` : "Signed, Mom or Dad";

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title={noteTo}
        lede="Write the part you hope nobody forgets. This does not need to be formal. It just needs to sound like you."
      />

      <View style={styles.widePrompt}>
        <Text style={styles.widePromptLabel}>What I love about you right now</Text>
        <WritingBox lines={5} />
      </View>

      <View style={styles.widePrompt}>
        <Text style={styles.widePromptLabel}>What this season feels like from my side</Text>
        <WritingBox lines={5} />
      </View>

      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>{from}</Text>
        <View style={styles.fillLine} />
      </View>

      <Footer label="Keepsake Companion - 6 of 9" />
    </Page>
  );
}

function LovedOneNotePage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="A note from someone who loves this child"
        lede="Grandparent, aunt, uncle, close friend, older sibling, babysitter, or future you. Leave one page for another voice."
      />

      <View style={styles.widePrompt}>
        <Text style={styles.widePromptLabel}>Your note</Text>
        <WritingBox lines={9} />
      </View>

      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>From</Text>
        <View style={styles.fillLine} />
      </View>
      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>Date</Text>
        <View style={styles.fillLine} />
      </View>

      <Footer label="Keepsake Companion - 7 of 9" />
    </Page>
  );
}

function FavoritePagesPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Pages worth remembering"
        lede="Mark the pages that mattered most so the book is easier to revisit later."
      />

      {[1, 2, 3].map((slot) => (
        <View key={slot} style={styles.panel}>
          <View style={styles.pageNumberBadge}>
            <Text style={styles.pageNumberText}>{slot}</Text>
          </View>
          {favoritePagePrompts.map((label) => (
            <View key={`${slot}-${label}`} style={styles.fillRow}>
              <Text style={styles.fillLabel}>{label}</Text>
              <View style={styles.fillLine} />
            </View>
          ))}
        </View>
      ))}

      <Footer label="Keepsake Companion - 8 of 9" />
    </Page>
  );
}

function FinishPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="The day we finished this book"
        lede="End it on purpose. A finish page makes the book feel completed, kept, and easier to come back to later."
      />

      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>We finished this book on</Text>
        <View style={styles.fillLine} />
      </View>
      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>We were at</Text>
        <View style={styles.fillLine} />
      </View>
      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>The page we loved most was</Text>
        <View style={styles.fillLine} />
      </View>
      <View style={styles.fillRow}>
        <Text style={styles.fillLabel}>We want to keep this book in</Text>
        <View style={styles.fillLine} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Open this again when...</Text>
        <BulletList items={openAgainPrompts} />
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>One last little rule</Text>
        <Text style={styles.noteText}>
          The point is not to fill every line perfectly. The point is to keep enough detail that this age still feels alive later.
        </Text>
      </View>

      <Footer label="Keepsake Companion - 9 of 9" />
    </Page>
  );
}

export async function renderKeepsakeCompanionPdf(input: KeepsakeCompanionInput = {}): Promise<Buffer> {
  const childFirstName = input.childFirstName?.trim() ? input.childFirstName.trim() : null;
  const customerFirstName = input.customerFirstName?.trim() ? input.customerFirstName.trim() : null;
  const dedicationText = input.dedicationText?.trim() ? input.dedicationText.trim() : null;

  const doc = (
    <Document>
      <CoverPage childFirstName={childFirstName} dedicationText={dedicationText} />
      <RightNowPage childFirstName={childFirstName} />
      <StoryBehindBookPage />
      <ColoringQuestionsPage />
      <LoveListsPage />
      <ParentNotePage childFirstName={childFirstName} customerFirstName={customerFirstName} />
      <LovedOneNotePage />
      <FavoritePagesPage />
      <FinishPage />
    </Document>
  );

  return renderToBuffer(doc);
}
