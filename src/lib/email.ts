import { Resend } from "resend";

export type EmailTemplate = "welcome-set-password" | "password-reset" | "payment-received";

interface SendEmailArgs {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
}

function renderEmail(template: EmailTemplate, data: Record<string, string>): { subject: string; html: string } {
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
