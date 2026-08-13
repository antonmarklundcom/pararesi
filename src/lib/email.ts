import { Resend } from "resend";

export type EmailTemplate =
  | "welcome-set-password"
  | "password-reset"
  | "payment-received"
  | "confirm-subscription"
  // The C2 nurture sequence. Only ever sent by the cron endpoint, and only to
  // confirmed, non-unsubscribed leads — see src/lib/nurture.ts.
  | "nurture-cost-breakdown"
  | "nurture-three-mistakes"
  | "nurture-guide-offer"
  // Sent once per published update post, to the members entitled to read it.
  | "update-published";

interface SendEmailArgs {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
}

/**
 * Every template below interpolates straight into HTML, and several of the
 * values are not ours: `name` is whatever the buyer typed into Lemon Squeezy's
 * checkout, `title` is admin-authored, and the URLs are built from env vars.
 * Escaping the whole data record once, here, is what makes that safe — an
 * unescaped `name` of `<a href="…">` produces a working phishing link inside a
 * genuine, correctly-signed transactional email from our own domain.
 *
 * Escaping applies to URLs too: `&` becomes `&amp;` in an href, which is the
 * correct HTML encoding and is decoded back by every mail client, while the
 * quote escaping is what stops a value breaking out of the attribute.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAll(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escapeHtml(String(value ?? ""))]));
}

/**
 * Every email sent to a marketing lead (as opposed to a paying customer's
 * transactional mail) carries an unsubscribe link. Callers pass
 * `data.unsubscribeUrl` and this footer is appended automatically, so a new
 * template can't accidentally ship without one — see src/lib/lead-email.ts.
 */
function unsubscribeFooter(unsubscribeUrl: string): string {
  return `
          <p style="margin-top:32px;font-size:12px;color:#6b7280">
            Don&rsquo;t want these? <a href="${unsubscribeUrl}">Unsubscribe</a> — one click, no questions.
          </p>
        `;
}

export function renderEmail(
  template: EmailTemplate,
  data: Record<string, string>,
): { subject: string; html: string } {
  const safe = escapeAll(data);
  // Subjects are plain text, so they take the raw values — escaping there would
  // put a literal "&amp;" in the recipient's inbox list.
  const { subject, html } = renderTemplate(template, safe, data);
  return {
    subject,
    html: safe.unsubscribeUrl ? `${html}${unsubscribeFooter(safe.unsubscribeUrl)}` : html,
  };
}

function renderTemplate(
  template: EmailTemplate,
  data: Record<string, string>,
  raw: Record<string, string>,
): { subject: string; html: string } {
  switch (template) {
    case "welcome-set-password":
      return {
        subject: "Set your password to access your guide",
        html: `
          <p>Hi${data.name ? ` ${data.name}` : ""},</p>
          <p>Thanks for your purchase! Set a password to access your members area:</p>
          <p><a href="${data.setPasswordUrl}">${data.setPasswordUrl}</a></p>
          <p>This link expires in 7 days.</p>
        `,
      };
    case "password-reset":
      return {
        subject: "Reset your password",
        html: `
          <p>Hi${data.name ? ` ${data.name}` : ""},</p>
          <p>Someone requested a password reset for your account. If this was you, click below:</p>
          <p><a href="${data.resetUrl}">${data.resetUrl}</a></p>
          <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        `,
      };
    case "payment-received":
      return {
        subject: "Payment received",
        html: `
          <p>Hi${data.name ? ` ${data.name}` : ""},</p>
          <p>We've received your payment${data.productName ? ` for ${data.productName}` : ""}.</p>
          <p>Log in to your account to access it: <a href="${data.portalUrl}">${data.portalUrl}</a></p>
        `,
      };
    case "confirm-subscription":
      return {
        subject: "Confirm your email to get the residency checklist",
        html: `
          <p>Hi${data.name ? ` ${data.name}` : ""},</p>
          <p>Someone asked for the Paraguay residency document checklist with this address. If that was you, confirm below and we'll send it over:</p>
          <p><a href="${data.confirmUrl}">${data.confirmUrl}</a></p>
          <p>This link expires in 7 days. If you didn't request this, you can ignore this email — nothing else will be sent.</p>
        `,
      };
    // --- Nurture sequence (day 2 / 4 / 6 after confirmation) ---
    //
    // Deliberately free of specific fee figures: official costs change, and an
    // email nobody can update after it's sent is the worst place to put a
    // number. The structure is the useful part; the current figures live in the
    // guide, which does get updated.
    case "nurture-cost-breakdown":
      return {
        subject: "What Paraguay residency actually costs",
        html: `
          <p>Most cost questions about Paraguayan residency get answered with one number, which is why the answers never agree. It isn't one number — it's five line items:</p>
          <ol>
            <li><strong>Documents from home.</strong> Birth certificate, police record, and any marriage certificate — plus apostilles on each, and a sworn translation once they're in Paraguay.</li>
            <li><strong>Official fees.</strong> The filing itself, paid in-country, in stages rather than all at once.</li>
            <li><strong>Your proof of means.</strong> Whichever route you file under, this is money that has to sit somewhere provable, not money that's spent.</li>
            <li><strong>Help on the ground.</strong> Optional, and the widest-ranging item of the five: it depends entirely on how much of the running around you do yourself.</li>
            <li><strong>Being there.</strong> Flights and somewhere to stay for the appointments that need you in person.</li>
          </ol>
          <p>The first and last are the ones people underestimate. Documents expire — a police record that sat in a drawer for six months can be too old by the time it's filed, and paying for it twice is the most common avoidable cost in the whole process.</p>
          <p>More on the timing traps in a couple of days.</p>
        `,
      };
    case "nurture-three-mistakes":
      return {
        subject: "Three mistakes that add months to a residency file",
        html: `
          <p>None of these are exotic. They're just the ones that come up again and again:</p>
          <p><strong>1. Getting documents apostilled in the wrong order.</strong> An apostille certifies the document underneath it, so anything reissued afterwards invalidates the work. Reissue first, apostille last, translate in Paraguay.</p>
          <p><strong>2. Letting a validity window run out.</strong> Several of the documents you need have a shelf life, and it starts ticking at issue, not at filing. Collecting everything early feels organised right up to the point where the first item expires while you wait on the last.</p>
          <p><strong>3. Treating one forum post as current.</strong> Requirements and fees change, and old threads don't come with a date stamp on the advice. If a step matters, check it against something maintained.</p>
          <p>The pattern behind all three is the same: it's a sequencing problem, not a paperwork problem. Do it in the wrong order and you pay for the same documents twice.</p>
        `,
      };
    case "nurture-guide-offer":
      return {
        subject: "The whole process, in one place",
        html: `
          <p>Over the last few emails we've covered what residency costs and where the timeline usually goes wrong. Both are pieces of the same thing: the order you do it in.</p>
          <p>That's what the guide is — the whole process laid out step by step, in order, with the document checklist, the cost and timeline breakdown, and lifetime access to the members portal so updates don't cost extra.</p>
          <p><a href="${data.guideUrl}">See what's inside</a></p>
          <p>If you'd rather keep researching it yourself, that's genuinely fine — the checklist you already have is the same one we use. This is just the shortcut.</p>
          <p style="font-size:12px;color:#6b7280">This is an independent information product, not legal or immigration advice.</p>
        `,
      };
    case "update-published":
      return {
        subject: `New update: ${raw.title}`,
        html: `
          <p>Hi${data.name ? ` ${data.name}` : ""},</p>
          <p>There's a new update in your members area:</p>
          <p><strong>${data.title}</strong></p>
          <p><a href="${data.updatesUrl}">Read it in the portal</a></p>
          <p style="font-size:12px;color:#6b7280">You're getting this because your membership includes the updates feed. Manage your subscription from your account page.</p>
        `,
      };
  }
}

// Resend transport. Until RESEND_API_KEY is set, emails log to console so
// auth/purchase flows are fully testable in dev without a provider account.
export async function sendEmail({ to, template, data }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email:${template}] to=${to}`, data);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM must be set when RESEND_API_KEY is set.");
  }

  const resend = new Resend(apiKey);
  const { subject, html } = renderEmail(template, data);

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Resend failed to send "${template}" to ${to}: ${error.message}`);
  }
}
