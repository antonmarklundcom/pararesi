import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LeadRecord } from "@/lib/leads";

const unsubscribeLeadByToken = vi.fn<(token: string) => Promise<LeadRecord | null>>();

// The page is a thin wrapper around unsubscribeLeadByToken (already covered
// end to end, including expiry, in src/lib/leads.test.ts); mock it here to
// exercise what the page itself does with each outcome.
vi.mock("@/lib/leads", () => ({
  unsubscribeLeadByToken: (token: string) => unsubscribeLeadByToken(token),
}));

const { default: UnsubscribePage } = await import("@/app/(marketing)/unsubscribe/page");

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 1,
    email: "ana@example.com",
    source: "guide-page",
    confirmedAt: new Date("2026-08-01T00:00:00Z"),
    unsubscribedAt: null,
    ...overrides,
  };
}

async function render(token?: string) {
  const element = await UnsubscribePage({ searchParams: Promise.resolve({ token }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  unsubscribeLeadByToken.mockReset();
});

describe("UnsubscribePage token handling", () => {
  it("shows the unsubscribed confirmation for a valid token", async () => {
    unsubscribeLeadByToken.mockResolvedValue(lead({ email: "ana@example.com" }));

    const html = await render("valid-token");

    expect(unsubscribeLeadByToken).toHaveBeenCalledWith("valid-token");
    expect(html).toContain("You&#x27;re unsubscribed");
    expect(html).toContain("ana@example.com");
  });

  it("shows the failure message for an invalid token", async () => {
    unsubscribeLeadByToken.mockResolvedValue(null);

    const html = await render("bogus-token");

    expect(unsubscribeLeadByToken).toHaveBeenCalledWith("bogus-token");
    expect(html).toContain("This link didn&#x27;t work");
  });

  it("shows the failure message and never calls the store when the token is missing", async () => {
    const html = await render(undefined);

    expect(unsubscribeLeadByToken).not.toHaveBeenCalled();
    expect(html).toContain("This link didn&#x27;t work");
  });

  // An expired token is indistinguishable from an invalid one by the time it
  // reaches the page: consumeLeadUnsubscribeToken (see src/lib/lead-tokens.ts)
  // folds "expired" into the same null return as "never valid", so it renders
  // the same failure message. That mapping is covered directly in
  // src/lib/leads.test.ts ("unsubscribeLeadByToken" > expired token cases).
  it("treats an expired token the same as an invalid one", async () => {
    unsubscribeLeadByToken.mockResolvedValue(null);

    const html = await render("expired-token");

    expect(html).toContain("This link didn&#x27;t work");
  });
});
