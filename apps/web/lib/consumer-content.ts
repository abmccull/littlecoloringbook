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
} as const;

export const funnelCtas = {
  freeSample: {
    label: "Get My Free Sample Page",
    href: "/sample?source=homepage-sample&acquisitionPath=sample_first",
    eventName: "home_sample_cta_clicked",
  },
  directBuilder: {
    label: "Already Sold? Build My Book",
    href: "/create?offer=pdf-100&source=home-direct-buy&acquisitionPath=direct_buy",
    eventName: "home_direct_builder_clicked",
  },
  seeBookSizes: {
    label: "See Book Sizes",
    href: "#book-sizes",
    eventName: "home_book_sizes_clicked",
  },
  startThirtyPdf: {
    label: "Build The 100-Page Book",
    href: "/create?offer=pdf-100&source=sample-ready-primary&acquisitionPath=sample_first",
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
    badge: "Easy first book",
    badgeTone: "sky",
    designs: 30,
    pdfPrice: 29,
    printPrice: 49,
    description: "A lighter first book when you want something personal, useful, and easy to say yes to right away.",
    ctaLabel: "Start with 30 pages",
    comparisonNote: "Best for your first full book.",
  },
  {
    code: "pdf-50",
    title: "50 Pages",
    badge: "Most popular",
    badgeTone: "mint",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    description: "A fuller book for bigger camera rolls, sibling stories, birthdays, and gifts that should feel complete.",
    ctaLabel: "Choose 50 pages",
    comparisonNote: "Best when you want the book to feel full without going all the way to 100.",
  },
  {
    code: "pdf-100",
    title: "100 Pages",
    badge: "Best keepsake value",
    badgeTone: "coral",
    designs: 100,
    pdfPrice: 59,
    printPrice: 99,
    description: "The biggest, best-value keepsake when the camera roll is full and you want the whole story in one book.",
    ctaLabel: "Get the 100-page book",
    comparisonNote: "Best when you want the most book for the money.",
    featured: true,
  },
];

export const homepageContent = {
  hero: {
    badge: "The easiest screen-free win hiding in your camera roll",
    title: "Turn the favorite photos already on your phone into a coloring book they will want to use tonight.",
    description:
      "Start with one favorite photo for a free sample page. If it feels right, turn the rest into a personalized book you can print tonight or order as a spiral-bound keepsake.",
    supporting:
      "No craft-project energy required. Just familiar faces, pets, birthdays, trips, and family moments turned into pages they will actually recognize and want to color.",
    callouts: [
      {
        badge: "Start here",
        title: "Try one page free first",
        detail: "See your own photo in the style before you pay for the full book.",
        tone: "sun",
      },
      {
        badge: "Made from your photos",
        title: "Familiar faces make it click",
        detail: "Kids recognize the people, pets, and moments right away.",
        tone: "sky",
      },
      {
        badge: "Choose your version",
        title: "Print tonight or ship the spiral book",
        detail: "Go fast with the PDF or order the giftable keepsake version.",
        tone: "coral",
      },
    ] satisfies HeroCallout[],
  },
  proofStripTitle: "See how a real photo turns into a coloring page worth keeping.",
  proofStripCopy:
    "The point is simple: the input feels familiar, the lines stay clean, and the finished result feels personal enough to keep instead of toss.",
  featuredOfferIntro:
    "Start with 30 if you want the easiest first book. Move up to 50 when you want it to feel fuller. Choose 100 when you already know the camera roll is packed and you want the best keepsake value.",
  sampleBlock: {
    title: "See one page before you commit to the whole book.",
    description: "See one real page made from your own photo first. If you already know you want the full book, you can skip the sample and head straight to the builder.",
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
    quote: "My kid would know these pages were ours right away. That is what makes it feel different from generic coloring pages.",
    name: "What makes it land",
    context: "Familiar faces and favorite moments make the book feel personal from page one",
  },
  {
    quote: "I can print the PDF for tonight and still order the spiral book when I want the nicer version to keep or gift.",
    name: "Why the format works",
    context: "Screen-free activity now, giftable keepsake later",
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
