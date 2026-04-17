import { APP_NAME } from "@littlecolorbook/shared";
import { getEmailEnv, isEmailConfigured } from "@littlecolorbook/shared/env";

export type LifecycleEmailTemplate =
  | "order-paid"
  | "pdf-ready"
  | "print-submitted"
  | "order-shipped"
  | "order-delivered"
  | "account-welcome";

export type LifecycleEmailInput = {
  template: LifecycleEmailTemplate;
  to: string;
  portalUrl: string;
  orderId: string;
  offerTitle: string;
  designCount: number;
  deliveryMode: "sample" | "pdf" | "print";
  customerFirstName?: string | null;
  childFirstName?: string | null;
  downloadUrl?: string | null;
  trackingUrl?: string | null;
  supportEmail?: string | null;
  accountUrl?: string | null;
  magicLinkUrl?: string | null;
};

export type LifecycleEmailPayload = {
  subject: string;
  text: string;
  html: string;
};

export type LifecycleEmailResult = {
  provider: "resend" | "stub";
  status: "sent" | "skipped";
  messageId: string | null;
  subject: string;
  payload: LifecycleEmailPayload;
};

function greeting(firstName?: string | null) {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

function signoff(supportEmail: string) {
  return `Need help? Reply to this email or contact ${supportEmail}.`;
}

export function renderLifecycleEmail(input: LifecycleEmailInput): LifecycleEmailPayload {
  const supportEmail = input.supportEmail ?? "support@littlecolorbook.com";
  const intro = greeting(input.customerFirstName);
  const childLine = input.childFirstName ? ` for ${input.childFirstName}` : "";
  const orderLine = `${input.offerTitle} (${input.designCount} designs)`;

  let subject = `${APP_NAME} update for order ${input.orderId}`;
  let body = `${intro}

We have an update on your ${APP_NAME} order${childLine}.

Order: ${orderLine}
Portal: ${input.portalUrl}`;

  switch (input.template) {
    case "order-paid":
      subject = `${APP_NAME}: your order is in the queue`;
      body = `${intro}

We received your order for ${orderLine}. We are now turning the uploaded photos into your coloring pages${childLine}.

Portal: ${input.portalUrl}${input.accountUrl ? `
Manage your order: ${input.accountUrl}` : ""}

${signoff(supportEmail)}`;
      break;
    case "pdf-ready":
      if (input.deliveryMode === "sample") {
        subject = `${APP_NAME}: your free coloring page is ready`;
        body = `${intro}

Your free coloring page is ready to download${childLine}.

Download your page: ${input.downloadUrl ?? input.portalUrl}

Love how it turned out? Turn the rest of your camera roll into a full coloring book:
${input.portalUrl}

${signoff(supportEmail)}`;
      } else {
        subject = `${APP_NAME}: your PDF is ready`;
        body = `${intro}

Your personalized coloring book PDF is ready.

Download: ${input.downloadUrl ?? input.portalUrl}
Portal: ${input.portalUrl}${input.accountUrl ? `
Manage your order: ${input.accountUrl}` : ""}

${signoff(supportEmail)}`;
      }
      break;
    case "print-submitted":
      subject = `${APP_NAME}: your print order is in production`;
      body = `${intro}

Your print order has been submitted to Lulu and is moving into production. You can follow progress in your portal.

Portal: ${input.portalUrl}${input.accountUrl ? `
Manage your order: ${input.accountUrl}` : ""}

${signoff(supportEmail)}`;
      break;
    case "order-shipped":
      subject = `${APP_NAME}: your book has shipped`;
      body = `${intro}

Your printed coloring book is on the way.

Tracking: ${input.trackingUrl ?? "Tracking will appear in your portal shortly."}
Portal: ${input.portalUrl}${input.accountUrl ? `
Manage your order: ${input.accountUrl}` : ""}

Signed-in tip: the "Get help" button on your order page opens a support ticket directly.

${signoff(supportEmail)}`;
      break;
    case "order-delivered":
      subject = `${APP_NAME}: your book was delivered`;
      body = `${intro}

Your printed coloring book shows as delivered.

Portal: ${input.portalUrl}${input.accountUrl ? `
Manage your order: ${input.accountUrl}` : ""}

${signoff(supportEmail)}`;
      break;
    case "account-welcome": {
      const accountLink = input.magicLinkUrl ?? input.accountUrl ?? input.portalUrl;
      subject = `${APP_NAME}: your account is ready`;
      body = `${intro}

Thanks for ordering ${orderLine}${childLine}. We set up a ${APP_NAME} account under ${input.to} so you can check on this order, grab the PDF again later, and open a support ticket if anything needs a second look.

Sign in with one click:
${accountLink}

This link will email you a sign-in code each time, so there's no password to remember. Your order confirmation and portal link still work too.

${signoff(supportEmail)}`;
      break;
    }
  }

  const html = body
    .split("\n\n")
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");

  return {
    subject,
    text: body,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#211915;background:#fffaf5;padding:24px;">${html}</body></html>`,
  };
}

export type SequenceEmailDispatchInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type SequenceEmailDispatchResult = {
  provider: "resend" | "stub";
  status: "sent" | "skipped";
  messageId: string | null;
};

export async function sendSequenceEmail(input: SequenceEmailDispatchInput): Promise<SequenceEmailDispatchResult> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Resend email delivery is not configured.");
    }
    return { provider: "stub", status: "skipped", messageId: null };
  }

  const env = getEmailEnv();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.fromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ?? env.supportEmail,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend sequence send failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { id?: string };
  return { provider: "resend", status: "sent", messageId: data.id ?? null };
}

export * from "./sequences";

export async function sendLifecycleEmail(input: LifecycleEmailInput): Promise<LifecycleEmailResult> {
  const payload = renderLifecycleEmail(input);

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Resend email delivery is not configured.");
    }

    return {
      provider: "stub",
      status: "skipped",
      messageId: null,
      subject: payload.subject,
      payload,
    };
  }

  const env = getEmailEnv();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.fromEmail,
      to: [input.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: input.supportEmail ?? env.supportEmail,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { id?: string };

  return {
    provider: "resend",
    status: "sent",
    messageId: data.id ?? null,
    subject: payload.subject,
    payload,
  };
}
