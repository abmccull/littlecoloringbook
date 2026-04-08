import "server-only";

import { type LifecycleEmailTemplate } from "@littlecolorbook/email";
import { deliverLifecycleEmail } from "./lifecycle-email";

export async function sendLifecycleEmailForOrder(input: {
  orderId: string;
  template: LifecycleEmailTemplate;
  force?: boolean;
}) {
  return deliverLifecycleEmail(input);
}
