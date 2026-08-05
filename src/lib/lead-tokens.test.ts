import { describe, it, expect, beforeEach } from "vitest";
import {
  createLeadConfirmToken,
  consumeLeadConfirmToken,
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

  async markAllUsedForLead(leadId: number, usedAt: Date) {
    for (const row of this.rows) {
      if (row.leadId === leadId && row.usedAt === null) row.usedAt = usedAt;
    }
  }
}

let store: MemoryLeadTokenStore;

beforeEach(() => {
  store = new MemoryLeadTokenStore();
});

describe("consumeLeadConfirmToken", () => {
  it("returns the leadId for a fresh token", async () => {
    const raw = await createLeadConfirmToken(7, store);
    expect(await consumeLeadConfirmToken(raw, store)).toBe(7);
  });

  it("is single-use: the second consume returns null", async () => {
    const raw = await createLeadConfirmToken(7, store);

    expect(await consumeLeadConfirmToken(raw, store)).toBe(7);
    expect(await consumeLeadConfirmToken(raw, store)).toBeNull();
  });

  it("never stores the raw token, only its sha256", async () => {
    const raw = await createLeadConfirmToken(7, store);
    expect(store.rows[0].tokenHash).not.toBe(raw);
    expect(store.rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("invalidates the lead's other open tokens", async () => {
    const first = await createLeadConfirmToken(7, store);
    const second = await createLeadConfirmToken(7, store);

    expect(await consumeLeadConfirmToken(second, store)).toBe(7);
    expect(await consumeLeadConfirmToken(first, store)).toBeNull();
  });

  it("does not touch another lead's tokens", async () => {
    const mine = await createLeadConfirmToken(1, store);
    const theirs = await createLeadConfirmToken(2, store);

    await consumeLeadConfirmToken(mine, store);

    expect(await consumeLeadConfirmToken(theirs, store)).toBe(2);
  });

  it("rejects an unknown token", async () => {
    await createLeadConfirmToken(7, store);
    expect(await consumeLeadConfirmToken("not-a-real-token", store)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const raw = await createLeadConfirmToken(7, store);
    store.rows[0].expiresAt = new Date(Date.now() - 1000);

    expect(await consumeLeadConfirmToken(raw, store)).toBeNull();
  });

  it("gives confirm tokens 7 days", async () => {
    const before = Date.now();
    await createLeadConfirmToken(7, store);
    const after = Date.now();

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const ttl = store.rows[0].expiresAt.getTime();

    expect(ttl).toBeGreaterThanOrEqual(before + SEVEN_DAYS);
    expect(ttl).toBeLessThanOrEqual(after + SEVEN_DAYS);
  });
});
