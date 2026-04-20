export class FbPublishError extends Error {
  constructor(
    public readonly code: number,
    public readonly subcode: number | null,
    message: string,
  ) {
    super(message);
    this.name = "FbPublishError";
  }
}

export type FbPhotoPublishResult = {
  id: string;
  post_id: string;
};

export type FbPublishPhotoInput = {
  pageId: string;
  accessToken: string;
  imagePath: string;
  caption: string;
  scheduledUnix?: number;
  apiVersion?: string;
};

export type FbCarouselPublishInput = {
  pageId: string;
  accessToken: string;
  /**
   * Public HTTPS URLs for each slide, in order. Signed GCS URLs work fine
   * as long as they're valid during the upload. 2–10 images.
   */
  imageUrls: string[];
  caption: string;
  scheduledUnix?: number;
  apiVersion?: string;
};

export type IgFeedPublishInput = {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
};

// ─── DM / Inbox types ────────────────────────────────────────────────────────

/**
 * Thrown when a send fails because the 24-hour messaging window has expired.
 * Callers should surface a prompt for a human agent to reply with tag=HUMAN_AGENT.
 *
 * Meta Graph API signals this as error code 10, error_subcode 2018278.
 */
export class DmWindowExpiredError extends Error {
  public readonly code = 10;
  public readonly subcode = 2018278;

  constructor(
    public readonly recipientPsid: string,
    message = "24-hour messaging window has expired for this recipient",
  ) {
    super(message);
    this.name = "DmWindowExpiredError";
  }
}

export type SendDmResult = {
  message_id: string;
  recipient_id: string;
};

export type IncomingDmAttachment = {
  type: string;
  url: string;
  mime_type?: string;
};

export type IncomingDmEvent = {
  platform: "fb_messenger" | "ig_direct";
  platformUserId: string;
  metaMessageId: string;
  text: string;
  attachments: IncomingDmAttachment[];
  sentAt: Date;
  pageId: string;
};
