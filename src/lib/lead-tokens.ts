import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leadTokens } from "@/db/schema";

// Deliberately a separate mechanism from src/lib/tokens.ts: password tokens are
// keyed to a `users` row and their purposes carry account-takeover risk, so the
// two tables stay disjoint. The security properties are mirrored exactly —
// hashed at rest, single-use, expiring, and consuming one invalidates the
// lead's other open tokens.
const LEAD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type LeadTokenRecord = {
  leadId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * The lead_tokens table, behind an interface so the single-use semantics can be
 * tested without a database. `drizzleLeadTokenStore` below is the real one.
 */
export interface LeadTokenStore {
  insert(token: LeadTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<LeadTokenRecord | null>;
  /** Marks every still-open token for this lead as used. */
  markAllUsedForLead(leadId: number, usedAt: Date): Promise<void>;
}

export const drizzleLeadTokenStore: LeadTokenStore = {
  async insert({ leadId, tokenHash, expiresAt }) {
    await db.insert(leadTokens).values({ leadId, tokenHash, expiresAt });
  },

  async findByHash(tokenHash) {
    const [row] = await db.select().from(leadTokens).where(eq(leadTokens.tokenHash, tokenHash));
    if (!row) return null;
    return {
      leadId: row.leadId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
    };
  },

  async markAllUsedForLead(leadId, usedAt) {
    await db
      .update(leadTokens)
      .set({ usedAt })
      .where(and(eq(leadTokens.leadId, leadId), isNull(leadTokens.usedAt)));
  },
};

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Creates a token and returns the raw value — only the raw value ever goes in an email link. */
export async function createLeadConfirmToken(
  leadId: number,
  store: LeadTokenStore = drizzleLeadTokenStore,
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + LEAD_TOKEN_TTL_MS);

  await store.insert({ leadId, tokenHash: hashToken(raw), expiresAt, usedAt: null });

  return raw;
}

/**
 * Verifies and single-use-consumes a confirm token, returning the associated
 * leadId (or null if invalid/expired/already used). Consuming a valid token
 * also invalidates any other open tokens for that lead.
 */
export async function consumeLeadConfirmToken(
  raw: string,
  store: LeadTokenStore = drizzleLeadTokenStore,
): Promise<number | null> {
  const token = await store.findByHash(hashToken(raw));

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await store.markAllUsedForLead(token.leadId, new Date());

  return token.leadId;
}
