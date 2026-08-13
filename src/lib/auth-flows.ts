import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumePasswordToken, type TokenPurpose } from "./tokens";
import { getSession } from "./session";
import { allowPasswordTokenSubmit } from "./credential-ratelimit";
import { getClientIp } from "./request-ip";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;

const RATE_LIMITED_ERROR = "Too many attempts. Please try again in a few minutes.";

/**
 * Writes a new password and invalidates every session the account currently
 * has, by bumping `users.session_epoch` in the same statement. Shared by the
 * token flows here and by the logged-in change-password action.
 *
 * The bump is done in SQL rather than read-modify-write so two concurrent
 * changes can't both write the same value and leave one of them un-invalidated.
 */
export async function setUserPassword(userId: number, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db
    .update(users)
    .set({ passwordHash, sessionEpoch: sql`${users.sessionEpoch} + 1` })
    .where(eq(users.id, userId));
}

/**
 * Shared core for both /reset-password and /set-password: consume the
 * single-use token, hash and store the new password, then log the user in.
 * Returns an error message on failure, or null on success.
 */
export async function applyPasswordFromToken(
  rawToken: string,
  password: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  // Before the bcrypt hash below, not after: an unauthenticated endpoint that
  // burns ~250ms of CPU per request is a cheap way to starve a single-process
  // deployment. Guessing the token itself is not the threat — it's 32 random
  // bytes — so the bucket is per-IP and generous.
  if (!allowPasswordTokenSubmit(await getClientIp())) {
    return RATE_LIMITED_ERROR;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const userId = await consumePasswordToken(rawToken, purpose);
  if (!userId) {
    return "This link is invalid or has expired. Request a new one.";
  }

  await setUserPassword(userId, password);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return "Something went wrong. Please try logging in.";

  // Read back *after* the update so this session carries the new epoch and
  // survives the invalidation it just caused. Every other session does not,
  // which is the point: password recovery has to be able to evict an attacker.
  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.epoch = user.sessionEpoch;
  await session.save();

  return null;
}
