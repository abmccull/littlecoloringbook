export type OfferCode =
  | "sample-free"
  | "pdf-10"
  | "pdf-30"
  | "pdf-50"
  | "pdf-100"
  | "print-30"
  | "print-50"
  | "print-100";

export type Offer = {
  code: OfferCode;
  title: string;
  designs: number;
  subtotalCents: number;
  priceLabel: string;
  format: "sample" | "pdf" | "print";
  highlight?: string;
};

export const offers: Offer[] = [
  {
    code: "sample-free",
    title: "Free Sample Page",
    designs: 1,
    subtotalCents: 0,
    priceLabel: "Free sample",
    format: "sample",
  },
  {
    code: "pdf-10",
    title: "Starter PDF",
    designs: 10,
    subtotalCents: 1400,
    priceLabel: "$14 PDF",
    format: "pdf",
  },
  {
    code: "pdf-30",
    title: "Signature Memory Book",
    designs: 30,
    subtotalCents: 2900,
    priceLabel: "$29 PDF / $49 Print + PDF",
    format: "pdf",
    highlight: "Best place to start",
  },
  {
    code: "pdf-50",
    title: "Storybook Deluxe",
    designs: 50,
    subtotalCents: 3900,
    priceLabel: "$39 PDF / $64 Print + PDF",
    format: "pdf",
    highlight: "Most popular",
  },
  {
    code: "pdf-100",
    title: "Year of Memories",
    designs: 100,
    subtotalCents: 5900,
    priceLabel: "$59 PDF / $99 Print + PDF",
    format: "pdf",
    highlight: "Best value",
  },
  {
    code: "print-30",
    title: "Signature Memory Book",
    designs: 30,
    subtotalCents: 4900,
    priceLabel: "$49 Print + PDF",
    format: "print",
  },
  {
    code: "print-50",
    title: "Storybook Deluxe",
    designs: 50,
    subtotalCents: 6400,
    priceLabel: "$64 Print + PDF",
    format: "print",
  },
  {
    code: "print-100",
    title: "Year of Memories",
    designs: 100,
    subtotalCents: 9900,
    priceLabel: "$99 Print + PDF",
    format: "print",
  },
];

export const defaultOfferCode: OfferCode = "pdf-30";

export function getOfferByCode(code: string) {
  return offers.find((offer) => offer.code === code) ?? offers.find((offer) => offer.code === defaultOfferCode)!;
}
