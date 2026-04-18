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

export type IgFeedPublishInput = {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
};
