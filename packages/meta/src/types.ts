import type { CAPI_ACTION_SOURCES, CAPI_EVENT_NAMES } from "./constants";

export type CapiEventName = (typeof CAPI_EVENT_NAMES)[number];
export type CapiActionSource = (typeof CAPI_ACTION_SOURCES)[number];

export type NormalizedUserData = {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  db?: string[];
  ge?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  external_id?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

export type RawUserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

export type CustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  order_id?: string;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  num_items?: number;
};

export type CapiEventInput = {
  event_name: CapiEventName;
  event_time: number;
  event_id: string;
  action_source: CapiActionSource;
  event_source_url?: string;
  user_data: NormalizedUserData;
  custom_data?: CustomData;
  opt_out?: boolean;
};

export type CapiSendResult = {
  events_received: number;
  fbtrace_id: string;
  messages?: string[];
};

export type BucUsage = {
  callCount: number;
  totalCputime: number;
  totalTime: number;
  type: string;
  estimatedTimeToRegainAccess: number;
};

export type RateLimitHeaders = {
  appUsage: number | null;
  adAccountUsage: number | null;
  bucUsage: number | null;
};
