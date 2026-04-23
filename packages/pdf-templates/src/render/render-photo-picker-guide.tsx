// ---------------------------------------------------------------------------
// renderCameraRollPlaybookPdf - the "Camera Roll Playbook" bonus PDF.
//
// A multi-page parent guide focused on three jobs:
//   1. Pick better source photos faster.
//   2. Turn ordinary camera-roll moments into stronger book themes.
//   3. Help the next book feel more story-driven and more personal.
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
  line: "#e7d7c4",
  paleMint: "#ecfaf4",
  paleSky: "#eef6fc",
} as const;

export type CameraRollPlaybookInput = {
  childFirstName?: string | null;
};

type Step = {
  title: string;
  body: string;
};

type ThemeIdea = {
  title: string;
  body: string;
};

const coverInsideItems = [
  "A 20-minute photo-picking method that keeps you out of camera-roll spirals.",
  "A simple yes / maybe / skip filter for faster decisions.",
  "Clear rules for what turns into clean, strong line art.",
  "Comic-book and movie-style ways to build a more fun book.",
  "Theme ideas and a next-book shot list you can actually use.",
];

const pickSteps: Step[] = [
  {
    title: "Start broad, not perfect",
    body: "Pull from Favorites, Recents, search by person, pet, or place, and any hidden folder where the good family stuff tends to live. Do not edit yet.",
  },
  {
    title: "Make one fast first pass",
    body: "Keep anything with a clear face, a strong reaction, motion, tenderness, or a funny little moment. Trust energy first and overthinking second.",
  },
  {
    title: "Build the mix on purpose",
    body: "Add close-ups, action shots, sibling moments, pet pages, one or two quiet pages, and a few big memory pages so the book feels alive.",
  },
  {
    title: "Finish with one hero per page",
    body: "If a photo has two competing stars, a tiny face, or too much background noise, keep looking. The cleanest pages usually start with one obvious hero.",
  },
];

const yesItems = [
  "The face is clear enough to spot instantly.",
  "One child, pet, or pair clearly owns the frame.",
  "The emotion reads fast: laughing, concentrating, hugging, zooming, proud.",
  "The subject takes up enough of the photo to matter.",
  "The moment feels like something you would want to see again later.",
];

const maybeItems = [
  "The lighting is imperfect, but the expression is excellent.",
  "Two siblings share the frame and both faces still read clearly.",
  "The shot is a little wide, but the action is strong enough to tell a story.",
  "The background is busy, but the hero still pops immediately.",
];

const skipItems = [
  "Screenshots, collages, filtered photos, or photos with text already on them.",
  "Big group shots where faces end up tiny.",
  "Heavy shadow over the face or very dim indoor light.",
  "Back-of-head shots with no readable expression.",
  "Photos where the best part is happening too far away from the camera.",
];

const strongPhotoItems = [
  "A close-up laugh or grin that fills the frame.",
  "A kid and pet together, both easy to see.",
  "A birthday candle moment, first bite, or cake-face reaction.",
  "A couch cuddle, stroller nap, or just-woke-up look.",
  "Dress-up, backyard adventure, playground heroics, or scooter speed.",
  "A grandparent moment where both faces are visible and warm.",
];

const weakPhotoItems = [
  "A beautiful sunset with tiny people lost inside it.",
  "A dark restaurant shot where the face disappears.",
  "A family group photo where everyone matters equally.",
  "A cluttered room where toys and furniture beat the subject.",
  "A school portrait that is technically clean but emotionally flat.",
  "A moment that only works because you were there to explain it.",
];

const mixRows = [
  { count: "8", label: "personality pages", body: "Close-up faces, crooked grins, proud looks, sleepy looks, pet snuggles." },
  { count: "6", label: "action pages", body: "Running, jumping, scootering, dancing, climbing, splashing, zooming." },
  { count: "5", label: "relationship pages", body: "Siblings, cousins, grandparent moments, parent-and-kid hugs." },
  { count: "4", label: "pet or co-star pages", body: "Pets count as story fuel. They make books feel fun fast." },
  { count: "4", label: "big memory pages", body: "Birthdays, trips, holidays, firsts, costumes, traditions." },
  { count: "3", label: "quiet reset pages", body: "Blanket forts, couch time, reading, snack breaks, calm little moments." },
];

const comicBeats = [
  { title: "Meet the hero", body: "Start with the face that says who the star is." },
  { title: "Show the mission", body: "Scooter run, backyard quest, cookie bake, dog rescue, dance recital." },
  { title: "Drop in the chaos", body: "The dog steals the snack. The tower tips. The rain starts." },
  { title: "Bring in a helper", body: "Sibling, cousin, pet, parent, or grandparent enters the story." },
  { title: "Give us the reaction shot", body: "Laughing, shocked, proud, dramatic, exhausted, relieved." },
  { title: "End with the win", body: "Cozy couch, finished cupcake, muddy shoes, bedtime peace, happy chaos." },
];

const comicSources = [
  "Playground mission",
  "Dress-up rescue story",
  "Dog steals the spotlight",
  "Rainy-day fort build",
  "Birthday prep to cake moment",
  "Sibling chaos, then cuddle",
];

const movieShots = [
  { title: "Poster shot", body: "The one image that would sell the whole story in a single glance." },
  { title: "Opening wide shot", body: "Where are we? Backyard, grandma's house, beach, birthday table, front porch." },
  { title: "Action shot", body: "Running, jumping, reaching, spinning, blowing out candles, tossing the ball." },
  { title: "Close-up reaction", body: "Big grin, side-eye, concentration face, sleepy blink, post-chaos relief." },
  { title: "Quiet pause", body: "A reset moment makes the action pages hit harder." },
  { title: "Finale", body: "The muddy shoes, the blanket, the trophy grin, the last candle, the ride home." },
];

const trailerLines = [
  "In a world where bath time needed a hero...",
  "One small kid. One big dog. One very bad idea.",
  "This summer, the cousins return for one more backyard mission.",
];

const themeIdeas: ThemeIdea[] = [
  {
    title: "Birthday Week",
    body: "Decorations, helping in the kitchen, candles, wrapping paper, cake face, and the sleepy aftermath.",
  },
  {
    title: "Cousin Weekend",
    body: "Pile in the living room, snack table chaos, matching pajamas, backyard chase scenes, one big group laugh.",
  },
  {
    title: "The Dog Is the Co-Star",
    body: "Walking, cuddling, begging, zooming, stealing a toy, and finally crashing on the couch together.",
  },
  {
    title: "Summer at Grandma's",
    body: "Porch swings, garden time, card games, freezer pops, old chairs, and the one hug worth keeping forever.",
  },
  {
    title: "Tiny Everyday Wins",
    body: "Shoes on the right feet, helping bake, reading with a pet, blanket fort pride, and ordinary moments that age well.",
  },
  {
    title: "Vacation Highlights",
    body: "Arrival, one big location shot, meals, sand or snow, one meltdown-free miracle, and the tired ride home.",
  },
  {
    title: "One Kid Across the Seasons",
    body: "Same child, same personality, different weather, outfits, routines, and favorite little rituals through the year.",
  },
  {
    title: "Best Sibling Chaos",
    body: "Team-up, disagreement, dramatic reaction, shared joke, snack break, and the peace treaty hug at the end.",
  },
];

const shotList = [
  "One belly laugh you almost missed.",
  "One close-up with a pet.",
  "One grandparent moment with both faces clear.",
  "One action shot with real movement.",
  "One costume or imagination moment.",
  "One proud face after finishing something.",
  "One snack, cake, or kitchen helper moment.",
  "One quiet couch, bed, or blanket-fort page.",
  "One sibling or cousin team-up moment.",
  "One ordinary daily ritual you will miss later.",
  "One muddy, sandy, or messy page.",
  "One photo you almost deleted because it was imperfect but alive.",
];

const quickRules = [
  "One page, one hero.",
  "Clear face beats perfect outfit.",
  "Candid beats posed when the feeling is stronger.",
  "Close beats wide when you want better line art.",
  "Funny and tender both age better than generic smiles.",
  "If you have to explain the photo, it is probably not the strongest pick.",
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
    lineHeight: 1.1,
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
  coverPanel: {
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
    marginBottom: 14,
  },
  coverPanelTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 8,
  },
  kicker: {
    fontFamily: FONTS.script,
    fontSize: 20,
    color: COLORS.coral,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 8,
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
  stepCard: {
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    marginBottom: 10,
  },
  stepNumber: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.coral,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: COLORS.muted,
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
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    width: "48%",
  },
  filterPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    marginBottom: 10,
  },
  filterYes: {
    backgroundColor: COLORS.paleMint,
  },
  filterMaybe: {
    backgroundColor: COLORS.paleSky,
  },
  filterSkip: {
    backgroundColor: COLORS.cream,
  },
  filterTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 8,
  },
  mixRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  mixCount: {
    width: 40,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.coral,
  },
  mixBody: {
    flex: 1,
  },
  mixLabel: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 2,
  },
  mixText: {
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: COLORS.muted,
    lineHeight: 1.45,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  gridCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cream,
    padding: 12,
  },
  compactTitle: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 4,
  },
  compactText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.muted,
    lineHeight: 1.4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.paper,
    borderRadius: 999,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    fontFamily: FONTS.body,
    fontSize: 9.5,
    color: COLORS.ink,
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
  quoteLine: {
    fontFamily: FONTS.serif,
    fontSize: 12,
    color: COLORS.ink,
    lineHeight: 1.45,
    marginBottom: 5,
  },
  checkGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  checkCol: {
    width: "48%",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  checkMark: {
    width: 22,
    fontFamily: FONTS.body,
    fontSize: 10.5,
    color: COLORS.coral,
    paddingTop: 1,
  },
  ruleGrid: {
    marginTop: 8,
    padding: 14,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
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

function BulletList({
  items,
  bullet = "+",
}: {
  items: string[];
  bullet?: string;
}) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={`${bullet}-${index}`} style={styles.listRow}>
          <Text style={styles.bullet}>{bullet}</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function TitleBlock({
  title,
  lede,
}: {
  title: string;
  lede: string;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.lede}>{lede}</Text>
    </View>
  );
}

function CoverPage({ childFirstName }: { childFirstName: string | null }) {
  const personalizedLine = childFirstName
    ? `Built to help you pull better pages for ${childFirstName} from the photos already on your phone.`
    : "Built to help you pull better pages from the photos already on your phone.";

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <Text style={styles.eyebrow}>The Little Color Book bonus</Text>
      <Text style={styles.coverTitle}>Camera Roll Playbook</Text>
      <Text style={styles.coverQuote}>
        Better books start before the upload screen. This guide helps you spot the photos that become
        the strongest pages, the sweetest keepsakes, and the most fun story arcs.
      </Text>
      <Text style={styles.lede}>{personalizedLine}</Text>

      <View style={styles.coverPanel}>
        <Text style={styles.coverPanelTitle}>Inside this playbook</Text>
        <BulletList items={coverInsideItems} />
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>The shortcut to remember</Text>
        <Text style={styles.noteText}>
          You are not hunting for perfect photography. You are looking for one clear hero, one strong
          feeling, and one moment worth seeing again.
        </Text>
      </View>

      <Text style={styles.kicker}>Easy enough for tonight. Better again next time.</Text>
      <Footer label="Camera Roll Playbook - 1 of 9" />
    </Page>
  );
}

function PickMethodPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Pick 30 strong photos in 20 minutes"
        lede="This is the anti-overthinking version. Use one fast pass to find the energy, then shape the mix so the book feels full of life."
      />

      {pickSteps.map((step, index) => (
        <View key={step.title} style={styles.stepCard}>
          <Text style={styles.stepNumber}>Step {index + 1}</Text>
          <Text style={styles.cardTitle}>{step.title}</Text>
          <Text style={styles.cardBody}>{step.body}</Text>
        </View>
      ))}

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>Use this rule when you are stuck</Text>
        <Text style={styles.noteText}>
          If two photos are tied, pick the one with the clearer face or the stronger feeling. Cute beats
          technically perfect more often than parents think.
        </Text>
      </View>

      <Footer label="Camera Roll Playbook - 2 of 9" />
    </Page>
  );
}

function FilterPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Use the yes / maybe / skip filter"
        lede="You can make most photo decisions in five seconds. This filter keeps you moving and keeps weak pages out of the final mix."
      />

      <View style={[styles.filterPanel, styles.filterYes]}>
        <Text style={styles.filterTitle}>Yes - this is strong</Text>
        <BulletList items={yesItems} bullet="+" />
      </View>

      <View style={styles.twoCol}>
        <View style={[styles.filterPanel, styles.filterMaybe, styles.col]}>
          <Text style={styles.filterTitle}>Maybe - keep if you need variety</Text>
          <BulletList items={maybeItems} bullet="+" />
        </View>
        <View style={[styles.filterPanel, styles.filterSkip, styles.col]}>
          <Text style={styles.filterTitle}>Skip - this usually weakens the book</Text>
          <BulletList items={skipItems} bullet="+" />
        </View>
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>One page, one hero</Text>
        <Text style={styles.noteText}>
          The cleanest coloring pages usually come from photos where the viewer knows exactly who the page
          is about in the first second.
        </Text>
      </View>

      <Footer label="Camera Roll Playbook - 3 of 9" />
    </Page>
  );
}

function StrongVsWeakPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="What survives line art beautifully"
        lede="Some moments get stronger when they become a coloring page. Others lose the thing that made them special. Learn the difference and you waste less time."
      />

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={styles.sectionHeading}>These usually turn out great</Text>
          <BulletList items={strongPhotoItems} bullet="+" />
        </View>
        <View style={styles.col}>
          <Text style={styles.sectionHeading}>These usually lose too much</Text>
          <BulletList items={weakPhotoItems} bullet="+" />
        </View>
      </View>

      <View style={styles.quoteBox}>
        <Text style={styles.quoteTitle}>The real test</Text>
        <Text style={styles.quoteLine}>
          If the photo still makes sense when you squint, the page will usually hold together.
        </Text>
        <Text style={styles.quoteLine}>
          If the whole point disappears unless you zoom way in, it is probably not the one.
        </Text>
      </View>

      <Footer label="Camera Roll Playbook - 4 of 9" />
    </Page>
  );
}

function MixPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Build a 30-page book with a better mix"
        lede="The best books do not feel like thirty versions of the same smile. They feel like a real little world: movement, sweetness, pets, chaos, and a few quiet breaths."
      />

      <View>
        {mixRows.map((row) => (
          <View key={row.label} style={styles.mixRow}>
            <Text style={styles.mixCount}>{row.count}</Text>
            <View style={styles.mixBody}>
              <Text style={styles.mixLabel}>{row.label}</Text>
              <Text style={styles.mixText}>{row.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>When a book feels flat</Text>
        <Text style={styles.noteText}>
          It is usually because every photo is posed, every page is wide, or every moment has the same
          energy. Mix changes everything.
        </Text>
      </View>

      <Footer label="Camera Roll Playbook - 5 of 9" />
    </Page>
  );
}

function ComicModePage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Comic-book mode"
        lede="You do not need staged photos to make a book feel like a story. You only need a sequence with a hero, a little trouble, and a satisfying ending."
      />

      <View style={styles.gridRow}>
        {comicBeats.slice(0, 2).map((beat) => (
          <View key={beat.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{beat.title}</Text>
            <Text style={styles.compactText}>{beat.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {comicBeats.slice(2, 4).map((beat) => (
          <View key={beat.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{beat.title}</Text>
            <Text style={styles.compactText}>{beat.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {comicBeats.slice(4, 6).map((beat) => (
          <View key={beat.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{beat.title}</Text>
            <Text style={styles.compactText}>{beat.body}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Easy real-life story sources</Text>
      <View style={styles.chipWrap}>
        {comicSources.map((item) => (
          <View key={item} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>

      <Footer label="Camera Roll Playbook - 6 of 9" />
    </Page>
  );
}

function MovieModePage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Movie-night mode"
        lede="If comic mode gives you a playful arc, movie mode gives you pacing. Think trailer, not scrapbook: one poster shot, one action shot, one reaction shot, one finale."
      />

      <View style={styles.gridRow}>
        {movieShots.slice(0, 2).map((shot) => (
          <View key={shot.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{shot.title}</Text>
            <Text style={styles.compactText}>{shot.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {movieShots.slice(2, 4).map((shot) => (
          <View key={shot.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{shot.title}</Text>
            <Text style={styles.compactText}>{shot.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {movieShots.slice(4, 6).map((shot) => (
          <View key={shot.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{shot.title}</Text>
            <Text style={styles.compactText}>{shot.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.quoteBox}>
        <Text style={styles.quoteTitle}>Trailer starter lines</Text>
        {trailerLines.map((line) => (
          <Text key={line} style={styles.quoteLine}>
            {line}
          </Text>
        ))}
      </View>

      <Footer label="Camera Roll Playbook - 7 of 9" />
    </Page>
  );
}

function ThemeIdeasPage() {
  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Theme ideas hiding in one phone"
        lede="A better book often starts with one stronger frame. Not random favorites. A small theme. A tiny season. A specific family chapter."
      />

      <View style={styles.gridRow}>
        {themeIdeas.slice(0, 2).map((idea) => (
          <View key={idea.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{idea.title}</Text>
            <Text style={styles.compactText}>{idea.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {themeIdeas.slice(2, 4).map((idea) => (
          <View key={idea.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{idea.title}</Text>
            <Text style={styles.compactText}>{idea.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {themeIdeas.slice(4, 6).map((idea) => (
          <View key={idea.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{idea.title}</Text>
            <Text style={styles.compactText}>{idea.body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.gridRow}>
        {themeIdeas.slice(6, 8).map((idea) => (
          <View key={idea.title} style={styles.gridCard}>
            <Text style={styles.compactTitle}>{idea.title}</Text>
            <Text style={styles.compactText}>{idea.body}</Text>
          </View>
        ))}
      </View>

      <Footer label="Camera Roll Playbook - 8 of 9" />
    </Page>
  );
}

function ShotListPage() {
  const leftItems = shotList.slice(0, 6);
  const rightItems = shotList.slice(6);

  return (
    <Page size={{ width: LETTER_WIDTH_PT, height: LETTER_HEIGHT_PT }} style={styles.page}>
      <TitleBlock
        title="Your next-book shot list"
        lede="Keep this page near your camera roll. These are the kinds of moments parents are happiest they saved once the book is in their hands."
      />

      <View style={styles.checkGrid}>
        <View style={styles.checkCol}>
          {leftItems.map((item) => (
            <View key={item} style={styles.checkRow}>
              <Text style={styles.checkMark}>[ ]</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.checkCol}>
          {rightItems.map((item) => (
            <View key={item} style={styles.checkRow}>
              <Text style={styles.checkMark}>[ ]</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ruleGrid}>
        <Text style={styles.sectionHeading}>Six rules to remember</Text>
        <BulletList items={quickRules} bullet="+" />
      </View>

      <Footer label="Camera Roll Playbook - 9 of 9" />
    </Page>
  );
}

export async function renderCameraRollPlaybookPdf(input: CameraRollPlaybookInput = {}): Promise<Buffer> {
  const trimmedName = input.childFirstName?.trim();
  const childFirstName = trimmedName && trimmedName.length > 0 ? trimmedName : null;

  const doc = (
    <Document>
      <CoverPage childFirstName={childFirstName} />
      <PickMethodPage />
      <FilterPage />
      <StrongVsWeakPage />
      <MixPage />
      <ComicModePage />
      <MovieModePage />
      <ThemeIdeasPage />
      <ShotListPage />
    </Document>
  );

  return renderToBuffer(doc);
}

export const renderPhotoPickerGuidePdf = renderCameraRollPlaybookPdf;
