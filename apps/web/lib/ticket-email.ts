import "server-only";

import type { TicketRow } from "@littlecolorbook/db";
import { getEmailEnv, getSupportEmailAddress, isEmailConfigured } from "@littlecolorbook/shared/env";
import { getAppUrl } from "./stripe";

function getSupportEmail() {
  return getSupportEmailAddress();
}

async function resendSend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY not configured");
    }
    return { provider: "stub", messageId: null };
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
    throw new Error(`Resend ticket email failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { id?: string };
  return { provider: "resend", messageId: data.id ?? null };
}

function ticketUrl(ticketId: string) {
  return `${getAppUrl()}/account/tickets/${ticketId}`;
}

function adminTicketUrl(ticketId: string) {
  return `${getAppUrl()}/admin/tickets/${ticketId}`;
}

function textShell(body: string) {
  return body;
}

function htmlShell(title: string, inner: string, preheader: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#fffaf5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#211915;">
<div style="display:none;opacity:0;visibility:hidden;height:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:24px 20px;">
${inner}
</table>
</body></html>`;
}

export async function sendTicketReceivedEmail(input: {
  to: string;
  firstName: string | null;
  ticket: TicketRow;
}) {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const link = ticketUrl(input.ticket.id);
  const subject = "We got your message";
  const preheader = "We'll reply within 24 hours — usually much faster.";
  const text = `${greeting}

We got your message and we're on it. Here's what you sent:

Subject: ${input.ticket.subject}
Category: ${input.ticket.category.replace(/_/g, " ")}

You can follow the conversation here: ${link}

We reply within 24 hours. Usually faster.

— The Little Color Book team`;
  const inner = `
<tr><td style="padding:0 0 14px;font-size:16px;">${greeting}</td></tr>
<tr><td style="padding:0 0 14px;font-size:16px;">We got your message and we're on it.</td></tr>
<tr><td style="padding:0 0 14px;">
  <p style="margin:0 0 4px;"><strong>Subject:</strong> ${input.ticket.subject}</p>
  <p style="margin:0;"><strong>Category:</strong> ${input.ticket.category.replace(/_/g, " ")}</p>
</td></tr>
<tr><td style="padding:14px 0 18px;">
  <a href="${link}" style="background:#ff6b57;color:#fff;padding:14px 22px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">View your ticket</a>
</td></tr>
<tr><td style="padding:0 0 14px;font-size:14px;color:#8f7a68;">We reply within 24 hours — usually faster.</td></tr>
<tr><td style="padding:0 0 14px;">— The Little Color Book team</td></tr>`;

  return resendSend({ to: input.to, subject, text: textShell(text), html: htmlShell(subject, inner, preheader) });
}

export async function sendAdminNewTicketEmail(input: {
  ticket: TicketRow;
  customerEmail: string;
  firstMessage: string;
}) {
  const link = adminTicketUrl(input.ticket.id);
  const subject = `[ticket] ${input.ticket.category.replace(/_/g, " ")} — ${input.ticket.subject}`;
  const text = `New ticket from ${input.customerEmail}

${input.ticket.subject}
Category: ${input.ticket.category}
Priority: ${input.ticket.priority}
Order: ${input.ticket.orderId ?? "(none)"}

Message:
${input.firstMessage}

Respond: ${link}

SLA: first response due ${input.ticket.firstResponseDueAt?.toISOString() ?? "n/a"}`;
  const inner = `
<tr><td style="padding:0 0 10px;font-size:14px;color:#8f7a68;">New ticket</td></tr>
<tr><td style="padding:0 0 14px;font-size:18px;"><strong>${input.ticket.subject}</strong></td></tr>
<tr><td style="padding:0 0 14px;font-size:14px;">
  <p style="margin:0 0 4px;"><strong>From:</strong> ${input.customerEmail}</p>
  <p style="margin:0 0 4px;"><strong>Category:</strong> ${input.ticket.category}</p>
  <p style="margin:0 0 4px;"><strong>Priority:</strong> ${input.ticket.priority}</p>
  <p style="margin:0 0 4px;"><strong>Order:</strong> ${input.ticket.orderId ?? "(none)"}</p>
  <p style="margin:0;"><strong>SLA due:</strong> ${input.ticket.firstResponseDueAt?.toISOString() ?? "n/a"}</p>
</td></tr>
<tr><td style="padding:10px 0 14px;background:#f8f1e6;border-radius:8px;padding:16px;white-space:pre-wrap;">${input.firstMessage}</td></tr>
<tr><td style="padding:14px 0 18px;">
  <a href="${link}" style="background:#ff6b57;color:#fff;padding:12px 20px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">Open in admin</a>
</td></tr>`;
  return resendSend({
    to: getSupportEmail(),
    subject,
    text: textShell(text),
    html: htmlShell(subject, inner, `${input.ticket.category} ticket from ${input.customerEmail}`),
  });
}

export async function sendTicketAdminRepliedEmail(input: {
  to: string;
  firstName: string | null;
  ticket: TicketRow;
  replyBody: string;
}) {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const link = ticketUrl(input.ticket.id);
  const subject = `Re: ${input.ticket.subject}`;
  const preheader = "We replied — tap through to read and respond.";
  const text = `${greeting}

We replied on your ticket "${input.ticket.subject}".

${input.replyBody}

Reply or view the thread: ${link}

— The Little Color Book team`;
  const inner = `
<tr><td style="padding:0 0 14px;font-size:16px;">${greeting}</td></tr>
<tr><td style="padding:0 0 14px;font-size:16px;">We replied on your ticket.</td></tr>
<tr><td style="padding:10px 0 14px;background:#fff5e4;border-radius:8px;padding:16px;white-space:pre-wrap;">${input.replyBody}</td></tr>
<tr><td style="padding:14px 0 18px;">
  <a href="${link}" style="background:#ff6b57;color:#fff;padding:14px 22px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">Reply or read the full thread</a>
</td></tr>
<tr><td style="padding:0 0 14px;">— The Little Color Book team</td></tr>`;
  return resendSend({ to: input.to, subject, text: textShell(text), html: htmlShell(subject, inner, preheader) });
}

export async function sendTicketResolvedEmail(input: {
  to: string;
  firstName: string | null;
  ticket: TicketRow;
}) {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const link = ticketUrl(input.ticket.id);
  const subject = `Resolved: ${input.ticket.subject}`;
  const preheader = "Anything we missed? Hit reply.";
  const text = `${greeting}

We marked this one resolved: "${input.ticket.subject}"

If we missed something, reply to this email or reopen the ticket here: ${link}

Thanks for working through it with us.

— The Little Color Book team`;
  const inner = `
<tr><td style="padding:0 0 14px;font-size:16px;">${greeting}</td></tr>
<tr><td style="padding:0 0 14px;font-size:16px;">We marked this one <strong>resolved</strong>.</td></tr>
<tr><td style="padding:0 0 14px;font-size:14px;color:#8f7a68;">If we missed something, just reply to this email or reopen the ticket.</td></tr>
<tr><td style="padding:14px 0 18px;">
  <a href="${link}" style="background:#ff6b57;color:#fff;padding:14px 22px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">View ticket</a>
</td></tr>
<tr><td style="padding:0 0 14px;">— The Little Color Book team</td></tr>`;
  return resendSend({ to: input.to, subject, text: textShell(text), html: htmlShell(subject, inner, preheader) });
}

export async function sendTicketReviewRequestEmail(input: {
  to: string;
  firstName: string | null;
  ticket: TicketRow;
}) {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const link = ticketUrl(input.ticket.id);
  const subject = "Quick favor — how did we do?";
  const preheader = "One line, however honest you want to be.";
  const text = `${greeting}

We closed out your ticket. Before you go — how'd we do?

If we got it right: a reply saying so (or a line on Google / Trustpilot / wherever) means the world to a tiny team.

If we didn't: tell me what we missed. I read every one.

— The Little Color Book team

You can always reopen the ticket here: ${link}`;
  const inner = `
<tr><td style="padding:0 0 14px;font-size:16px;">${greeting}</td></tr>
<tr><td style="padding:0 0 14px;font-size:16px;">We closed out your ticket. Quick favor — how'd we do?</td></tr>
<tr><td style="padding:0 0 14px;font-size:14px;">If we got it right, a reply (or a line on Google / Trustpilot) means the world to a tiny team. If we didn't — tell me. I read every one.</td></tr>
<tr><td style="padding:14px 0 18px;">
  <a href="${link}" style="background:#ff6b57;color:#fff;padding:14px 22px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">Leave a reply</a>
</td></tr>
<tr><td style="padding:0 0 14px;">— The Little Color Book team</td></tr>`;
  return resendSend({ to: input.to, subject, text: textShell(text), html: htmlShell(subject, inner, preheader) });
}

export async function sendAdminSlaBreachEmail(input: {
  tickets: Array<{ id: string; subject: string; customerEmail: string; category: string; firstResponseDueAt: Date | null }>;
}) {
  const subject = `[sla] ${input.tickets.length} ticket(s) need a first response`;
  const rows = input.tickets
    .map(
      (t) =>
        `<tr><td style="padding:6px 0;font-size:14px;"><a href="${adminTicketUrl(t.id)}">${t.subject}</a><br/><span style="color:#8f7a68;">${t.customerEmail} · ${t.category}</span></td></tr>`,
    )
    .join("");
  const text = input.tickets
    .map((t) => `${t.subject} — ${t.customerEmail} — ${adminTicketUrl(t.id)}`)
    .join("\n");
  const inner = `
<tr><td style="padding:0 0 10px;font-size:14px;color:#c85a4a;"><strong>${input.tickets.length} ticket(s) past SLA</strong></td></tr>
<tr><td style="padding:0 0 14px;font-size:14px;">First-response due window (24h) has passed. Respond today.</td></tr>
${rows}`;
  return resendSend({
    to: getSupportEmail(),
    subject,
    text: textShell(text),
    html: htmlShell(subject, inner, "SLA breach — tickets need first response"),
  });
}
