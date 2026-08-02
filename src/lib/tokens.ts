import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordTokens } from "@/db/schema";

export type TokenPurpose = "set" | "reset";

const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  set: 7 * 24 * 60 * 60 * 1000, // 7 days
  reset: 60 * 60 * 1000, // 1 hour
};

export type PasswordTokenRecord = {
  userId: number;
  tokenHash: string;
  purpose: TokenPurpose;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * The token table, behind an interface so the single-use semantics can be
 * tested without a database. `drizzleTokenStore` below is the real one.
 */
export interface TokenStore {
  insert(token: PasswordTokenRecord): Promise<void>;
  findByHashAndPurpose(tokenHash: string, purpose: TokenPurpose): Promise<PasswordTokenRecord | null>;
  /** Marks every still-open token for this user as used. */
  markAllUsedForUser(userId: number, usedAt: Date): Promise<void>;
}

export const drizzleTokenStore: TokenStore = {
  async insert({ userId, tokenHash, purpose, expiresAt }) {
    await db.insert(passwordTokens).values({ userId, tokenHash, purpose, expiresAt });
  },

  async findByHashAndPurpose(tokenHash, purpose) {
    const [row] = await db
      .select()
      .from(passwordTokens)
      .where(and(eq(passwordTokens.tokenHash, tokenHash), eq(passwordTokens.purpose, purpose)));
    if (!row) return null;
    return {
      userId: row.userId,
      tokenHash: row.tokenHash,
      purpose: row.purpose as TokenPurpose,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
    };
  },

  async markAllUsedForUser(userId, usedAt) {
    await db
      .update(passwordTokens)
      .set({ usedAt })
      .where(and(eq(passwordTokens.userId, userId), isNull(passwordTokens.usedAt)));
  },
};

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Creates a token and returns the raw value — only the raw value ever goes in an email link. */
export async function createPasswordToken(
  userId: number,
  purpose: TokenPurpose,
  store: TokenStore = drizzleTokenStore,
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);

  await store.insert({ userId, tokenHash: hashToken(raw), purpose, expiresAt, usedAt: null });

  return raw;
}

/**
 * Verifies and single-use-consumes a token, returning the associated userId
 * (or null if invalid/expired/already used). Consuming a valid token also
 * invalidates any other open tokens for that user.
 */
export async function consumePasswordToken(
  raw: string,
  purpose: TokenPurpose,
  store: TokenStore = drizzleTokenStore,
): Promise<number | null> {
  const token = await store.findByHashAndPurpose(hashToken(raw), purpose);

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await store.markAllUsedForUser(token.userId, new Date());

  return token.userId;
}
