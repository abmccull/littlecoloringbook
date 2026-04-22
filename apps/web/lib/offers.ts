export type Offer = {
  code: string;
  name: string;
  designs: number;
  pdfPrice: number | null;
  printPrice: number | null;
  badge?: string;
  description: string;
};

export const featuredOffers: Offer[] = [
  {
    code: "pdf-30",
    name: "Signature Memory Book",
    designs: 30,
    pdfPrice: 29,
    printPrice: 49,
    badge: "Best place to start",
    description: "The easiest first order. Enough pages to feel like a real keepsake without turning the decision into homework.",
  },
  {
    code: "pdf-50",
    name: "Storybook Deluxe",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    badge: "Most Popular",
    description: "The strongest value upgrade for fuller camera rolls, birthdays, sibling stories, and gift-worthy memory books.",
  },
  {
    code: "pdf-100",
    name: "Year of Memories",
    designs: 100,
    pdfPrice: 59,
    printPrice: 99,
    badge: "Best Value",
    description: "The high-anchor keepsake for vacations, year-in-review albums, grandparents, and memory-heavy photo libraries.",
  },
];

export const trustPoints = [
  "Upload 1 photo to preview the style",
  "Printable PDF in minutes",
  "Made from your real family photos",
  "Printed spiral book shipped to your door",
];

export const useCases = [
  "Rainy afternoon win",
  "Birthday gift that feels personal",
  "Grandparent keepsake",
  "Vacation memory book",
  "Pet coloring book",
  "Sibling set",
];

export const differencePoints = [
  {
    title: "Your memories, not stock illustrations",
    description: "The book starts with photos your family already cares about, so the finished pages feel personal instead of generic.",
  },
  {
    title: "Built for coloring, not for prompting",
    description: "We simplify photos into bold outlines, cleaner shapes, and open space instead of handing you a fiddly AI art experiment.",
  },
  {
    title: "Preview first, then decide",
    description: "The free sample removes the guesswork. You see the style on your own photo before you commit to a full book.",
  },
];

export const includedFeatures = [
  "A personalized cover with your child's name",
  "Kid-friendly line cleanup for bold, colorable pages",
  "A print-ready PDF with re-download access",
  "Up to 3 free page redos if a few pages miss",
];

export const guaranteePoints = [
  {
    name: "Preview Promise",
    detail: "See your own photo turned into a page before you pay for a full print book.",
  },
  {
    name: "Redo Promise",
    detail: "If a few paid pages miss the mark, we rerender up to 3 pages free.",
  },
  {
    name: "Arrival Promise",
    detail: "If a printed book arrives damaged or misprinted, we replace it.",
  },
  {
    name: "Fast PDF",
    detail: "Digital books are targeted for minutes, not days.",
  },
];

export const sampleBenefits = [
  "Made from one real family photo",
  "Printable page delivered by email",
  "Usually ready in about 2 minutes",
  "No full album required up front",
];

export const faqs = [
  {
    question: "How many photos do I need?",
    answer: "Start with one photo for a free sample. Paid books begin at 10 uploaded photos, and larger books can create multiple strong pages from a single photo when needed.",
  },
  {
    question: "How fast is the PDF?",
    answer: "Free samples are usually ready in about 2 minutes. Paid PDFs (30, 50, or 100 designs) are targeted for 15 to 30 minutes.",
  },
  {
    question: "How long does the printed book take?",
    answer: "Printed books are typically sent to production within one business day. Lulu production is usually 3 to 5 business days, plus shipping transit time.",
  },
  {
    question: "Do I preview before printing?",
    answer: "Yes. The free sample is the style proof. Print books also include the PDF, and the team can rerender up to 3 weak pages if needed.",
  },
  {
    question: "What kinds of photos work best?",
    answer: "Clear photos with one strong moment work best: kids, siblings, pets, birthdays, trips, and everyday family scenes. You do not need a professional photo.",
  },
];
