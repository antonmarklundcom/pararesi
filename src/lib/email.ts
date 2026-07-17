export type EmailTemplate = "welcome-set-password" | "password-reset" | "payment-received";

interface SendEmailArgs {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
}

// Resend implementation lands in Phase 3 (docs/02-architecture.md §6). Until
// RESEND_API_KEY is set, emails log to console so auth flows are fully
// testable in dev without an email provider account.
export async function sendEmail({ to, template, data }: SendEmailArgs): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:${template}] to=${to}`, data);
    return;
  }
  throw new Error("RESEND_API_KEY is set but the Resend transport is not implemented until Phase 3.");
}
