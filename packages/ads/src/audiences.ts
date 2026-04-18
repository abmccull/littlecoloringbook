// Stub implementations — Phase 2+ features. Signatures are stable; bodies throw.

import type { GraphClient } from "@littlecolorbook/meta";

export type CreateCustomAudienceInput = {
  client: GraphClient;
  adAccountId: string;
  name: string;
  description?: string;
  customerFileSource?: string;
};

export type CreateLookalikeAudienceInput = {
  client: GraphClient;
  adAccountId: string;
  name: string;
  originAudienceId: string;
  countryCodes: string[];
  ratio?: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createCustomAudience(_input: CreateCustomAudienceInput): Promise<never> {
  throw new Error("not yet implemented — Phase 2+");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createLookalikeAudience(_input: CreateLookalikeAudienceInput): Promise<never> {
  throw new Error("not yet implemented — Phase 2+");
}
