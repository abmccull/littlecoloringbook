import type { OfferCode } from "@littlecolorbook/shared";

export type BadgeTone = "sun" | "coral" | "mint" | "sky";

export type ConsumerOffer = {
  code: OfferCode;
  title: string;
  badge?: string;
  badgeTone?: BadgeTone;
  designs: number;
  pdfPrice?: number;
  printPrice?: number;
  description: string;
  ctaLabel: string;
  comparisonNote?: string;
  featured?: boolean;
};

export type FunnelCta = {
  label: string;
  href: string;
  eventName: string;
};

export type PhotoExample = {
  src: string;
  alt: string;
  label: string;
  tip: string;
};

export type ParentQuote = {
  quote: string;
  name: string;
  context: string;
};

export type UseCaseCard = {
  title: string;
  description: string;
  tone: BadgeTone;
};

export type GuaranteeCard = {
  title: string;
  detail: string;
};

export type HeroCallout = {
  badge: string;
  title: string;
  detail: string;
  tone: BadgeTone;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type GalleryExample = {
  photoSrc: string;
  pageSrc: string;
  photoAlt: string;
  pageAlt: string;
  caption: string;
};

export const galleryExamples: GalleryExample[] = [
  {
    photoSrc: "/proof/real-family-play-photo.jpeg",
    pageSrc: "/proof/real-family-play-coloring-page.jpeg",
    photoAlt: "Family playing together outdoors",
    pageAlt: "Coloring page version of family playing outdoors",
    caption: "A real family moment turned into bold, colorable lines",
  },
  {
    photoSrc: "/proof/real-sword-play-photo.jpeg",
    pageSrc: "/proof/real-sword-play-coloring-page.jpeg",
    photoAlt: "Child playing with a toy sword",
    pageAlt: "Coloring page version of child with toy sword",
    caption: "An everyday adventure ready for crayons",
  },
  {
    photoSrc: "/proof/kid-photo.jpg",
    pageSrc: "/proof/kid-page-edges.png",
    photoAlt: "Close-up portrait of a child",
    pageAlt: "Coloring page version of child portrait",
    caption: "Familiar faces make kids want to color every page",
  },
  {
    photoSrc: "/proof/family-photo.jpg",
    pageSrc: "/proof/family-page.png",
    photoAlt: "Family photo with parents and child",
    pageAlt: "Coloring page version of family photo",
    caption: "One strong family moment, ready to color tonight",
  },
  {
    photoSrc: "/proof/pet-photo.jpg",
    pageSrc: "/proof/pet-page-edges.png",
    photoAlt: "Golden retriever portrait",
    pageAlt: "Coloring page version of golden retriever",
    caption: "Pets become instant favorites in any coloring book",
  },
];

export const proofAssets = {
  familyPhoto: "/proof/family-photo.jpg",
  kidPhoto: "/proof/kid-photo.jpg",
  kidPage: "/proof/kid-page-edges.png",
  petPhoto: "/proof/pet-photo.jpg",
  petPage: "/proof/pet-page-edges.png",
  realFamilyPlayPhoto: "/proof/real-family-play-photo.jpeg",
  realFamilyPlayPage: "/proof/real-family-play-coloring-page.jpeg",
  realSwordPlayPhoto: "/proof/real-sword-play-photo.jpeg",
  realSwordPlayPage: "/proof/real-sword-play-coloring-page.jpeg",
  spiralBookClosedFamily: "/proof/spiral-book-closed-family.png",
  spiralBookClosedSword: "/proof/spiral-book-closed-sword.png",
  // Compliance-passed Gemini hero used on the builder page proof block.
  geminiFamilyPage: "/proof/gemini-family-hero.png",
} as const;

export const funnelCtas = {
  freeSample: {
    label: "See My Free Coloring Page",
    href: "/sample?source=homepage-sample&acquisitionPath=sample_first",
    eventName: "home_sample_cta_clicked",
  },
  seeBookSizes: {
    label: "See Book Sizes",
    href: "#book-sizes",
    eventName: "home_book_sizes_clicked",
  },
  startThirtyPdf: {
    label: "Build My Family Memory Book",
    href: "/create?offer=pdf-50&source=sample-ready-primary&acquisitionPath=sample_first",
    eventName: "sample_ready_primary_offer_clicked",
  },
  addThirtyPrint: {
    label: "Get The Spiral Book Version",
    href: "/create?offer=print-100&source=sample-ready-print&acquisitionPath=sample_first",
    eventName: "sample_ready_print_upsell_clicked",
  },
} satisfies Record<string, FunnelCta>;

export const consumerOffers: ConsumerOffer[] = [
  {
    code: "pdf-30",
    title: "The Starter Book",
    badge: "First book",
    badgeTone: "sky",
    designs: 30,
    pdfPrice: 29,
    printPrice: 49,
    description: "30 favorite photos. The fastest way to have the book in their hands tonight.",
    ctaLabel: "Start with The Starter Book",
    comparisonNote: "Pick this when you want the first book without overthinking which photos.",
  },
  {
    code: "pdf-50",
    title: "The Family Memory Book",
    badge: "Most families pick this",
    badgeTone: "mint",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    description: "50 pages. Enough room for birthdays, pets, siblings, and every moment worth coloring.",
    ctaLabel: "Build My Family Memory Book",
    comparisonNote: "Pick this when you have more than a handful of favorites but don't need all 100.",
    featured: true,
  },
  {
    code: "pdf-100",
    title: "The Complete Keepsake Collection",
    badge: "Best value",
    badgeTone: "coral",
    designs: 100,
    pdfPrice: 59,
    printPrice: 99,
    description: "100 pages. Every birthday, every pet, every silly moment in one book.",
    ctaLabel: "Get The Complete Collection",
    comparisonNote: "Pick this for the lowest cost per page and room for the whole family story.",
  },
];

export const homepageContent = {
  hero: {
    badge: "Free sample in 30 seconds",
    title: "Turn favorite phone photos into a screen-free activity kids actually want to do.",
    description:
      "Upload one favorite photo. Watch it become a coloring page in about 30 seconds. If your kid lights up, turn the rest of your camera roll into the full book.",
    supporting:
      "They recognize every face on every page. That's why they actually want to color it. No craft project, no perfect-photo hunt, no assembly required.",
    callouts: [
      {
        badge: "Try it first",
        title: "30 seconds to your first page",
        detail: "Upload one photo and watch it become a coloring page. Free, no card, no commitment.",
        tone: "sun",
      },
      {
        badge: "Made from your photos",
        title: "They recognize themselves. That's the magic.",
        detail: "Familiar faces, pets, and moments they know are what make kids actually want to color.",
        tone: "sky",
      },
      {
        badge: "What parents say",
        title: "\"He kept saying 'that's ME!' on every page.\"",
        detail: "That reaction is the whole reason parents build the full book. One upload gets you there.",
        tone: "coral",
      },
    ] satisfies HeroCallout[],
  },
  proofStripTitle: "See how one favorite photo becomes a page they'll actually color.",
  proofStripCopy:
    "Start with a photo they already love. End with bold, clean lines they can't wait to fill in. No design skills, no template picking, no project.",
  featuredOfferIntro:
    "30 pages for a clean first book. 50 pages for every birthday, pet, and sibling. 100 pages when your camera roll is too full to choose.",
  sampleBlock: {
    title: "See your own photo first. Free.",
    description: "One photo, one free coloring page, about 30 seconds. If they love it, the rest of your camera roll is next.",
  },
};

export const useCaseCards: UseCaseCard[] = [
  {
    title: "Quiet time that feels like a win",
    description: "A screen-free activity for afternoons when you need something low-prep that still feels thoughtful.",
    tone: "sun",
  },
  {
    title: "A birthday gift that feels thoughtful",
    description: "More personal than a generic gift, without turning you into the party craft department.",
    tone: "coral",
  },
  {
    title: "A keepsake grandparents actually keep",
    description: "Favorite family photos turned into something kids color now and grandparents save for years.",
    tone: "mint",
  },
];

// Real customer testimonials collected 2026-04-21. `parentQuotes` is the
// curated homepage/sample-ready set (6 strongest, each covering a
// distinct angle: screen-free, differentiation, face-lit-up, objection
// handler for older kids, sibling bundle, travel use-case). The full
// set lives in `parentQuotesArchive` for rotation into ads, email, and
// landing-page variants.
export const parentQuotes: ParentQuote[] = [
  {
    quote: "This has become our go-to quiet activity after preschool. Liam loves seeing pages that feel made just for him, and I love that it keeps him focused without a screen.",
    name: "Maya R.",
    context: "mom of Liam, 4",
  },
  {
    quote: "Emma usually rushes through coloring books, but this one actually held her attention. She kept pointing out little details and asking to color 'just one more page.'",
    name: "Daniel P.",
    context: "dad of Emma, 6",
  },
  {
    quote: "Ava's face lit up when she saw her coloring book. The pages are cute, easy for little hands, and give us a nice activity to do together before bedtime.",
    name: "Chris L.",
    context: "dad of Ava, 3",
  },
  {
    quote: "Mason is very picky about art activities, but he loved this. He said the pages felt 'cool, not babyish,' which is high praise from a seven-year-old.",
    name: "Jenna K.",
    context: "mom of Mason, 7",
  },
  {
    quote: "I got one for each of my kids, and they both loved it for different reasons. Ben liked the easy pages, and Ellie got really creative with the details.",
    name: "Lauren D.",
    context: "mom of Ben, 5 and Ellie, 7",
  },
  {
    quote: "We brought Little Color Book on a road trip and it saved us. Ethan stayed busy in the car, and the pages were fun enough that he came back to them later at the hotel.",
    name: "Marcus B.",
    context: "dad of Ethan, 5",
  },
];

// Additional real testimonials, held for rotation into ads, email
// sequences, landing-page variants, and A/B tests. Same shape as
// parentQuotes — safe to inline anywhere a ParentQuote is expected.
export const parentQuotesArchive: ParentQuote[] = [
  {
    quote: "The designs are simple enough for Noah to enjoy but still creative enough that he doesn't get bored. It's been perfect for rainy afternoons and restaurant waits.",
    name: "Sophie M.",
    context: "mom of Noah, 5",
  },
  {
    quote: "I bought this as a small surprise, and Olivia has been carrying it around the house all week. It's sweet, calming, and such a nice break from tablets.",
    name: "Rachel T.",
    context: "mom of Olivia, 4",
  },
  {
    quote: "Harper loves anything creative, and this coloring book felt special right away. The artwork is adorable, and it gave her a confidence boost because she could finish each page on her own.",
    name: "Alyssa G.",
    context: "mom of Harper, 6",
  },
  {
    quote: "Jack is still learning to color inside the lines, and these pages are great for him. They're playful without being too complicated, which keeps him from getting frustrated.",
    name: "Nina C.",
    context: "mom of Jack, 3",
  },
  {
    quote: "Mia said this was one of her favorite coloring books because the pictures felt different from the ones she already has. She spent almost an hour coloring quietly, which never happens.",
    name: "Kevin S.",
    context: "dad of Mia, 8",
  },
  {
    quote: "This has been such a sweet activity for us after dinner. Arjun picks a page, tells me what colors he wants to use, and we sit together without any distractions.",
    name: "Priya N.",
    context: "mom of Arjun, 4",
  },
];

export const photoExamples: PhotoExample[] = [
  {
    src: proofAssets.kidPhoto,
    alt: "Demo portrait of a child holding a stuffed animal",
    label: "Close-up kid portrait",
    tip: "Faces and simple poses turn into clearer coloring pages.",
  },
  {
    src: proofAssets.familyPhoto,
    alt: "Demo family photo with parents holding a child in the sun",
    label: "One strong family moment",
    tip: "Pick a photo with one obvious memory, not a crowded background.",
  },
  {
    src: proofAssets.petPhoto,
    alt: "Demo golden retriever portrait",
    label: "Pets work beautifully too",
    tip: "Clear pet portraits are great for bonus pages and sibling add-ons.",
  },
];

export const guarantees: GuaranteeCard[] = [
  {
    title: "The Light-Up-Their-Face Guarantee",
    detail: "If your child doesn't love seeing themselves on the page, full refund. No questions, no hoops.",
  },
  {
    title: "The Perfect Page Promise",
    detail: "Any page that doesn't look right gets regenerated free until you love every single one.",
  },
  {
    title: "Keepsake Quality or Free Replacement",
    detail: "Your spiral book arrives print-shop perfect or we send a new one at our cost. Period.",
  },
];

export const faqs: FaqItem[] = [
  {
    question: "How many photos do I need for a full book?",
    answer: "Plan on one photo per page. Start with 30 if you want the smaller first version, move to 50 when the album is fuller, and choose 100 when your camera roll is packed and you want the best value.",
  },
  {
    question: "How fast is the free sample?",
    answer: "Your free page is ready in about 20–30 seconds. You'll see it on screen and get a copy in your inbox.",
  },
  {
    question: "How fast do I get the PDF version?",
    answer: "Most PDF books are ready in under 2 minutes. We generate all your pages at once so you're not waiting long.",
  },
  {
    question: "How long does the printed spiral book take?",
    answer: "Printed books take longer because they have to be made, bound, and shipped. Once the artwork is ready, you will see delivery timing at checkout based on the shipping option you pick.",
  },
  {
    question: "What is the difference between the PDF and the spiral book?",
    answer: "The PDF is your print-tonight option. The spiral book is the giftable version that arrives printed and bound.",
  },
  {
    question: "Does the printed book include the PDF too?",
    answer: "Yes. Every printed book also includes the PDF, so you still have the digital copy for quick reprints at home.",
  },
  {
    question: "What kinds of photos work best?",
    answer: "Tighter portraits, pets, siblings, birthdays, and one clear family moment work best. You do not need professional photos.",
  },
  {
    question: "Can I use phone photos?",
    answer: "Yes. Most parents use phone photos. Clear faces, simple backgrounds, and well-lit moments usually turn into the cleanest coloring pages.",
  },
  {
    question: "What if I have multiple kids?",
    answer: "You can mix siblings into one shared book, or make separate versions if you want each child to have their own. The printed-copy packs are useful for that too.",
  },
  {
    question: "Can I order extra copies for grandparents or gifts?",
    answer: "Yes. On the printed-book path you can add extra copies for grandparents, birthdays, or sibling gifts without rebuilding the book from scratch.",
  },
  {
    question: "Can each printed copy have a different name on the cover?",
    answer: "Yes. If you choose a multi-copy printed pack, you can keep the same cover name on every copy or personalize each one for different kids or recipients.",
  },
  {
    question: "What if I don't have enough photos for 50 or 100 pages?",
    answer: "Start with the 30-page book or the free sample. The best size is the one you can fill with real favorite photos instead of stretching to hit a bigger page count.",
  },
  {
    question: "Can I print the PDF more than once?",
    answer: "Yes. The PDF is meant for home printing, so you can print it again whenever you want another copy.",
  },
  {
    question: "Do I need an account before checkout?",
    answer: "No. The purchase flow stays guest-first so you can move from sample to checkout without extra setup.",
  },
];

export const founderStory = {
  title: "Why I built Little Color Book",
  eyebrow: "From the founder",
  signature: "Alec, founder and dad of 3",
  paragraphs: [
    "I'm a dad of three. And for the thousandth time, my kids were asking me to print coloring pages off Google.",
    "You know how this goes. Fifteen minutes of a six-year-old scrolling through dragon pages because this one's mouth is slightly cooler than that one's. Then the watermarks. The blown-up low-res. The pages that don't fit on the paper. The fifth tab open trying to find one that isn't paywalled.",
    "There had to be a better way.",
    "So I started messing with AI. I pulled photos off my phone. The kids. Our dog. My son holding a stick like it's Excalibur. Turned them into coloring pages. Real ones. Bold lines, clean backgrounds, no logos across the middle.",
    "My kids lost it.",
    "They stopped asking for Pokemon. They started staging scenes. They built whole comic books. Epic fight scenes. The stuffed animals cast as side characters. The cat pulled into the plot against her will. Suddenly they were the heroes of the story, not some stock dragon on page 47 of a search result. My six-year-old's decision paralysis disappeared the second he got to be the one on the page.",
    "And they colored. For hours. No screens. No negotiation.",
    "If that worked for my kitchen table, I figured it'd work for a lot of other parents too. That's why Little Color Book exists. To turn the photos already on your phone into the kind of coloring pages your kids actually want to finish. The ones where they're the main character.",
  ],
};

export const founderStoryShort = {
  title: "A quick note from the founder",
  eyebrow: "From the founder",
  signature: "Alec, dad of 3",
  paragraphs: [
    "I'm a dad of three. For the thousandth time, my kids were asking me to print coloring pages off Google. Fifteen minutes of a six-year-old scrolling, watermarks, pages that don't fit on the paper.",
    "There had to be a better way.",
    "I pulled photos off my phone, fed them to AI, and turned them into coloring pages. My kids lost it. They stopped asking for Pokemon and started staging their own scenes. Suddenly they were the heroes.",
    "Little Color Book is that, for you.",
  ],
};

export const urgencyMessages = {
  sampleExpiry: "Your preview is saved for 48 hours.",
  seasonalCover: "Mother's Day cover available through May 10.",
};

export const offerBonuses = [
  { name: "Quiet-Time Pack", value: 29, description: "Screen-free family pack with quick resets, rainy-day ideas, restaurant rescue prompts, and story games that make one book last longer" },
  { name: "Keepsake Companion", value: 19, description: "Printable companion for favorite pages, family notes, what this age feels like, and the little stories behind the book" },
  { name: "Camera Roll Playbook", value: 9, description: "Guide for pulling a stronger next book from your camera roll, with better photo picks and comic-book or movie-style theme ideas" },
];

export function getConsumerOffer(code: OfferCode) {
  return consumerOffers.find((offer) => offer.code === code) ?? consumerOffers.find((offer) => offer.code === "pdf-30")!;
}

export function getOfferHref(code: OfferCode) {
  return `/create?offer=${code}`;
}

export function getPrintOfferCodeFor(designs: number): OfferCode {
  if (designs >= 100) return "print-100";
  if (designs >= 50) return "print-50";
  return "print-30";
}

export function getPdfOfferCodeFor(designs: number): OfferCode {
  if (designs >= 100) return "pdf-100";
  if (designs >= 50) return "pdf-50";
  return "pdf-30";
}
