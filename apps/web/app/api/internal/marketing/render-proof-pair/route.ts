import { createQueuedProductAssetRouteHandler } from "../../../../../lib/marketing-api";
import { executeInternalProductRender } from "../../../../../lib/marketing-runtime";

export const POST = createQueuedProductAssetRouteHandler("proof_pair", {
  execute: executeInternalProductRender,
  validate: (input) => {
    if (input.sourceAssetIds.length !== 1) {
      return "Proof-pair requests require exactly one source asset.";
    }

    return null;
  },
});
