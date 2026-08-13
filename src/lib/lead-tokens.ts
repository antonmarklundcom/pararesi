import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leadTokens } from "@/db/schema";

// Deliberately a separate mechanism from src/lib/tokens.ts: password tokens are
// keyed to a `users` row and their purposes carry account-takeover risk, so the
// two tables stay disjoint. The security properties are mirrored exactly —
// hashed at rest, single-use, expiring, and consuming one invalidates the
// lead's other open tokens of the same purpose.
const LEAD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Unsubscribe links live much longer than confirmation links: one is minted per
 * outbound email and has to still work whenever the recipient gets round to
 * clicking it. A dead unsubscribe link is a spam complaint, so the TTL is
 * generous rather than tight — the token grants nothing but an opt-out.
 */
const LEAD_UNSUBSCRIBE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export type LeadTokenPurpose = "confirm" | "unsubscribe";

export type LeadTokenRecord = {
  leadId: number;
  tokenHash: string;
  purpose: LeadTokenPurpose;
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
  /** Marks every still-open token of this purpose for this lead as used. */
  markAllUsedForLead(leadId: number, purpose: LeadTokenPurpose, usedAt: Date): Promise<void>;
}

export const drizzleLeadTokenStore: LeadTokenStore = {
  async insert({ leadId, tokenHash, purpose, expiresAt }) {
    await db.insert(leadTokens).values({ leadId, tokenHash, purpose, expiresAt });
  },

  async findByHash(tokenHash) {
    const [row] = await db.select().from(leadTokens).where(eq(leadTokens.tokenHash, tokenHash));
    if (!row) return null;
    return {
      leadId: row.leadId,
      tokenHash: row.tokenHash,
      purpose: row.purpose,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
    };
  },

  async markAllUsedForLead(leadId, purpose, usedAt) {
    await db
      .update(leadTokens)
      .set({ usedAt })
      .where(
        and(
          eq(leadTokens.leadId, leadId),
          eq(leadTokens.purpose, purpose),
          isNull(leadTokens.usedAt),
        ),
      );
  },
};

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function createLeadToken(
  leadId: number,
  purpose: LeadTokenPurpose,
  ttlMs: number,
  store: LeadTokenStore,
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  await store.insert({ leadId, tokenHash: hashToken(raw), purpose, expiresAt, usedAt: null });

  return raw;
}

/** Creates a token and returns the raw value — only the raw value ever goes in an email link. */
export async function createLeadConfirmToken(
  leadId: number,
  store: LeadTokenStore = drizzleLeadTokenStore,
): Promise<string> {
  return createLeadToken(leadId, "confirm", LEAD_TOKEN_TTL_MS, store);
}

/** Same, for the unsubscribe link that goes in the footer of every lead email. */
export async function createLeadUnsubscribeToken(
  leadId: number,
  store: LeadTokenStore = drizzleLeadTokenStore,
): Promise<string> {
  return createLeadToken(leadId, "unsubscribe", LEAD_UNSUBSCRIBE_TOKEN_TTL_MS, store);
}

/**
 * Verifies and single-use-consumes a confirm token, returning the associated
 * leadId (or null if invalid/expired/already used). Consuming a valid token
 * also invalidates any other open confirm tokens for that lead.
 */
export async function consumeLeadConfirmToken(
  raw: string,
  store: LeadTokenStore = drizzleLeadTokenStore,
): Promise<number | null> {
  const token = await store.findByHash(hashToken(raw));

  if (!token || token.purpose !== "confirm" || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await store.markAllUsedForLead(token.leadId, "confirm", new Date());

  return token.leadId;
}

export type LeadUnsubscribeTokenResult =
  /** Fresh token, now consumed — the caller should perform the unsubscribe. */
  | { status: "consumed"; leadId: number }
  /**
   * A token this lead already spent. The caller decides what to show: an
   * unsubscribed lead clicking their link twice should see the same
   * confirmation, not an error.
   */
  | { status: "already-used"; leadId: number }
  | { status: "invalid" };

/**
 * Verifies and single-use-consumes an unsubscribe token. Unlike the confirm
 * path this distinguishes "already used" from "never valid", because a second
 * click on the same link must be idempotent rather than look broken.
 */
export async function consumeLeadUnsubscribeToken(
  raw: string,
  store: LeadTokenStore = drizzleLeadTokenStore,
): Promise<LeadUnsubscribeTokenResult> {
  const token = await store.findByHash(hashToken(raw));

  if (!token || token.purpose !== "unsubscribe" || token.expiresAt < new Date()) {
    return { status: "invalid" };
  }

  if (token.usedAt) {
    return { status: "already-used", leadId: token.leadId };
  }

  await store.markAllUsedForLead(token.leadId, "unsubscribe", new Date());

  return { status: "consumed", leadId: token.leadId };
}
