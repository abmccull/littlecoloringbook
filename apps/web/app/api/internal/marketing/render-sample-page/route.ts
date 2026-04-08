import { createQueuedProductAssetRouteHandler } from "../../../../../lib/marketing-api";
import { executeInternalProductRender } from "../../../../../lib/marketing-runtime";

export const POST = createQueuedProductAssetRouteHandler("sample", {
  execute: executeInternalProductRender,
  validate: (input) => {
    if (input.sourceAssetIds.length !== 1) {
      return "Sample render requests require exactly one source asset.";
    }

    return null;
  },
});
