import { describe, it, expect } from "vitest";
import {
  canNotifyAboutUpdate,
  updateNotifyRecipients,
  type NotifiableMember,
  type NotifiablePost,
} from "./update-notify";

const NOW = new Date("2026-08-13T12:00:00Z");
const YESTERDAY = new Date("2026-08-12T12:00:00Z");
const TOMORROW = new Date("2026-08-14T12:00:00Z");

function post(overrides: Partial<NotifiablePost> = {}): NotifiablePost {
  return {
    id: 1,
    title: "What changed in July",
    minTier: "insider",
    status: "published",
    publishedAt: YESTERDAY,
    notifiedAt: null,
    ...overrides,
  };
}

function member(overrides: Partial<NotifiableMember> = {}): NotifiableMember {
  return {
    id: 1,
    email: "member@example.com",
    name: null,
    tier: "insider",
    tierExpiresAt: TOMORROW,
    updateEmailsEnabled: true,
    ...overrides,
  };
}

describe("canNotifyAboutUpdate", () => {
  it("allows a published post that hasn't been announced", () => {
    expect(canNotifyAboutUpdate(post(), NOW)).toEqual({ ok: true });
  });

  it("refuses a draft", () => {
    expect(canNotifyAboutUpdate(post({ status: "draft" }), NOW)).toEqual({
      ok: false,
      reason: "not-published",
    });
  });

  it("refuses a post with no publish date", () => {
    expect(canNotifyAboutUpdate(post({ publishedAt: null }), NOW)).toEqual({
      ok: false,
      reason: "no-publish-date",
    });
  });

  it("refuses a post scheduled for the future", () => {
    expect(canNotifyAboutUpdate(post({ publishedAt: TOMORROW }), NOW)).toEqual({
      ok: false,
      reason: "publish-date-in-future",
    });
  });

  it("refuses a post that was already announced — the re-publish guard", () => {
    expect(canNotifyAboutUpdate(post({ notifiedAt: YESTERDAY }), NOW)).toEqual({
      ok: false,
      reason: "already-notified",
    });
  });

  it("keeps refusing after a notified post is unpublished and published again", () => {
    const republished = post({ notifiedAt: YESTERDAY, publishedAt: NOW });
    expect(canNotifyAboutUpdate(republished, NOW)).toEqual({
      ok: false,
      reason: "already-notified",
    });
  });

  it("treats a publish date exactly at now as due", () => {
    expect(canNotifyAboutUpdate(post({ publishedAt: NOW }), NOW).ok).toBe(true);
  });
});

describe("updateNotifyRecipients", () => {
  it("mails active insiders about an insider post", () => {
    const recipients = updateNotifyRecipients([member({ id: 1 })], post(), NOW);
    expect(recipients.map((r) => r.id)).toEqual([1]);
  });

  it("leaves out guide-tier and non-members on an insider post", () => {
    const recipients = updateNotifyRecipients(
      [
        member({ id: 1 }),
        member({ id: 2, tier: "guide", tierExpiresAt: null }),
        member({ id: 3, tier: "none", tierExpiresAt: null }),
      ],
      post(),
      NOW,
    );

    expect(recipients.map((r) => r.id)).toEqual([1]);
  });

  it("leaves out a lapsed insider even if the downgrade webhook never landed", () => {
    const recipients = updateNotifyRecipients(
      [member({ id: 1, tierExpiresAt: YESTERDAY })],
      post(),
      NOW,
    );

    expect(recipients).toEqual([]);
  });

  it("keeps an insider whose subscription expires later today", () => {
    const recipients = updateNotifyRecipients(
      [member({ id: 1, tierExpiresAt: new Date("2026-08-13T23:00:00Z") })],
      post(),
      NOW,
    );

    expect(recipients.map((r) => r.id)).toEqual([1]);
  });

  it("includes guide members on a guide-tier post", () => {
    const recipients = updateNotifyRecipients(
      [
        member({ id: 1 }),
        member({ id: 2, tier: "guide", tierExpiresAt: null }),
        member({ id: 3, tier: "none", tierExpiresAt: null }),
      ],
      post({ minTier: "guide" }),
      NOW,
    );

    expect(recipients.map((r) => r.id)).toEqual([1, 2]);
  });

  /**
   * Member email consent. Entitlement is not consent: paying for the updates
   * feed says a member may read it, not that they want an email whenever it
   * changes. Only this notification is affected — transactional mail does not
   * go through updateNotifyRecipients at all.
   */
  it("leaves out an entitled member who turned update emails off", () => {
    const recipients = updateNotifyRecipients(
      [member({ id: 1, updateEmailsEnabled: false })],
      post(),
      NOW,
    );

    expect(recipients).toEqual([]);
  });

  it("applies the opt-out independently of tier", () => {
    const recipients = updateNotifyRecipients(
      [
        member({ id: 1, updateEmailsEnabled: true }),
        member({ id: 2, updateEmailsEnabled: false }),
        member({ id: 3, tier: "guide", tierExpiresAt: null, updateEmailsEnabled: true }),
        member({ id: 4, tier: "guide", tierExpiresAt: null, updateEmailsEnabled: false }),
      ],
      post({ minTier: "guide" }),
      NOW,
    );

    expect(recipients.map((m) => m.id)).toEqual([1, 3]);
  });

  it("does not mail an opted-out member even on a post their tier covers exactly", () => {
    const recipients = updateNotifyRecipients(
      [member({ id: 1, tier: "insider", updateEmailsEnabled: false })],
      post({ minTier: "insider" }),
      NOW,
    );

    expect(recipients).toEqual([]);
  });

  it("keeps the opt-out and the entitlement check independent — neither rescues the other", () => {
    // Opted in but lapsed: still excluded, because consent is not access.
    const lapsedButWilling = updateNotifyRecipients(
      [member({ id: 1, tierExpiresAt: YESTERDAY, updateEmailsEnabled: true })],
      post(),
      NOW,
    );
    expect(lapsedButWilling).toEqual([]);

    // Entitled but opted out: still excluded, because access is not consent.
    const entitledButUnwilling = updateNotifyRecipients(
      [member({ id: 2, updateEmailsEnabled: false })],
      post(),
      NOW,
    );
    expect(entitledButUnwilling).toEqual([]);
  });

  it("returns nobody when there are no members", () => {
    expect(updateNotifyRecipients([], post(), NOW)).toEqual([]);
  });
});
