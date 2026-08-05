import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { consumeLeadConfirmToken, type LeadTokenStore, drizzleLeadTokenStore } from "@/lib/lead-tokens";

/**
 * Where a signup came from. A closed set rather than free text: the value
 * arrives from a form field, so anything unrecognised is coerced to "unknown"
 * instead of being written to the database as-is.
 */
export const LEAD_SOURCES = ["home-hero", "guide-page"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number] | "unknown";

export function normalizeSource(raw: unknown): LeadSource {
  const value = String(raw ?? "").trim();
  return (LEAD_SOURCES as readonly string[]).includes(value) ? (value as LeadSource) : "unknown";
}

/** Same normalization the auth flows use: trimmed and lowercased before any lookup or write. */
export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/**
 * Deliberately permissive format check — one @, something either side, a dot in
 * the domain, no whitespace. The real validation is the double opt-in: an
 * address that cannot receive the confirmation link never becomes a subscriber.
 * (This app has no validator library and does not need one for this.)
 */
export function isPlausibleEmail(email: string): boolean {
  if (email.length === 0 || email.length > 255) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** Rate-limit buckets for the capture form: one per email, one per IP. */
export function leadRateLimitKeys(email: string, ip: string) {
  return { emailKey: `subscribe:email:${email}`, ipKey: `subscribe:ip:${ip}` };
}

export type LeadRecord = {
  id: number;
  email: string;
  source: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
};

/**
 * The leads table, behind an interface so upsert idempotency and the
 * confirmation flow can be tested without a database. `drizzleLeadStore`
 * below is the real one.
 */
export interface LeadStore {
  findByEmail(email: string): Promise<LeadRecord | null>;
  findById(id: number): Promise<LeadRecord | null>;
  insert(values: { email: string; source: LeadSource }): Promise<LeadRecord>;
  updateSource(id: number, source: LeadSource): Promise<void>;
  /** Records the double opt-in, and clears any earlier unsubscribe. */
  markConfirmed(id: number, confirmedAt: Date): Promise<void>;
}

function toRecord(row: typeof leads.$inferSelect): LeadRecord {
  return {
    id: row.id,
    email: row.email,
    source: row.source,
    confirmedAt: row.confirmedAt ?? null,
    unsubscribedAt: row.unsubscribedAt ?? null,
  };
}

export const drizzleLeadStore: LeadStore = {
  async findByEmail(email) {
    const [row] = await db.select().from(leads).where(eq(leads.email, email));
    return row ? toRecord(row) : null;
  },

  async findById(id) {
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    return row ? toRecord(row) : null;
  },

  async insert({ email, source }) {
    await db.insert(leads).values({ email, source });
    const [row] = await db.select().from(leads).where(eq(leads.email, email));
    if (!row) throw new Error("Lead insert did not produce a row");
    return toRecord(row);
  },

  async updateSource(id, source) {
    await db.update(leads).set({ source }).where(eq(leads.id, id));
  },

  async markConfirmed(id, confirmedAt) {
    await db.update(leads).set({ confirmedAt, unsubscribedAt: null }).where(eq(leads.id, id));
  },
};

export type UpsertLeadResult = {
  lead: LeadRecord;
  /**
   * "confirmed" means the address is already an opted-in subscriber, so no
   * confirmation email is sent — otherwise the public form would be a way to
   * mail an existing subscriber on demand.
   */
  status: "new" | "pending" | "confirmed";
};

/**
 * Idempotent by email: resubmitting the same address updates the recorded
 * source and returns the existing row rather than erroring or duplicating.
 *
 * A previously unsubscribed address is treated as pending, not resubscribed:
 * `unsubscribedAt` is only cleared when the confirmation link is actually
 * clicked, so a third party submitting someone else's address cannot opt them
 * back in.
 */
export async function upsertLead(
  email: string,
  source: LeadSource,
  store: LeadStore = drizzleLeadStore,
): Promise<UpsertLeadResult> {
  const existing = await store.findByEmail(email);

  if (!existing) {
    return { lead: await store.insert({ email, source }), status: "new" };
  }

  if (existing.confirmedAt && !existing.unsubscribedAt) {
    return { lead: existing, status: "confirmed" };
  }

  if (existing.source !== source) {
    await store.updateSource(existing.id, source);
  }

  return { lead: { ...existing, source }, status: "pending" };
}

/**
 * Consumes a confirmation token and records the opt-in. Returns null for an
 * invalid, expired or already-used token.
 */
export async function confirmLeadByToken(
  rawToken: string,
  leadStore: LeadStore = drizzleLeadStore,
  tokenStore: LeadTokenStore = drizzleLeadTokenStore,
): Promise<LeadRecord | null> {
  const leadId = await consumeLeadConfirmToken(rawToken, tokenStore);
  if (leadId === null) return null;

  const lead = await leadStore.findById(leadId);
  if (!lead) return null;

  // Keep the original consent timestamp if this address confirmed before.
  const confirmedAt = lead.confirmedAt ?? new Date();
  await leadStore.markConfirmed(lead.id, confirmedAt);

  return { ...lead, confirmedAt, unsubscribedAt: null };
}
