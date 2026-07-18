import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordTokens } from "@/db/schema";

export type TokenPurpose = "set" | "reset";

const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  set: 7 * 24 * 60 * 60 * 1000, // 7 days
  reset: 60 * 60 * 1000, // 1 hour
};

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Creates a token and returns the raw value — only the raw value ever goes in an email link. */
export async function createPasswordToken(userId: number, purpose: TokenPurpose): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);

  await db.insert(passwordTokens).values({
    userId,
    tokenHash: hashToken(raw),
    purpose,
    expiresAt,
  });

  return raw;
}

/**
 * Verifies and single-use-consumes a token, returning the associated userId
 * (or null if invalid/expired/already used). Consuming a valid token also
 * invalidates any other open tokens for that user.
 */
export async function consumePasswordToken(raw: string, purpose: TokenPurpose): Promise<number | null> {
  const tokenHash = hashToken(raw);

  const [token] = await db
    .select()
    .from(passwordTokens)
    .where(and(eq(passwordTokens.tokenHash, tokenHash), eq(passwordTokens.purpose, purpose)));

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await db
    .update(passwordTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordTokens.userId, token.userId), isNull(passwordTokens.usedAt)));

  return token.userId;
}
