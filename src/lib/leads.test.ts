import { describe, it, expect, beforeEach } from "vitest";
import {
  confirmLeadByToken,
  isPlausibleEmail,
  leadRateLimitKeys,
  normalizeEmail,
  normalizeSource,
  unsubscribeLeadByToken,
  upsertLead,
  type LeadRecord,
  type LeadSource,
  type LeadStore,
} from "./leads";
import {
  createLeadConfirmToken,
  createLeadUnsubscribeToken,
  type LeadTokenPurpose,
  type LeadTokenRecord,
  type LeadTokenStore,
} from "./lead-tokens";

class MemoryLeadTokenStore implements LeadTokenStore {
  rows: LeadTokenRecord[] = [];

  async insert(token: LeadTokenRecord) {
    this.rows.push({ ...token });
  }

  async findByHash(tokenHash: string) {
    return this.rows.find((r) => r.tokenHash === tokenHash) ?? null;
  }

  async markAllUsedForLead(leadId: number, purpose: LeadTokenPurpose, usedAt: Date) {
    for (const row of this.rows) {
      if (row.leadId === leadId && row.purpose === purpose && row.usedAt === null) {
        row.usedAt = usedAt;
      }
    }
  }
}

class MemoryLeadStore implements LeadStore {
  rows: LeadRecord[] = [];
  private nextId = 1;

  async findByEmail(email: string) {
    return this.rows.find((r) => r.email === email) ?? null;
  }

  async findById(id: number) {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async insert({ email, source }: { email: string; source: LeadSource }) {
    if (this.rows.some((r) => r.email === email)) {
      // Mirrors the unique index on leads.email.
      throw new Error("Duplicate entry for key 'leads_email_unique'");
    }
    const row: LeadRecord = {
      id: this.nextId++,
      email,
      source,
      confirmedAt: null,
      unsubscribedAt: null,
    };
    this.rows.push(row);
    return { ...row };
  }

  async updateSource(id: number, source: LeadSource) {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.source = source;
  }

  async markConfirmed(id: number, confirmedAt: Date) {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.confirmedAt = confirmedAt;
      row.unsubscribedAt = null;
    }
  }

  async markUnsubscribed(id: number, unsubscribedAt: Date) {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.unsubscribedAt = unsubscribedAt;
  }
}

let leadStore: MemoryLeadStore;
let tokenStore: MemoryLeadTokenStore;

beforeEach(() => {
  leadStore = new MemoryLeadStore();
  tokenStore = new MemoryLeadTokenStore();
});

describe("normalizeEmail", () => {
  it("trims and lowercases, like the auth flows do", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  it("turns missing input into an empty string rather than throwing", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("isPlausibleEmail", () => {
  it.each(["a@b.co", "first.last+tag@sub.example.com"])("accepts %s", (email) => {
    expect(isPlausibleEmail(email)).toBe(true);
  });

  it.each(["", "no-at-sign", "a@b", "a@@b.co", "spaced out@example.com", "a@ b.co", "@example.com"])(
    "rejects %s",
    (email) => {
      expect(isPlausibleEmail(email)).toBe(false);
    },
  );

  it("rejects an address longer than the column allows", () => {
    expect(isPlausibleEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("normalizeSource", () => {
  it("keeps known sources", () => {
    expect(normalizeSource("home-hero")).toBe("home-hero");
    expect(normalizeSource("guide-page")).toBe("guide-page");
  });

  it("coerces anything unrecognised — the value comes from a form field", () => {
    expect(normalizeSource("<script>")).toBe("unknown");
    expect(normalizeSource(null)).toBe("unknown");
  });
});

describe("leadRateLimitKeys", () => {
  it("buckets separately per email and per IP", () => {
    const { emailKey, ipKey } = leadRateLimitKeys("ana@example.com", "203.0.113.7");
    expect(emailKey).toBe("subscribe:email:ana@example.com");
    expect(ipKey).toBe("subscribe:ip:203.0.113.7");
    expect(emailKey).not.toBe(ipKey);
  });
});

describe("upsertLead", () => {
  it("inserts a new lead as pending confirmation", async () => {
    const { lead, status } = await upsertLead("ana@example.com", "home-hero", leadStore);

    expect(status).toBe("new");
    expect(lead.confirmedAt).toBeNull();
    expect(leadStore.rows).toHaveLength(1);
  });

  it("is idempotent: resubmitting the same address neither errors nor duplicates", async () => {
    const first = await upsertLead("ana@example.com", "home-hero", leadStore);
    const second = await upsertLead("ana@example.com", "home-hero", leadStore);

    expect(second.status).toBe("pending");
    expect(second.lead.id).toBe(first.lead.id);
    expect(leadStore.rows).toHaveLength(1);
  });

  it("updates the recorded source when the same address signs up elsewhere", async () => {
    await upsertLead("ana@example.com", "home-hero", leadStore);
    const { lead } = await upsertLead("ana@example.com", "guide-page", leadStore);

    expect(lead.source).toBe("guide-page");
    expect(leadStore.rows[0].source).toBe("guide-page");
  });

  it("reports an already-confirmed subscriber so no second email is sent", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    await leadStore.markConfirmed(lead.id, new Date());

    expect((await upsertLead("ana@example.com", "home-hero", leadStore)).status).toBe("confirmed");
  });

  it("does not silently resubscribe an unsubscribed address", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    await leadStore.markConfirmed(lead.id, new Date());
    leadStore.rows[0].unsubscribedAt = new Date();

    const { status } = await upsertLead("ana@example.com", "home-hero", leadStore);

    // Pending, not confirmed: they are only opted back in by clicking the link.
    expect(status).toBe("pending");
    expect(leadStore.rows[0].unsubscribedAt).not.toBeNull();
  });
});

describe("confirmLeadByToken", () => {
  it("records the opt-in for a valid token", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    const token = await createLeadConfirmToken(lead.id, tokenStore);

    const confirmed = await confirmLeadByToken(token, leadStore, tokenStore);

    expect(confirmed?.email).toBe("ana@example.com");
    expect(leadStore.rows[0].confirmedAt).toBeInstanceOf(Date);
  });

  it("clears an earlier unsubscribe only on a real confirmation", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    leadStore.rows[0].unsubscribedAt = new Date();
    const token = await createLeadConfirmToken(lead.id, tokenStore);

    await confirmLeadByToken(token, leadStore, tokenStore);

    expect(leadStore.rows[0].unsubscribedAt).toBeNull();
  });

  it("keeps the original consent timestamp when confirming twice", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    const firstConsent = new Date("2026-01-01T00:00:00Z");
    await leadStore.markConfirmed(lead.id, firstConsent);

    const token = await createLeadConfirmToken(lead.id, tokenStore);
    await confirmLeadByToken(token, leadStore, tokenStore);

    expect(leadStore.rows[0].confirmedAt).toEqual(firstConsent);
  });

  it("rejects a reused token and leaves nothing confirmed", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    const token = await createLeadConfirmToken(lead.id, tokenStore);

    await confirmLeadByToken(token, leadStore, tokenStore);
    expect(await confirmLeadByToken(token, leadStore, tokenStore)).toBeNull();
  });

  it("rejects a garbage token", async () => {
    expect(await confirmLeadByToken("nope", leadStore, tokenStore)).toBeNull();
  });

  it("rejects a token whose lead row has since been deleted", async () => {
    const { lead } = await upsertLead("ana@example.com", "home-hero", leadStore);
    const token = await createLeadConfirmToken(lead.id, tokenStore);
    leadStore.rows = [];

    expect(await confirmLeadByToken(token, leadStore, tokenStore)).toBeNull();
  });
});

describe("unsubscribeLeadByToken", () => {
  async function confirmedLead(email = "ana@example.com") {
    const { lead } = await upsertLead(email, "home-hero", leadStore);
    await leadStore.markConfirmed(lead.id, new Date("2026-01-01T00:00:00Z"));
    return lead;
  }

  it("records the opt-out for a valid token", async () => {
    const lead = await confirmedLead();
    const token = await createLeadUnsubscribeToken(lead.id, tokenStore);

    const result = await unsubscribeLeadByToken(token, leadStore, tokenStore);

    expect(result?.email).toBe("ana@example.com");
    expect(leadStore.rows[0].unsubscribedAt).toBeInstanceOf(Date);
  });

  it("keeps the consent record — unsubscribing is not a deletion", async () => {
    const lead = await confirmedLead();
    const token = await createLeadUnsubscribeToken(lead.id, tokenStore);

    await unsubscribeLeadByToken(token, leadStore, tokenStore);

    expect(leadStore.rows[0].confirmedAt).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("is idempotent: clicking the same link twice still confirms, without moving the timestamp", async () => {
    const lead = await confirmedLead();
    const token = await createLeadUnsubscribeToken(lead.id, tokenStore);

    await unsubscribeLeadByToken(token, leadStore, tokenStore);
    const firstUnsubscribedAt = leadStore.rows[0].unsubscribedAt;

    const second = await unsubscribeLeadByToken(token, leadStore, tokenStore);

    expect(second?.email).toBe("ana@example.com");
    expect(leadStore.rows[0].unsubscribedAt).toEqual(firstUnsubscribedAt);
  });

  it("is idempotent across emails: an older email's link also just confirms", async () => {
    const lead = await confirmedLead();
    const fromDay0 = await createLeadUnsubscribeToken(lead.id, tokenStore);
    const fromDay2 = await createLeadUnsubscribeToken(lead.id, tokenStore);

    await unsubscribeLeadByToken(fromDay2, leadStore, tokenStore);
    const result = await unsubscribeLeadByToken(fromDay0, leadStore, tokenStore);

    expect(result?.email).toBe("ana@example.com");
  });

  it("does not opt out someone who resubscribed after using this link", async () => {
    const lead = await confirmedLead();
    const token = await createLeadUnsubscribeToken(lead.id, tokenStore);

    await unsubscribeLeadByToken(token, leadStore, tokenStore);
    // They came back through the double opt-in, which clears unsubscribedAt.
    await leadStore.markConfirmed(lead.id, new Date());

    expect(await unsubscribeLeadByToken(token, leadStore, tokenStore)).toBeNull();
    expect(leadStore.rows[0].unsubscribedAt).toBeNull();
  });

  it("rejects a garbage token", async () => {
    expect(await unsubscribeLeadByToken("nope", leadStore, tokenStore)).toBeNull();
  });

  it("rejects a confirm token — one link cannot do the other's job", async () => {
    const lead = await confirmedLead();
    const token = await createLeadConfirmToken(lead.id, tokenStore);

    expect(await unsubscribeLeadByToken(token, leadStore, tokenStore)).toBeNull();
    expect(leadStore.rows[0].unsubscribedAt).toBeNull();
  });

  it("rejects an expired token", async () => {
    const lead = await confirmedLead();
    const token = await createLeadUnsubscribeToken(lead.id, tokenStore);
    tokenStore.rows[0].expiresAt = new Date(Date.now() - 1000);

    expect(await unsubscribeLeadByToken(token, leadStore, tokenStore)).toBeNull();
  });

  it("rejects a token whose lead row has since been deleted", async () => {
    const lead = await confirmedLead();
    const token = await createLeadUnsubscribeToken(lead.id, tokenStore);
    leadStore.rows = [];

    expect(await unsubscribeLeadByToken(token, leadStore, tokenStore)).toBeNull();
  });

  it("only touches the lead the token belongs to", async () => {
    const mine = await confirmedLead("ana@example.com");
    await confirmedLead("bo@example.com");
    const token = await createLeadUnsubscribeToken(mine.id, tokenStore);

    await unsubscribeLeadByToken(token, leadStore, tokenStore);

    expect(leadStore.rows[1].unsubscribedAt).toBeNull();
  });
});
