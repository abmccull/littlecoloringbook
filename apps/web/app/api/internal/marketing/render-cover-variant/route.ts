import { createQueuedProductAssetRouteHandler } from "../../../../../lib/marketing-api";
import { executeInternalProductRender } from "../../../../../lib/marketing-runtime";

export const POST = createQueuedProductAssetRouteHandler("cover_variant", {
  execute: executeInternalProductRender,
  validate: (input) => {
    if (!input.childFirstName) {
      return "Cover variant requests require childFirstName.";
    }

    return null;
  },
});
