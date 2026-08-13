import { describe, it, expect } from "vitest";
import { renderEmail } from "./email";

/**
 * QA-07-F10 (docs/qa-report-phase7.md). Template values were interpolated into
 * HTML unescaped, and several of them are not ours: `name` is whatever the
 * buyer typed into Lemon Squeezy's checkout, and it reaches the welcome and
 * payment-received templates. The payoff for an attacker is a working phishing
 * link inside a genuine, correctly-authenticated email from our own domain.
 */
describe("renderEmail escaping", () => {
  it("escapes a buyer-supplied name instead of rendering it as markup", () => {
    const { html } = renderEmail("welcome-set-password", {
      name: '<a href="https://evil.example">click here to verify</a>',
      setPasswordUrl: "https://example.test/set-password?token=abc",
    });

    expect(html).not.toContain("<a href=\"https://evil.example\"");
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
  });

  it("escapes a script tag in a name", () => {
    const { html } = renderEmail("payment-received", {
      name: "<script>alert(1)</script>",
      portalUrl: "https://example.test/portal",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("stops a URL value breaking out of its href attribute", () => {
    const { html } = renderEmail("password-reset", {
      name: "",
      resetUrl: 'https://example.test/x" onmouseover="steal()',
    });

    expect(html).not.toContain('" onmouseover="');
    expect(html).toContain("&quot; onmouseover=&quot;");
  });

  it("escapes an admin-authored update title in the body", () => {
    const { html } = renderEmail("update-published", {
      title: "Fees <b>doubled</b> & rules changed",
      name: "Sam",
      updatesUrl: "https://example.test/portal/updates",
    });

    expect(html).toContain("Fees &lt;b&gt;doubled&lt;/b&gt; &amp; rules changed");
  });

  it("leaves the subject as plain text — escaping there would show up literally in an inbox", () => {
    const { subject } = renderEmail("update-published", {
      title: "Fees & rules changed",
      name: "Sam",
      updatesUrl: "https://example.test/portal/updates",
    });

    expect(subject).toBe("New update: Fees & rules changed");
  });

  it("escapes the unsubscribe URL in the appended footer", () => {
    const { html } = renderEmail("nurture-guide-offer", {
      guideUrl: "https://example.test/guide",
      unsubscribeUrl: 'https://example.test/unsubscribe?token=a"><script>x</script>',
    });

    expect(html).toContain("Unsubscribe");
    expect(html).not.toContain("<script>x</script>");
  });

  it("still renders ordinary values untouched", () => {
    const { subject, html } = renderEmail("welcome-set-password", {
      name: "Jane",
      setPasswordUrl: "https://example.test/set-password?token=abc123",
    });

    expect(subject).toBe("Set your password to access your guide");
    expect(html).toContain("Hi Jane,");
    expect(html).toContain('href="https://example.test/set-password?token=abc123"');
  });
});

/**
 * Member email consent: the notification has to carry the way out of it, the
 * same way every lead email carries an unsubscribe link.
 */
describe("update-published opt-out link", () => {
  it("links to the account page where the notification can be turned off", () => {
    const { html } = renderEmail("update-published", {
      title: "New fee schedule",
      name: "Sam",
      updatesUrl: "https://example.test/portal/updates",
      accountUrl: "https://example.test/portal/account",
    });

    expect(html).toContain('href="https://example.test/portal/account"');
    expect(html).toContain("turn these emails off");
    // And says the obvious thing, so nobody reads the opt-out as cancelling.
    expect(html).toContain("without losing access");
  });
});
