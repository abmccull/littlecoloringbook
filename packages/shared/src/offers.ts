export type OfferCode =
  | "sample-free"
  | "pdf-10"
  | "pdf-30"
  | "pdf-50"
  | "pdf-100"
  | "print-30"
  | "print-50"
  | "print-100";

export type PrintBundleCode = "single" | "set-of-2" | "set-of-3" | "set-of-5";

export type Offer = {
  code: OfferCode;
  title: string;
  designs: number;
  subtotalCents: number;
  priceLabel: string;
  format: "sample" | "pdf" | "print";
  highlight?: string;
};

export type PrintBundleOption = {
  code: PrintBundleCode;
  quantity: number;
  title: string;
};

export const printBundleOptions: PrintBundleOption[] = [
  {
    code: "single",
    quantity: 1,
    title: "Single copy",
  },
  {
    code: "set-of-2",
    quantity: 2,
    title: "2-copy bundle",
  },
  {
    code: "set-of-3",
    quantity: 3,
    title: "3-copy bundle",
  },
  {
    code: "set-of-5",
    quantity: 5,
    title: "5-copy bundle",
  },
];

const printBundleQuantityMap = new Map(printBundleOptions.map((option) => [option.code, option.quantity]));

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
    title: "10 Pages",
    designs: 10,
    subtotalCents: 1400,
    priceLabel: "$14 Print Tonight PDF",
    format: "pdf",
  },
  {
    code: "pdf-30",
    title: "30 Pages",
    designs: 30,
    subtotalCents: 2900,
    priceLabel: "$29 Print Tonight PDF",
    format: "pdf",
    highlight: "Best place to start",
  },
  {
    code: "pdf-50",
    title: "50 Pages",
    designs: 50,
    subtotalCents: 3900,
    priceLabel: "$39 Print Tonight PDF",
    format: "pdf",
    highlight: "Most popular",
  },
  {
    code: "pdf-100",
    title: "100 Pages",
    designs: 100,
    subtotalCents: 5900,
    priceLabel: "$59 Print Tonight PDF",
    format: "pdf",
    highlight: "Best value",
  },
  {
    code: "print-30",
    title: "30 Pages",
    designs: 30,
    subtotalCents: 4900,
    priceLabel: "$49 Giftable Spiral Book + PDF",
    format: "print",
  },
  {
    code: "print-50",
    title: "50 Pages",
    designs: 50,
    subtotalCents: 6400,
    priceLabel: "$64 Giftable Spiral Book + PDF",
    format: "print",
  },
  {
    code: "print-100",
    title: "100 Pages",
    designs: 100,
    subtotalCents: 9900,
    priceLabel: "$99 Giftable Spiral Book + PDF",
    format: "print",
  },
];

export const defaultOfferCode: OfferCode = "pdf-30";
export const defaultPrintBundleCode: PrintBundleCode = "single";
export const defaultPrintQuantity = 1;

function normalizePositiveInteger(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(Number(value));
  return normalized > 0 ? normalized : fallback;
}

export function normalizePrintBundleCode(bundleSelection?: string | null): PrintBundleCode | null {
  if (!bundleSelection) {
    return null;
  }

  return printBundleQuantityMap.has(bundleSelection as PrintBundleCode) ? (bundleSelection as PrintBundleCode) : null;
}

export function getPrintBundleQuantity(bundleSelection?: string | null) {
  const normalized = normalizePrintBundleCode(bundleSelection);
  return normalized ? printBundleQuantityMap.get(normalized) ?? defaultPrintQuantity : null;
}

export function getNormalizedOrderQuantity(input: {
  bundleSelection?: string | null;
  format: Offer["format"];
  quantity?: number | null;
}) {
  if (input.format !== "print") {
    return 1;
  }

  const bundledQuantity = getPrintBundleQuantity(input.bundleSelection);
  return bundledQuantity ?? normalizePositiveInteger(input.quantity, defaultPrintQuantity);
}

function getMatchingPdfOffer(offer: Offer) {
  return getOfferByCode(`pdf-${offer.designs}` as OfferCode);
}

export function getPrintAdditionalCopyCents(offerOrCode: Offer | string) {
  const offer = typeof offerOrCode === "string" ? getOfferByCode(offerOrCode) : offerOrCode;

  if (offer.format !== "print") {
    return 0;
  }

  const matchingPdfOffer = getMatchingPdfOffer(offer);
  return Math.max(offer.subtotalCents - matchingPdfOffer.subtotalCents, 0);
}

export function getOfferSubtotalForQuantity(
  offerOrCode: Offer | string,
  input?:
    | number
    | null
    | {
        bundleSelection?: string | null;
        quantity?: number | null;
      },
) {
  const offer = typeof offerOrCode === "string" ? getOfferByCode(offerOrCode) : offerOrCode;
  const quantity =
    typeof input === "number" || input == null
      ? getNormalizedOrderQuantity({ format: offer.format, quantity: input })
      : getNormalizedOrderQuantity({
          format: offer.format,
          quantity: input.quantity,
          bundleSelection: input.bundleSelection,
        });

  if (offer.format !== "print") {
    return offer.subtotalCents;
  }

  const additionalCopyCents = getPrintAdditionalCopyCents(offer);
  return offer.subtotalCents + additionalCopyCents * Math.max(0, quantity - 1);
}

export function getOfferByCode(code: string) {
  return offers.find((offer) => offer.code === code) ?? offers.find((offer) => offer.code === defaultOfferCode)!;
}
