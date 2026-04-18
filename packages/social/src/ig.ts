import type { IgFeedPublishInput } from "./types";

// TODO: Un-stub once the system user token is regenerated with
// instagram_content_publish scope.
//
// Real implementation outline:
//   1. POST /{ig-user-id}/media
//      body: { image_url, caption, access_token }
//      → returns { id: containerId }
//
//   2. Poll /{containerId}?fields=status_code until status_code === "FINISHED"
//      (typically 5–30 s; use exponential backoff, max ~2 min)
//
//   3. POST /{ig-user-id}/media_publish
//      body: { creation_id: containerId, access_token }
//      → returns { id: igMediaId }
//
// Errors to handle:
//   - 24 (Application does not have the capability)  → not yet approved
//   - 10 (Permission denied)                         → wrong scope
//   - 9007 (Container in ERROR status)               → retry with new container
//   - Rate-limit codes 17, 613, 429                  → exponential backoff

export async function publishIgFeedSingle(_input: IgFeedPublishInput): Promise<never> {
  throw new Error(
    "IG publishing requires instagram_content_publish scope — regenerate system user token with that scope before enabling",
  );
}
