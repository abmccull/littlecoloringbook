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

export type FaqItem = {
  question: string;
  answer: string;
};

export const proofAssets = {
  exampleTransformation: "/proof/example-transformation.webp",
  familyPhoto: "/proof/family-photo.jpg",
  kidPhoto: "/proof/kid-photo.jpg",
  kidPage: "/proof/kid-page-edges.png",
  petPhoto: "/proof/pet-photo.jpg",
  petPage: "/proof/pet-page-edges.png",
} as const;

export const funnelCtas = {
  freeSample: {
    label: "Get My Free Sample Page",
    href: "/sample",
    eventName: "home_sample_cta_clicked",
  },
  seeThirtyPages: {
    label: "Build My Book",
    href: "/create?offer=pdf-100",
    eventName: "home_primary_offer_clicked",
  },
  startThirtyPdf: {
    label: "Build The 100-Page Book",
    href: "/create?offer=pdf-100",
    eventName: "sample_ready_primary_offer_clicked",
  },
  addThirtyPrint: {
    label: "Get The Spiral Book Version",
    href: "/create?offer=print-100",
    eventName: "sample_ready_print_upsell_clicked",
  },
  startMiniPdf: {
    label: "Keep It Light With 10 Pages",
    href: "/create?offer=pdf-10",
    eventName: "sample_ready_downsell_clicked",
  },
} satisfies Record<string, FunnelCta>;

export const consumerOffers: ConsumerOffer[] = [
  {
    code: "pdf-10",
    title: "10 Pages",
    badge: "Mini starter",
    badgeTone: "sky",
    designs: 10,
    pdfPrice: 14,
    description: "A tiny first version for one favorite memory, one pet, or a quick rainy-afternoon win.",
    ctaLabel: "Start with 10 pages",
    comparisonNote: "Best if you want to stay small after the free sample.",
  },
  {
    code: "pdf-30",
    title: "30 Pages",
    badge: "Good starter",
    badgeTone: "sky",
    designs: 30,
    pdfPrice: 29,
    printPrice: 49,
    description: "The easiest full-book starting point when you want a lighter first keepsake.",
    ctaLabel: "Choose 30 pages",
    comparisonNote: "Good when you want the smallest full-book option.",
  },
  {
    code: "pdf-50",
    title: "50 Pages",
    badge: "Better choice",
    badgeTone: "mint",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    description: "The sweet spot for fuller camera rolls, sibling stories, and gift-worthy books.",
    ctaLabel: "Choose 50 pages",
    comparisonNote: "Better when you want the book to feel fuller without going all the way up.",
  },
  {
    code: "pdf-100",
    title: "100 Pages",
    badge: "Best value",
    badgeTone: "coral",
    designs: 100,
    pdfPrice: 59,
    printPrice: 99,
    description: "The biggest, best-value version for packed camera rolls, family trips, birthdays, and gift copies.",
    ctaLabel: "Choose 100 pages",
    comparisonNote: "Best when you already know you want the fullest version.",
    featured: true,
  },
];

export const homepageContent = {
  hero: {
    badge: "The easiest screen-free win hiding in your camera roll",
    title: "Turn the favorite photos already on your phone into a coloring book they will want to use tonight.",
    description:
      "Start with one favorite photo for a free sample page. If it feels like a yes, turn the rest into a 30, 50, or 100-page book you can print at home or order as a spiral-bound keepsake.",
    supporting:
      "No design project. No perfect-photo hunt. Just familiar faces, pets, trips, and family moments turned into pages they can color now and you can save later.",
    trustPoints: ["Free sample first", "From your real family photos", "PDF tonight or spiral book shipped"],
  },
  proofStripTitle: "From favorite photo to coloring page to spiral book.",
  featuredOfferIntro:
    "30 gets you in. 50 feels fuller. 100 gives you the best value when your camera roll is already packed with favorites.",
  sampleBlock: {
    title: "See one page before you commit to the whole book.",
    description: "See one real page made from your own photo first. Then decide if you want to turn the rest into the full book.",
  },
};

export const useCaseCards: UseCaseCard[] = [
  {
    title: "Quiet time that feels like a win",
    description: "An easy personal activity for afternoons when you need something low-prep that still feels special.",
    tone: "sun",
  },
  {
    title: "A birthday gift that feels thoughtful",
    description: "More personal than a generic gift, without turning you into the party craft department.",
    tone: "coral",
  },
  {
    title: "A keepsake grandparents actually keep",
    description: "Turn favorite family photos into something that gets colored now and saved later.",
    tone: "mint",
  },
];

export const parentQuotes: ParentQuote[] = [
  {
    quote: "This feels like one of those rare ideas that is actually easy enough to do tonight.",
    name: "What a busy mom wants to feel",
    context: "Easy enough for a weekday, personal enough to feel special",
  },
  {
    quote: "It works for quiet time now, but it still feels good enough to hand to a grandparent later.",
    name: "Why the product is compelling",
    context: "Activity + keepsake in one purchase",
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
    title: "Free sample before you decide",
    detail: "You get to see the style on your own photo before you spend money on the full book.",
  },
  {
    title: "PDF included with every printed book",
    detail: "The spiral book is the giftable version, and the PDF gives you the print-tonight backup too.",
  },
  {
    title: "Damaged print? We replace it.",
    detail: "If your printed book arrives damaged or misprinted, we make it right.",
  },
];

export const faqs: FaqItem[] = [
  {
    question: "How many photos do I need for a full book?",
    answer: "Plan on one photo per page. Start with 30 if you want the smaller first version, move to 50 when the album is fuller, and choose 100 when your camera roll is packed and you want the best value.",
  },
  {
    question: "How fast is the free sample?",
    answer: "Usually a few minutes. It is fast enough to feel easy, but we still leave room to clean up the page so it looks worth showing your child.",
  },
  {
    question: "How fast do I get the PDF version?",
    answer: "The PDF is the faster path. Smaller books are often ready the same session, while bigger books can take longer because every page still has to be cleaned up and prepared.",
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
  if (designs >= 30) return "pdf-30";
  return "pdf-10";
}
