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
    label: "See book sizes",
    href: "/create?offer=pdf-100",
    eventName: "home_primary_offer_clicked",
  },
  startThirtyPdf: {
    label: "Choose my book size",
    href: "/create?offer=pdf-100",
    eventName: "sample_ready_primary_offer_clicked",
  },
  addThirtyPrint: {
    label: "Add the giftable spiral book",
    href: "/create?offer=print-100",
    eventName: "sample_ready_print_upsell_clicked",
  },
  startMiniPdf: {
    label: "Start smaller with 10 pages",
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
    description: "A small first book for one favorite moment, one pet, or a quick rainy-day win.",
    ctaLabel: "Start with 10 pages",
    comparisonNote: "Best for testing the idea beyond the free sample.",
  },
  {
    code: "pdf-30",
    title: "30 Pages",
    badge: "Good starter",
    badgeTone: "sky",
    designs: 30,
    pdfPrice: 29,
    printPrice: 49,
    description: "The lightest full book when you want a simpler first keepsake from a smaller photo set.",
    ctaLabel: "Choose 30 pages",
    comparisonNote: "A solid first step when you want the smallest full-book option.",
  },
  {
    code: "pdf-50",
    title: "50 Pages",
    badge: "Better choice",
    badgeTone: "mint",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    description: "The strongest mix of value, story depth, and giftability for real family albums.",
    ctaLabel: "Choose 50 pages",
    comparisonNote: "Where most full camera rolls start to feel worth turning into a real book.",
  },
  {
    code: "pdf-100",
    title: "100 Pages",
    badge: "Best value",
    badgeTone: "coral",
    designs: 100,
    pdfPrice: 59,
    printPrice: 99,
    description: "The biggest keepsake option for packed camera rolls, sibling stories, trips, and holiday gifting.",
    ctaLabel: "Choose 100 pages",
    comparisonNote: "Lowest cost per page and the fullest version of the book.",
    featured: true,
  },
];

export const homepageContent = {
  hero: {
    badge: "A simple yes for busy moms",
    title: "Turn favorite photos into coloring books your kids will want to color again and again.",
    description:
      "Start with one photo for a free sample. If it feels like them, choose a 30, 50, or 100-page book you can print tonight or order as a spiral-bound keepsake.",
    supporting:
      "Made for moms who want something personal without turning it into a project: a screen-free activity for now and a keepsake you will actually want to save later.",
    trustPoints: ["Free sample first", "From your real family photos", "PDF tonight or spiral book shipped"],
  },
  proofStripTitle: "See the photo-to-book transformation before you buy",
  featuredOfferIntro:
    "Use a simple good-better-best ladder: 30 pages is the starter book, 50 pages gives the story more room, and 100 pages gives you the best value for a packed photo roll.",
  sampleBlock: {
    title: "Try one page first",
    description: "The free sample is there so you never have to buy blind. See your own photo as a coloring page, then decide if you want the full book.",
  },
};

export const useCaseCards: UseCaseCard[] = [
  {
    title: "Quiet time that feels like a win",
    description: "A personalized activity for afternoons when you need something easy, low-prep, and genuinely engaging.",
    tone: "sun",
  },
  {
    title: "A birthday gift that feels thoughtful",
    description: "More personal than a generic book, but easier than planning a custom craft project from scratch.",
    tone: "coral",
  },
  {
    title: "A keepsake grandparents actually keep",
    description: "Turn favorite family photos into a gift that gets colored now and tucked away later.",
    tone: "mint",
  },
];

export const parentQuotes: ParentQuote[] = [
  {
    quote: "This feels like something I could do tonight without turning it into a whole extra task.",
    name: "What a busy mom wants to feel",
    context: "Easy enough for a weekday, personal enough to feel special",
  },
  {
    quote: "It lands in that sweet spot where it works for quiet time now and still feels gift-worthy later.",
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
    detail: "You see the style on your own photo before you commit to the full book.",
  },
  {
    title: "PDF included with every printed book",
    detail: "The spiral book is the keepsake version, and the PDF gives you instant reprint access too.",
  },
  {
    title: "Damaged print? We replace it.",
    detail: "If your printed book arrives damaged or misprinted, we make it right.",
  },
];

export const faqs: FaqItem[] = [
  {
    question: "How many photos do I need for a full book?",
    answer: "Plan on one photo per page. Use the simple ladder: 30 pages is the good starter option, 50 pages is the better step up, and 100 pages is the best value when your camera roll is packed.",
  },
  {
    question: "How fast is the free sample?",
    answer: "Usually a few minutes. We position it as quick, not instant, so there is room for processing and cleanup.",
  },
  {
    question: "How fast do I get the PDF version?",
    answer: "The PDF is the faster path. Smaller books are often ready the same session, and bigger books can take longer because every page still needs to be processed and cleaned up.",
  },
  {
    question: "How long does the printed spiral book take?",
    answer: "Printed books take longer because they have to be made, bound, and shipped. After your artwork is ready, allow production time plus shipping time shown at checkout.",
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
    answer: "You can mix siblings into one book if you want one shared keepsake, or build separate books if you want each child to have their own version.",
  },
  {
    question: "Can I order extra copies for grandparents or gifts?",
    answer: "Yes. On the printed-book path you can add extra copies for grandparents, birthdays, or sibling gifts without rebuilding the whole book.",
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
