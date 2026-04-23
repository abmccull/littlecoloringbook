// ---------------------------------------------------------------------------
// renderQuietTimePackPdf - the "Quiet-Time Pack" bonus PDF.
//
// A parent-useful screen-free activity pack built around the customer's book:
//   1. A choose-tonight menu based on time, mood, and setting.
//   2. Short reset activities and longer rainy-afternoon activities.
//   3. Restaurant, waiting-room, sibling, and grandparent modes.
//   4. Story prompts and challenge cards that help the book last longer.
//
// The PDF is lightly personalized with the child's first name when available.
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

export type QuietTimePackInput = {
  childFirstName?: string | null;
};

export type PartyKitInput = QuietTimePackInput;

type ActivityCard = {
  title: string;
  body: string;
};

const coverInside = [
  "A quick menu for choosing the right activity tonight.",
  "Low-prep 10-minute resets when energy is thin.",
  "Longer rainy-day ideas when you need more runway.",
  "Restaurant, waiting-room, sibling, and grandparent versions.",
  "Story prompts and cut-out challenge cards that make the book last.",
];

const menuCards: ActivityCard[] = [
  {
    title: "10-minute reset",
    body: "For the stretch before dinner, while you finish a task, or when you need the house to come down a notch fast.",
  },
  {
    title: "Rainy-afternoon stretch",
    body: "For when you want the book to carry 25 to 40 good minutes instead of one quick page.",
  },
  {
    title: "Restaurant rescue",
    body: "For a booth, cafe, or waiting room when you need something that feels calm and special, not improvised.",
  },
  {
    title: "Sibling share",
    body: "For when one book needs to work for two kids without turning into a tug-of-war.",
  },
  {
    title: "Grandparent mode",
    body: "For when someone else is leading and you want simple prompts that still feel connected and sweet.",
  },
  {
    title: "Wind-down mode",
    body: "For post-bath, pre-bed, or any moment where you want quiet hands and softer energy.",
  },
];

const quickResetActivities: ActivityCard[] = [
  {
    title: "Color and tell",
    body: "Pick one page and ask: what happened right before this moment? One tiny question makes one page last longer.",
  },
  {
    title: "Three-color challenge",
    body: "Choose only three crayons for the whole page. Limits make kids stay with one page longer instead of rushing ahead.",
  },
  {
    title: "Parent corner",
    body: "You color one tiny corner while they color the rest. Kids stick longer when you join for even one minute.",
  },
  {
    title: "Soundtrack mode",
    body: "Add sound effects while they color. Barking dog, race-car noises, rain sounds, dragon breath, birthday cheering.",
  },
  {
    title: "Find the funniest page",
    body: "Ask them to pick the silliest page in the book and explain why. Then color only that page tonight.",
  },
  {
    title: "Save one for later",
    body: "End before the book is empty. Put one page aside for tomorrow so the book keeps its pull.",
  },
];

const longerPlayActivities: ActivityCard[] = [
  {
    title: "Gallery night",
    body: "Color three pages, tape them to the wall, and do a tiny family gallery walk with each kid explaining one favorite part.",
  },
  {
    title: "Director's cut",
    body: "Choose four pages and arrange them like scenes in a movie: opening, problem, funny moment, ending.",
  },
  {
    title: "Comic dub",
    body: "After coloring, add speech bubbles on sticky notes or scrap paper and give everyone a line of dialogue.",
  },
  {
    title: "Grandma mail",
    body: "Color one page with the plan to mail it or hand it off. A destination makes the page feel more important.",
  },
  {
    title: "Museum table",
    body: "Set out crayons, stickers, tape, and two finished pages. Let the book become a little art station for half an hour.",
  },
  {
    title: "Quiet-time loop",
    body: "Rotate through one page, one snack break, one story question, and one second page. The change of pace keeps it going.",
  },
];

const outAndAboutActivities: ActivityCard[] = [
  {
    title: "Booth trailer",
    body: "At a restaurant, pick one page and whisper a movie trailer for it while they color. It feels fun without getting loud.",
  },
  {
    title: "Menu match",
    body: "Pick three colors from the menu art or table signs and use only those on the page.",
  },
  {
    title: "Waiting-room caption game",
    body: "Each person adds one sentence about what the page is secretly about. No props required.",
  },
  {
    title: "Travel folder rule",
    body: "Bring only two pages and a tiny crayon set. Fewer options travel better and keep the activity feeling fresh.",
  },
];

const familyModes: ActivityCard[] = [
  {
    title: "Pass-the-page",
    body: "One kid starts, the other adds details, and then they tell the story together. It keeps siblings moving instead of competing.",
  },
  {
    title: "Grandparent interview",
    body: "While coloring, ask: what did you do after school when you were little? The page becomes a conversation starter.",
  },
  {
    title: "Cousin challenge",
    body: "Each cousin picks the page that feels most like the other person. Then explain the pick before coloring.",
  },
  {
    title: "Bedtime recap",
    body: "Choose one page that feels most like today. Color a small part and say why before lights out.",
  },
];

const storyPrompts: ActivityCard[] = [
  {
    title: "Before this",
    body: "What happened five minutes before the page? That one question creates instant story energy.",
  },
  {
    title: "After this",
    body: "What happened right after? Who ran off, who laughed, who got messy, who won?",
  },
  {
    title: "Freeze frame",
    body: "Pretend the page is paused in the middle of a movie. What line would the narrator say right now?",
  },
  {
    title: "Secret mission",
    body: "What hidden job is happening in this scene? Cookie delivery, puppy rescue, backyard treasure hunt, bedtime patrol.",
  },
  {
    title: "Speech bubble",
    body: "Give the page one line of dialogue. Funny lines count more than perfect ones.",
  },
  {
    title: "Movie poster",
    body: "If this page were the poster, what would the movie be called? Big titles make kids feel like the page matters.",
  },
];

const challengeCards: ActivityCard[] = [
  {
    title: "Three colors only",
    body: "Pick three crayons and stick with them.",
  },
  {
    title: "Whisper story",
    body: "Tell the whole story in a whisper while you color.",
  },
  {
    title: "Sound effects only",
    body: "No words. Only noises from the scene.",
  },
  {
    title: "Freeze-frame pick",
    body: "Choose the page that feels most mid-action.",
  },
  {
    title: "Grandma mail",
    body: "Color one page for somebody else.",
  },
  {
    title: "Trade and finish",
    body: "Start a page, then swap halfway through.",
  },
  {
    title: "Gallery wall",
    body: "Tape up one finished page tonight.",
  },
  {
    title: "Quiet table hero",
    body: "Pick the page that feels calmest right now.",
  },
];

const weekPlan = [
  "Monday: one 10-minute reset page before dinner.",
  "Tuesday: one page plus a before-this / after-this story.",
  "Wednesday: pack two pages for the car, cafe, or a waiting room.",
  "Thursday: sibling share or pass-the-page night.",
  "Friday: gallery wall with two finished pages.",
  "Saturday: grandma mail or grandparent interview page.",
  "Sunday: save five fresh pages for next week so the book still feels new.",
];

const makeItLastRules = [
  "Hand over one or two pages at a time, not the whole book.",
  "Keep five pages hidden for rainy days, travel, or hard afternoons.",
  "Store crayons and the pack together so setup takes less than a minute.",
  "Display finished pages where they will be noticed.",
  "Reuse the same story prompts on new pages instead of inventing new games every time.",
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
  challengeCard: {
    width: "48%",
    minHeight: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.paper,
    padding: 12,
  },
  challengeCutLine: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    borderStyle: "dashed",
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

function RenderPairs({ items }: { items: ActivityCard[] }) {
  const rows: ActivityCard[][] = [];
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

function CoverPage({ childFirstName }: { childFirstName: string | null }) {
  const personalizedLine = childFirstName
    ? `Built to help ${childFirstName}'s book become a full week of easy screen-free wins.`
    : "Built to help one book turn into a full week of easy screen-free wins.";

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <Text style={styles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={styles.coverTitle}>Quiet-Time Pack</Text>
      <Text style={styles.coverQuote}>
        One book. More calm. More connection. More things to do with the pages than just handing over
        crayons and hoping for the best.
      </Text>
      <Text style={styles.lede}>{personalizedLine}</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Inside this pack</Text>
        <BulletList items={coverInside} />
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>The point of this pack</Text>
        <Text style={styles.noteText}>
          You do not need more prep. You need better prompts. The right prompt turns one coloring page into
          ten calmer minutes, a family joke, or a memory someone actually keeps.
        </Text>
      </View>

      <Footer label="Quiet-Time Pack - 1 of 8" />
    </Page>
  );
}

function MenuPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Pick tonight's mode"
        lede="Choose the version that matches your energy, your time, and the setting. The book works differently depending on what the night actually needs."
      />

      <RenderPairs items={menuCards} />

      <View style={styles.quoteBox}>
        <Text style={styles.quoteTitle}>The easiest setup</Text>
        <Text style={styles.quoteText}>
          One or two pages, a few crayons, and one prompt is enough. Smaller setup usually gets better follow-through.
        </Text>
      </View>

      <Footer label="Quiet-Time Pack - 2 of 8" />
    </Page>
  );
}

function QuickResetPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Six 10-minute resets"
        lede="These are for the real-life middle stretches: while you make dinner, before bath, after a hard moment, or when you need a quieter turn without reaching for a screen."
      />

      <RenderPairs items={quickResetActivities} />

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>When energy is low</Text>
        <Text style={styles.noteText}>
          Do not offer the whole book. Offer one page and one prompt. More choice sounds generous, but it usually burns time and attention.
        </Text>
      </View>

      <Footer label="Quiet-Time Pack - 3 of 8" />
    </Page>
  );
}

function LongerPlayPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Rainy-afternoon and longer-stretch ideas"
        lede="When you want the book to carry real time, add one layer of story, display, or destination. That is what turns coloring into an activity instead of a filler."
      />

      <RenderPairs items={longerPlayActivities} />

      <Footer label="Quiet-Time Pack - 4 of 8" />
    </Page>
  );
}

function OutAndAboutPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Restaurant, waiting-room, and travel modes"
        lede="These versions keep the activity feeling special outside the house. The goal is low noise, low clutter, and something that still feels personal."
      />

      <RenderPairs items={outAndAboutActivities} />

      <View style={styles.quoteBox}>
        <Text style={styles.quoteTitle}>Travel rule</Text>
        <Text style={styles.quoteText}>
          Pack fewer pages than you think you need. Two fresh pages and a tiny crayon set usually travel better than a full stack.
        </Text>
      </View>

      <Footer label="Quiet-Time Pack - 5 of 8" />
    </Page>
  );
}

function FamilyModesPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Sibling, cousin, and grandparent modes"
        lede="A book gets more valuable when it works for more than one person. These prompts make the same pages feel shared instead of competitive."
      />

      <RenderPairs items={familyModes} />

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>Best move for siblings</Text>
        <Text style={styles.noteText}>
          Give each kid a role instead of the same role. One colors first. One tells the story. Then swap. Shared jobs reduce friction fast.
        </Text>
      </View>

      <Footer label="Quiet-Time Pack - 6 of 8" />
    </Page>
  );
}

function StoryPromptsPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Six prompts that make every page last longer"
        lede="If you want the book to feel richer without adding supplies, use a better prompt. These work on almost any page, any age, and any energy level."
      />

      <RenderPairs items={storyPrompts} />

      <Footer label="Quiet-Time Pack - 7 of 8" />
    </Page>
  );
}

function ChallengeCardsPage() {
  const rows: ActivityCard[][] = [];
  for (let index = 0; index < challengeCards.length; index += 2) {
    rows.push(challengeCards.slice(index, index + 2));
  }

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Cut-out challenge cards"
        lede="Use these when the book needs a little novelty. Cut them apart or just point to one and let the card choose the activity."
      />

      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.cardGridRow}>
          {row.map((card) => (
            <View key={card.title} style={styles.challengeCard}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.body}</Text>
              <View style={styles.challengeCutLine} />
            </View>
          ))}
          {row.length === 1 ? <View style={{ width: "48%" }} /> : null}
        </View>
      ))}

      <Footer label="Quiet-Time Pack - 8 of 9" />
    </Page>
  );
}

function MakeItLastPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Make the book last all week"
        lede="The easiest way to increase value is not buying more stuff. It is getting more good uses out of the same book with less effort each time."
      />

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={styles.sectionHeading}>A simple week plan</Text>
          <BulletList items={weekPlan} />
        </View>
        <View style={styles.col}>
          <Text style={styles.sectionHeading}>Keep the book feeling fresh</Text>
          <BulletList items={makeItLastRules} />
        </View>
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>The real win</Text>
        <Text style={styles.noteText}>
          The book becomes more valuable every time it solves a real family moment: a calmer dinner stretch,
          a quieter restaurant, a grandparent visit, a rainy afternoon, or one bedtime that went better than expected.
        </Text>
      </View>

      <Footer label="Quiet-Time Pack - 9 of 9" />
    </Page>
  );
}

export async function renderQuietTimePackPdf(input: QuietTimePackInput = {}): Promise<Buffer> {
  const trimmedName = input.childFirstName?.trim();
  const childFirstName = trimmedName && trimmedName.length > 0 ? trimmedName : null;

  const doc = (
    <Document>
      <CoverPage childFirstName={childFirstName} />
      <MenuPage />
      <QuickResetPage />
      <LongerPlayPage />
      <OutAndAboutPage />
      <FamilyModesPage />
      <StoryPromptsPage />
      <ChallengeCardsPage />
      <MakeItLastPage />
    </Document>
  );

  return renderToBuffer(doc);
}

export const renderPartyKitPdf = renderQuietTimePackPdf;
