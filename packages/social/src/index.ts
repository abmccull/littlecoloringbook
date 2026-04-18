export { matchAutoReply } from "./auto-reply";
export type { KeywordResponse as AutoReplyKeywordResponse } from "./auto-reply";

// Phase 3b — Slot rules + backfill helpers
export {
  DEFAULT_SLOT_CONFIG,
  enumerateSlotsForWindow,
  findUnfilledSlots,
  scoreCreativeMatch,
  localTimeToUtc,
  calendarDaysInWindow,
} from "./slot-rules";
export type {
  SlotConfig,
  SlotPlatformEntry,
  Slot,
  ExistingPostRef,
  Taxonomy,
  CreativeAsset as SlotCreativeAsset,
} from "./slot-rules";
export { publishFbPagePhoto } from "./fb-page";
export { publishIgFeedSingle } from "./ig";
export { FbPublishError } from "./types";
export type { FbPhotoPublishResult, FbPublishPhotoInput, IgFeedPublishInput } from "./types";

export {
  sendFbMessengerText,
  sendIgDirectText,
  verifyMetaWebhookSignature,
  parseIncomingMessengerEvent,
  parseIncomingIgEvent,
  DmWindowExpiredError,
} from "./dm";
export type {
  SendFbMessengerTextInput,
  SendIgDirectTextInput,
  SendDmResult,
  IncomingDmEvent,
  IncomingDmAttachment,
} from "./dm";
export type { DmWindowExpiredError as DmWindowExpiredErrorType } from "./types";
