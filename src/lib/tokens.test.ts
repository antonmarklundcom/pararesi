import { describe, it, expect, beforeEach } from "vitest";
import {
  createPasswordToken,
  consumePasswordToken,
  type PasswordTokenRecord,
  type TokenPurpose,
  type TokenStore,
} from "./tokens";

class MemoryTokenStore implements TokenStore {
  rows: PasswordTokenRecord[] = [];

  async insert(token: PasswordTokenRecord) {
    this.rows.push({ ...token });
  }

  async findByHashAndPurpose(tokenHash: string, purpose: TokenPurpose) {
    return this.rows.find((r) => r.tokenHash === tokenHash && r.purpose === purpose) ?? null;
  }

  async markAllUsedForUser(userId: number, usedAt: Date) {
    for (const row of this.rows) {
      if (row.userId === userId && row.usedAt === null) row.usedAt = usedAt;
    }
  }
}

let store: MemoryTokenStore;

beforeEach(() => {
  store = new MemoryTokenStore();
});

describe("consumePasswordToken", () => {
  it("returns the userId for a fresh token", async () => {
    const raw = await createPasswordToken(42, "set", store);
    expect(await consumePasswordToken(raw, "set", store)).toBe(42);
  });

  it("is single-use: the second consume returns null", async () => {
    const raw = await createPasswordToken(42, "set", store);

    expect(await consumePasswordToken(raw, "set", store)).toBe(42);
    expect(await consumePasswordToken(raw, "set", store)).toBeNull();
  });

  it("never stores the raw token, only its sha256", async () => {
    const raw = await createPasswordToken(42, "set", store);
    expect(store.rows[0].tokenHash).not.toBe(raw);
    expect(store.rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("invalidates the user's other open tokens", async () => {
    const first = await createPasswordToken(42, "reset", store);
    const second = await createPasswordToken(42, "reset", store);

    expect(await consumePasswordToken(second, "reset", store)).toBe(42);
    expect(await consumePasswordToken(first, "reset", store)).toBeNull();
  });

  it("does not touch another user's tokens", async () => {
    const mine = await createPasswordToken(1, "reset", store);
    const theirs = await createPasswordToken(2, "reset", store);

    await consumePasswordToken(mine, "reset", store);

    expect(await consumePasswordToken(theirs, "reset", store)).toBe(2);
  });

  it("rejects an unknown token", async () => {
    await createPasswordToken(42, "set", store);
    expect(await consumePasswordToken("not-a-real-token", "set", store)).toBeNull();
  });

  it("rejects a token presented for the wrong purpose", async () => {
    const raw = await createPasswordToken(42, "set", store);
    expect(await consumePasswordToken(raw, "reset", store)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const raw = await createPasswordToken(42, "reset", store);
    store.rows[0].expiresAt = new Date(Date.now() - 1000);

    expect(await consumePasswordToken(raw, "reset", store)).toBeNull();
  });

  it("gives set tokens 7 days and reset tokens 1 hour", async () => {
    const before = Date.now();
    await createPasswordToken(1, "set", store);
    await createPasswordToken(2, "reset", store);
    const after = Date.now();

    // Bracket rather than pin: the token's clock reading sits somewhere in
    // [before, after], so the TTL does too.
    const setTtl = store.rows[0].expiresAt.getTime();
    const resetTtl = store.rows[1].expiresAt.getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const ONE_HOUR = 60 * 60 * 1000;

    expect(setTtl).toBeGreaterThanOrEqual(before + SEVEN_DAYS);
    expect(setTtl).toBeLessThanOrEqual(after + SEVEN_DAYS);
    expect(resetTtl).toBeGreaterThanOrEqual(before + ONE_HOUR);
    expect(resetTtl).toBeLessThanOrEqual(after + ONE_HOUR);
  });
});
