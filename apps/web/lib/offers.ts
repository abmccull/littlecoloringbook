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
    badge: "Best Start",
    description: "The core offer for first-time buyers. Big enough to feel substantial without slowing the decision down.",
  },
  {
    code: "pdf-50",
    name: "Storybook Deluxe",
    designs: 50,
    pdfPrice: 39,
    printPrice: 64,
    badge: "Most Popular",
    description: "The strongest value upgrade for families with a fuller camera roll and gift intent.",
  },
  {
    code: "pdf-100",
    name: "Year of Memories",
    designs: 100,
    pdfPrice: 59,
    printPrice: 99,
    badge: "Best Value",
    description: "A deeper keepsake product for birthdays, grandparents, and memory-heavy albums.",
  },
];

export const trustPoints = [
  "Screen-free activity",
  "Made from your own photos",
  "PDF in minutes",
  "Spiral book shipped to your door",
];

export const useCases = [
  "Birthday gift",
  "Rainy day activity",
  "Grandparent gift",
  "Vacation memory book",
  "Pet coloring book",
  "Sibling keepsake",
];

export const proofExamples = [
  {
    title: "Beach Day",
    blurb: "A candid family photo becomes a bold, open coloring page with clean outlines and simple details.",
  },
  {
    title: "Birthday Morning",
    blurb: "Messy, emotional real-life photos are simplified into pages kids can actually color.",
  },
  {
    title: "Dog Best Friend",
    blurb: "Pet photos turn into fast wins for kids who already love coloring familiar faces.",
  },
];

export const faqs = [
  {
    question: "How many photos do I need?",
    answer: "Start with one photo for a free sample. Paid books begin at 10 uploaded photos, and larger books can create multiple strong pages from a single photo when needed.",
  },
  {
    question: "How fast is the PDF?",
    answer: "Free samples are targeted for 5 to 15 minutes. Paid PDFs range from roughly 15 minutes for 10 designs to about 90 minutes for 100 designs.",
  },
  {
    question: "How long does the printed book take?",
    answer: "The app should submit print-ready books within one business day. Lulu production is typically 3 to 5 business days, plus shipping transit time.",
  },
  {
    question: "Do I preview before printing?",
    answer: "Yes. The free sample is the style proof. Print books also include the PDF, and the team can rerender up to 3 weak pages if needed.",
  },
];
