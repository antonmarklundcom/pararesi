import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumePasswordToken, type TokenPurpose } from "./tokens";
import { getSession } from "./session";
import { effectiveTier } from "./auth";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;

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
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  const userId = await consumePasswordToken(rawToken, purpose);
  if (!userId) {
    return "This link is invalid or has expired. Request a new one.";
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return "Something went wrong. Please try logging in.";

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.tier = await effectiveTier(user);
  await session.save();

  return null;
}
