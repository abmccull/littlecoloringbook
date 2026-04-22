import { getEmailEnv, isEmailConfigured } from "@littlecolorbook/shared/env";

export type LifecycleEmailTemplate =
  | "order-paid"
  | "order-processing"
  | "review-required"
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
  setupUrl?: string | null;
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

type LifecycleEmailTone = "coral" | "sunshine" | "mint" | "sky";

type LifecycleEmailAction = {
  label: string;
  href: string;
};

type LifecycleEmailDetail = {
  label: string;
  value: string;
};

type LifecycleEmailView = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  paragraphs: string[];
  primaryAction: LifecycleEmailAction;
  secondaryAction?: LifecycleEmailAction | null;
  details: LifecycleEmailDetail[];
  highlightTitle?: string;
  highlightLines?: string[];
  footerNote: string;
  tone: LifecycleEmailTone;
};

const BRAND_NAME = "Little Color Book";

function greeting(firstName?: string | null) {
  return firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatOrderLine(input: LifecycleEmailInput) {
  return `${input.offerTitle} (${input.designCount} designs)`;
}

function formatDeliveryMode(deliveryMode: LifecycleEmailInput["deliveryMode"]) {
  switch (deliveryMode) {
    case "sample":
      return "Free sample page";
    case "pdf":
      return "PDF download";
    case "print":
      return "Spiral book + PDF";
  }
}

function toneStyles(tone: LifecycleEmailTone) {
  switch (tone) {
    case "sunshine":
      return {
        pillBackground: "#FBE7A7",
        pillText: "#7D4D3B",
        panelBackground: "#FFF3CF",
        panelBorder: "#F3D475",
      };
    case "mint":
      return {
        pillBackground: "#DDF4E9",
        pillText: "#2E5E49",
        panelBackground: "#ECFAF3",
        panelBorder: "#72C8A0",
      };
    case "sky":
      return {
        pillBackground: "#DFF3FB",
        pillText: "#2E5970",
        panelBackground: "#EEF8FD",
        panelBorder: "#9ADAF5",
      };
    case "coral":
    default:
      return {
        pillBackground: "#F8D5CB",
        pillText: "#8A4336",
        panelBackground: "#FDF0EB",
        panelBorder: "#F0B6A5",
      };
  }
}

function buildLifecycleDetails(input: LifecycleEmailInput): LifecycleEmailDetail[] {
  const details: LifecycleEmailDetail[] = [
    {
      label: input.deliveryMode === "sample" ? "Page" : "Book",
      value: formatOrderLine(input),
    },
  ];

  if (input.childFirstName?.trim()) {
    details.push({
      label: "For",
      value: input.childFirstName.trim(),
    });
  }

  details.push({
    label: "Format",
    value: formatDeliveryMode(input.deliveryMode),
  });

  return details;
}

function buildLifecycleEmailView(input: LifecycleEmailInput, supportEmail: string): LifecycleEmailView {
  const orderLine = formatOrderLine(input);
  const childLine = input.childFirstName?.trim() ? ` for ${input.childFirstName.trim()}` : "";
  const portalAction: LifecycleEmailAction = {
    label: "Open my order page",
    href: input.portalUrl,
  };
  const accountAction = input.accountUrl?.trim()
    ? {
        label: "Manage from my account",
        href: input.accountUrl,
      }
    : null;

  switch (input.template) {
    case "order-paid": {
      return {
        subject: `${BRAND_NAME}: upload your photos to start your book`,
        preheader: "Your payment went through. Next step: upload your photos.",
        eyebrow: "Order confirmed",
        title: "Your order is confirmed",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `Your payment for ${orderLine}${childLine} went through.`,
          "Next step: upload the photos for the book, add any final details, and tap Start when you're ready.",
          "Once you do, we'll begin turning those photos into finished coloring pages and send another update when processing starts.",
        ],
        primaryAction: {
          label: "Upload photos and finish setup",
          href: input.setupUrl ?? input.portalUrl,
        },
        secondaryAction: input.setupUrl?.trim() ? portalAction : accountAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "What to upload",
        highlightLines: [
          `Add up to ${input.designCount} favorite photos, one per page.`,
          "Clear faces, pets, and real family moments work best.",
          "You can add the cover name and dedication before you start generation.",
        ],
        footerNote: `Need help getting the order set up? Reply here or email ${supportEmail}.`,
        tone: "sunshine",
      };
    }
    case "order-processing":
      return {
        subject: `${BRAND_NAME}: your book is in progress`,
        preheader: "We have your uploaded photos and the pages are being built now.",
        eyebrow: "Processing started",
        title: "Your book is in progress",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `We have the uploaded photos for ${orderLine}${childLine}.`,
          "Your book is now in production, and your order page will keep updating as the pages render and the PDF comes together.",
          input.deliveryMode === "print"
            ? "We'll send the finished PDF as soon as it's ready, then keep you posted as the spiral book moves into print."
            : "We'll send the finished PDF as soon as it's ready to download.",
        ],
        primaryAction: portalAction,
        secondaryAction: accountAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "What happens now",
        highlightLines: [
          "We clean up the lines and build each page.",
          "We assemble the finished PDF.",
          input.deliveryMode === "print"
            ? "After that, the spiral book moves into print."
            : "As soon as the PDF is ready, we'll email the download link.",
        ],
        footerNote: `Questions while we work? Reply here or email ${supportEmail}.`,
        tone: "sky",
      };
    case "review-required":
      return {
        subject: `${BRAND_NAME}: your review is needed`,
        preheader: "We caught a page that needs your choice before we finish the PDF.",
        eyebrow: "Review needed",
        title: "Your review is needed",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `We finished the good pages for ${orderLine}${childLine}, but one or more pages need your choice before we can finish the PDF.`,
          "Open your order page to review the flagged page, keep it as-is, or replace it with a different photo.",
          "You do not need to start over. We keep the rest of the book and only revisit the page that did not pass quality review.",
        ],
        primaryAction: {
          label: "Review my pages",
          href: input.portalUrl,
        },
        secondaryAction: accountAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "What you can do",
        highlightLines: [
          "Approve the flagged page if it still feels good enough.",
          "Or upload one replacement photo for that slot.",
          "We will only redraw the flagged page, not the whole book.",
        ],
        footerNote: `Need help choosing a better photo? Reply here or email ${supportEmail}.`,
        tone: "coral",
      };
    case "pdf-ready":
      if (input.deliveryMode === "sample") {
        return {
          subject: `${BRAND_NAME}: your free page is ready`,
          preheader: "Download it now and see how it looks with real crayons.",
          eyebrow: "Sample ready",
          title: "Your free page is ready",
          greeting: greeting(input.customerFirstName),
          paragraphs: [
            `Your free coloring page is ready${childLine}.`,
            "Download it, print it tonight, and see how it feels in real life.",
            "If you love how it turned out, you can turn the rest of your camera roll into a full book anytime.",
          ],
          primaryAction: {
            label: "Download my page",
            href: input.downloadUrl ?? input.portalUrl,
          },
          secondaryAction: {
            label: "See full book options",
            href: input.portalUrl,
          },
          details: buildLifecycleDetails(input),
          highlightTitle: "Quick tip",
          highlightLines: [
            "The best coloring pages usually come from candid camera-roll photos, not posed ones.",
            "If this one missed the moment, reply and we'll help you choose a better photo.",
          ],
          footerNote: `Need help? Reply here or email ${supportEmail}.`,
          tone: "mint",
        };
      }

      return {
        subject: `${BRAND_NAME}: your book is ready`,
        preheader: "Download the finished PDF now.",
        eyebrow: "Book finished",
        title: "Your book is ready",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `Your personalized book is finished${childLine}, and the PDF is ready to download now.`,
          "Use the button below to grab the finished file, print tonight, and come back to your order page anytime you want it again.",
          input.deliveryMode === "print"
            ? "We'll keep you posted separately as the spiral book moves into print and shipping."
            : "Your order page stays live whenever you want to grab the files again.",
        ],
        primaryAction: {
          label: "Download my PDF",
          href: input.downloadUrl ?? input.portalUrl,
        },
        secondaryAction: portalAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "Also waiting in your order page",
        highlightLines: ["Coloring Party Kit", "Memory Vault re-download", "Best Photo Picker Guide"],
        footerNote: `Need help? Reply here or email ${supportEmail}.`,
        tone: "mint",
      };
    case "print-submitted":
      return {
        subject: `${BRAND_NAME}: your spiral book is in production`,
        preheader: "Your spiral book is with our print partner now.",
        eyebrow: "Print update",
        title: "Your spiral book is in production",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          "Your print order has been submitted and is moving into production.",
          "Your order page will stay updated while it moves through print and shipment.",
          "We'll email tracking as soon as the carrier hands us the link.",
        ],
        primaryAction: portalAction,
        secondaryAction: accountAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "While you wait",
        highlightLines: [
          "Your PDF stays available in your order page.",
          "Reply here if anything needs a second look before the book arrives.",
        ],
        footerNote: `Questions? Reply here or email ${supportEmail}.`,
        tone: "sky",
      };
    case "order-shipped":
      return {
        subject: `${BRAND_NAME}: your book is on the way`,
        preheader: "Your coloring book is on the way.",
        eyebrow: "Shipping update",
        title: "Your book is on the way",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `Your printed coloring book has shipped${childLine}.`,
          input.trackingUrl?.trim()
            ? "Use the tracking button below for the latest scan, or open your order page if you need anything."
            : "Open your order page for the latest shipping updates.",
        ],
        primaryAction: input.trackingUrl?.trim()
          ? {
              label: "Track my package",
              href: input.trackingUrl,
            }
          : portalAction,
        secondaryAction: input.trackingUrl?.trim() ? portalAction : accountAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "Need help fast?",
        highlightLines: ['The "Get help" button on your order page opens a support ticket directly.'],
        footerNote: `Need help? Reply here or email ${supportEmail}.`,
        tone: "sky",
      };
    case "order-delivered":
      return {
        subject: `${BRAND_NAME}: your book shows as delivered`,
        preheader: "It should be at your door or in the mailbox.",
        eyebrow: "Delivery update",
        title: "Your book shows as delivered",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `Your printed coloring book shows as delivered${childLine}.`,
          "If anything looks off when you open it, reply here and we'll help make it right.",
          "Your order page and downloads stay available whenever you need them.",
        ],
        primaryAction: portalAction,
        secondaryAction: accountAction,
        details: buildLifecycleDetails(input),
        highlightTitle: "If anything looks off",
        highlightLines: [
          "Reply to this email and a real person will help.",
          "Your order page is still the fastest place to check files and support options.",
        ],
        footerNote: `Need help? Reply here or email ${supportEmail}.`,
        tone: "coral",
      };
    case "account-welcome": {
      const accountLink = input.magicLinkUrl ?? input.accountUrl ?? input.portalUrl;

      return {
        subject: `${BRAND_NAME}: your account is ready`,
        preheader: "No password to remember.",
        eyebrow: "Account ready",
        title: "Your account is ready",
        greeting: greeting(input.customerFirstName),
        paragraphs: [
          `We set up a ${BRAND_NAME} account under ${input.to} so you can check on this order, re-download files later, and get help fast if anything needs a second look.`,
          "Each sign-in sends a one-time code to your email, so there's no password to remember.",
        ],
        primaryAction: {
          label: "Sign in to my account",
          href: accountLink,
        },
        secondaryAction: portalAction,
        details: [
          {
            label: "Email",
            value: input.to,
          },
          ...buildLifecycleDetails(input),
        ],
        highlightTitle: "Your account gives you",
        highlightLines: [
          "One place for this order and future books",
          "Easy re-downloads later",
          "A faster support path if anything is off",
        ],
        footerNote: `Need help? Reply here or email ${supportEmail}.`,
        tone: "sky",
      };
    }
  }
}

function renderLifecycleText(view: LifecycleEmailView) {
  const sections = [
    view.greeting,
    view.title,
    ...view.paragraphs,
    view.details.length > 0 ? view.details.map((detail) => `${detail.label}: ${detail.value}`).join("\n") : "",
    `${view.primaryAction.label}: ${view.primaryAction.href}`,
    view.secondaryAction ? `${view.secondaryAction.label}: ${view.secondaryAction.href}` : "",
    view.highlightTitle && view.highlightLines?.length
      ? `${view.highlightTitle}\n- ${view.highlightLines.join("\n- ")}`
      : "",
    view.footerNote,
  ];

  return sections.filter(Boolean).join("\n\n");
}

function renderLifecycleHtml(view: LifecycleEmailView, supportEmail: string): string {
  const tone = toneStyles(view.tone);
  const paragraphsHtml = view.paragraphs
    .map(
      (paragraph) =>
        `<tr><td style="padding:0 0 14px;font-size:16px;line-height:1.65;color:#3D2B23;">${escapeHtml(paragraph)}</td></tr>`,
    )
    .join("");
  const detailRowsHtml = view.details
    .map((detail, index) => {
      const border = index === 0 ? "none" : "1px solid #EBDCCF";
      return `<tr>
  <td style="padding:14px 18px;border-top:${border};font-size:12px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#7D4D3B;font-weight:700;width:110px;">${escapeHtml(detail.label)}</td>
  <td style="padding:14px 18px;border-top:${border};font-size:15px;line-height:1.5;color:#241813;">${escapeHtml(detail.value)}</td>
</tr>`;
    })
    .join("");
  const highlightHtml =
    view.highlightTitle && view.highlightLines?.length
      ? `<tr><td style="padding:18px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${tone.panelBackground};border:1px solid ${tone.panelBorder};border-radius:24px;">
    <tr><td style="padding:18px 20px 8px;font-size:14px;line-height:1.4;font-weight:700;color:#241813;">${escapeHtml(view.highlightTitle)}</td></tr>
    ${view.highlightLines
      .map(
        (line, index) => `<tr>
      <td style="padding:${index === view.highlightLines!.length - 1 ? "0 20px 18px" : "0 20px 12px"};font-size:15px;line-height:1.6;color:#3D2B23;">
        <span style="color:#D95B42;font-weight:700;padding-right:8px;">&bull;</span>${escapeHtml(line)}
      </td>
    </tr>`,
      )
      .join("")}
  </table>
</td></tr>`
      : "";
  const secondaryActionHtml = view.secondaryAction
    ? `<tr><td style="padding:14px 0 0;font-size:14px;line-height:1.5;color:#7D4D3B;">
  Prefer the signed-in view? <a href="${escapeHtml(view.secondaryAction.href)}" style="color:#7D4D3B;font-weight:700;text-decoration:underline;">${escapeHtml(view.secondaryAction.label)}</a>
</td></tr>`
    : "";
  const footerHtml = escapeHtml(view.footerNote).replace(
    escapeHtml(supportEmail),
    `<a href="mailto:${escapeHtml(supportEmail)}" style="color:#7D4D3B;text-decoration:underline;">${escapeHtml(supportEmail)}</a>`,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(view.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#FFF8F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#241813;">
    <div style="display:none;opacity:0;visibility:hidden;height:0;overflow:hidden;">${escapeHtml(view.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#FFF8F2;">
      <tr>
        <td align="center" style="padding:28px 12px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
            <tr>
              <td style="padding:0 4px 18px;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:33px;line-height:1;color:#241813;font-weight:700;">${BRAND_NAME}</div>
                <div style="margin-top:10px;width:104px;height:4px;border-radius:999px;background:#D95B42;"></div>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFDFC;border:1px solid #F0E6DA;border-radius:32px;padding:32px 28px;box-shadow:0 18px 48px rgba(125,77,59,0.14);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:0 0 14px;">
                      <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:${tone.pillBackground};color:${tone.pillText};font-size:12px;line-height:1.2;letter-spacing:0.08em;text-transform:uppercase;font-weight:800;">
                        ${escapeHtml(view.eyebrow)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.02;color:#241813;font-weight:700;">
                      ${escapeHtml(view.title)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 14px;font-size:16px;line-height:1.65;color:#3D2B23;">${escapeHtml(view.greeting)}</td>
                  </tr>
                  ${paragraphsHtml}
                  <tr>
                    <td style="padding:10px 0 0;">
                      <a href="${escapeHtml(view.primaryAction.href)}" style="display:inline-block;background:#D95B42;color:#FFFFFF;text-decoration:none;padding:15px 24px;border-radius:999px;font-size:16px;line-height:1.2;font-weight:800;min-width:220px;text-align:center;">
                        ${escapeHtml(view.primaryAction.label)}
                      </a>
                    </td>
                  </tr>
                  ${secondaryActionHtml}
                  <tr>
                    <td style="padding:22px 0 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F1E6;border-radius:24px;">
                        ${detailRowsHtml}
                      </table>
                    </td>
                  </tr>
                  ${highlightHtml}
                  <tr>
                    <td style="padding:20px 0 0;font-size:14px;line-height:1.65;color:#7D4D3B;border-top:1px solid #F0E6DA;">
                      ${footerHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderLifecycleEmail(input: LifecycleEmailInput): LifecycleEmailPayload {
  const supportEmail = input.supportEmail ?? "support@littlecolorbook.com";
  const view = buildLifecycleEmailView(input, supportEmail);

  return {
    subject: view.subject,
    text: renderLifecycleText(view),
    html: renderLifecycleHtml(view, supportEmail),
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
