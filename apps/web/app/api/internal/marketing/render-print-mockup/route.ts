import { createQueuedProductAssetRouteHandler } from "../../../../../lib/marketing-api";
import { executeInternalProductRender } from "../../../../../lib/marketing-runtime";

const allowedBundleOffers = new Set(["solo", "sibling_set", "sibling_trio"]);
const allowedPrintOffers = new Set(["print-30", "print-50", "print-100"]);

export const POST = createQueuedProductAssetRouteHandler("print_mockup", {
  execute: executeInternalProductRender,
  validate: (input) => {
    if (!allowedPrintOffers.has(input.offerId)) {
      return "Print mockup requests must use a print offer.";
    }

    if (!allowedBundleOffers.has(input.bundleOffer)) {
      return "Print mockup requests must use the solo, sibling_set, or sibling_trio bundle offer.";
    }

    return null;
  },
});
