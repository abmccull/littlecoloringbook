import { describe, it, expect } from "vitest";
import { publishIgFeedSingle } from "../ig";

describe("publishIgFeedSingle (stub)", () => {
  it("throws with the expected scope-missing message", async () => {
    await expect(
      publishIgFeedSingle({
        igUserId: "ig_user_123",
        accessToken: "EAAtest",
        imageUrl: "https://example.com/image.jpg",
        caption: "Test caption",
      }),
    ).rejects.toThrow(
      "IG publishing requires instagram_content_publish scope — regenerate system user token with that scope before enabling",
    );
  });
});
