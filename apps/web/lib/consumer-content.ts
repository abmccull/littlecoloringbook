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
  startMiniPdf: {
    label: "Keep It Light With 10 Pages",
    href: "/create?offer=pdf-10&source=sample-ready-downsell&acquisitionPath=sample_first",
    eventName: "sample_ready_downsell_clicked",
  },
} satisfies Record<string, FunnelCta>;

export const consumerOffers: ConsumerOffer[] = [
  {
    code: "pdf-30",
    title: "The Starter Book",
    badge: "Easy first book",
    badgeTone: "sky",
    designs: 30,
    pdfPrice: 29,
    printPrice: 49,
    description: "The fastest way to turn a handful of favorites into their first personalized coloring book.",
    ctaLabel: "Start with The Starter Book",
    comparisonNote: "Best for your first full book.",
  },
  {
    code: "pdf-50",
    title: "The Family Memory Book",
    badge: "Most families pick this",
    badgeTone: "mint",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    description: "The sweet spot. Enough pages for birthdays, pets, siblings, and every moment worth coloring.",
    ctaLabel: "Build My Family Memory Book",
    comparisonNote: "Best when you want the book to feel full without going all the way to 100.",
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
    description: "Every birthday, every pet, every silly moment gets its own page. The full family story in one book.",
    ctaLabel: "Get The Complete Collection",
    comparisonNote: "Best when you want the most book for the money.",
  },
];

export const homepageContent = {
  hero: {
    badge: "Free sample in 90 seconds",
    title: "Your kid's favorite photos. Their new favorite coloring book.",
    description:
      "Upload one photo. See it become a coloring page in 90 seconds. When they light up, turn the rest of your camera roll into their own book.",
    supporting:
      "They'll recognize every face on every page. That's what makes them actually want to color it. No craft-project energy required.",
    callouts: [
      {
        badge: "See it first",
        title: "90 seconds to your first page",
        detail: "Upload one photo and watch it become a coloring page. Free, no commitment.",
        tone: "sun",
      },
      {
        badge: "Made from your photos",
        title: "They recognize themselves. That's the magic.",
        detail: "Familiar faces, pets, and moments they know make kids actually want to color.",
        tone: "sky",
      },
      {
        badge: "Real results",
        title: "Real parents. Real reactions.",
        detail: "Join families who turned their camera rolls into keepsakes their kids won't put down.",
        tone: "coral",
      },
    ] satisfies HeroCallout[],
  },
  proofStripTitle: "See how one photo becomes a page worth coloring.",
  proofStripCopy:
    "The input is a photo they already know. The output is bold, clean lines they actually want to fill in. That's the whole trick.",
  featuredOfferIntro:
    "Start with The Starter Book if you want an easy first yes. The Family Memory Book is what most families pick. The Complete Collection is for camera rolls that are packed and ready.",
  sampleBlock: {
    title: "See your own photo first. Free.",
    description: "One photo, one free coloring page, 90 seconds. If they love it, the rest of your camera roll is next.",
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
    quote: "My daughter grabbed the crayon before I even finished explaining what it was.",
    name: "Sarah M.",
    context: "Austin, TX",
  },
  {
    quote: "He kept saying 'that's ME!' on every page. Worth every penny for the reaction alone.",
    name: "Jess T.",
    context: "Portland, OR",
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
    answer: "Your free page is ready in about 90 seconds. You'll see it on screen and get a copy in your inbox.",
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

export const urgencyMessages = {
  sampleExpiry: "Your preview is saved for 48 hours.",
  seasonalCover: "Mother's Day cover available through May 10.",
};

export const offerBonuses = [
  { name: "The Coloring Party Kit", value: 29, description: "Printable cover sheet, coloring tips, and 'About the Artist' page featuring your child" },
  { name: "The Memory Vault", value: 19, description: "Permanent digital access to re-download or re-order anytime" },
  { name: "Best Photo Picker Guide", value: 9, description: "One-page checklist showing which photo types make the best coloring pages" },
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
