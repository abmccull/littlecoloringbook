import { createQueuedProductAssetRouteHandler } from "../../../../../lib/marketing-api";
import { executeInternalProductRender } from "../../../../../lib/marketing-runtime";

export const POST = createQueuedProductAssetRouteHandler("book_preview", {
  execute: executeInternalProductRender,
});
