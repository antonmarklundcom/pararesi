import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", tier: "insider" })
      .where(eq(users.id, existing.id));
    console.log(`Updated existing admin user: ${email}`);
  } else {
    await db.insert(users).values({
      email,
      passwordHash,
      name: "Admin",
      role: "admin",
      tier: "insider",
    });
    console.log(`Created admin user: ${email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
