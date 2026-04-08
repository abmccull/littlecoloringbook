import { createQueuedProductAssetRouteHandler } from "../../../../../lib/marketing-api";
import { executeInternalProductRender } from "../../../../../lib/marketing-runtime";

export const POST = createQueuedProductAssetRouteHandler("proof_video", {
  execute: executeInternalProductRender,
  validate: (input) => {
    if (!input.outputFormats.includes("mp4")) {
      return "Proof video requests must request an mp4 output format.";
    }

    return null;
  },
});
