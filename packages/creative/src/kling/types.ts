// Public API types for the Kling AI video generation client.
//
// Kling's REST API is documented at https://app.klingai.com/global/dev/document-api
// — these types mirror the request/response shapes for text2video and
// image2video only (all we currently need). If we later use Motion
// Control or effects endpoints, extend here.

export type KlingModel =
  | "kling-v1-6"
  | "kling-v2-0"
  | "kling-v2-1"
  | "kling-v3-0";

export type KlingMode = "std" | "pro";
export type KlingAspectRatio = "16:9" | "9:16" | "1:1";
export type KlingResolution = "720p" | "1080p";
export type KlingDurationSec = 5 | 10;

/** Camera control types supported on kling-v1-6 and kling-v2-1 (NOT v2-0). */
export type KlingCameraMotionType =
  | "simple"
  | "down_back"
  | "forward_up"
  | "right_turn_forward"
  | "left_turn_forward";

export type KlingCameraControl = {
  type: KlingCameraMotionType;
  config?: {
    horizontal?: number; // -10..10
    vertical?: number;
    pan?: number;
    tilt?: number;
    roll?: number;
    zoom?: number;
  };
};

export type Text2VideoRequest = {
  model: KlingModel;
  prompt: string;
  negativePrompt?: string;
  /** 0..1; higher = stricter prompt adherence. Default 0.5 per Kling docs. */
  cfgScale?: number;
  mode?: KlingMode;
  aspectRatio?: KlingAspectRatio;
  durationSec?: KlingDurationSec;
  cameraControl?: KlingCameraControl;
};

export type Image2VideoRequest = Text2VideoRequest & {
  /** Publicly accessible URL or base64 data URL for the start frame. */
  imageUrl: string;
  /** Optional end frame. */
  imageTailUrl?: string;
};

export type KlingTaskStatus = "submitted" | "processing" | "succeed" | "failed";

export type KlingTask = {
  taskId: string;
  status: KlingTaskStatus;
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
};

export type KlingVideoOutput = {
  id: string;
  url: string;
  durationSec: number;
};

export type KlingTaskResult = KlingTask & {
  videos: KlingVideoOutput[];
};

export type KlingErrorShape = {
  code: number;
  message: string;
};

export class KlingApiError extends Error {
  readonly code: number;
  readonly httpStatus: number;
  readonly raw: unknown;

  constructor(message: string, code: number, httpStatus: number, raw: unknown) {
    super(message);
    this.name = "KlingApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.raw = raw;
  }
}

export class KlingBudgetExceededError extends Error {
  constructor(
    public spent: number,
    public requested: number,
    public cap: number,
  ) {
    super(
      `Kling monthly budget would be exceeded: spent=${spent}, requested=${requested}, cap=${cap}.`,
    );
    this.name = "KlingBudgetExceededError";
  }
}
