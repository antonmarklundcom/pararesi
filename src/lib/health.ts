import { sql } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/db";

/** Written by `drizzle-kit migrate` in the app's own database — one row per applied migration. */
export const MIGRATIONS_TABLE = "__drizzle_migrations";

export interface HealthReport {
  ok: boolean;
  db: "up" | "down";
  /** Applied migration count, or null when the table isn't there (a `drizzle-kit push` database). */
  migrations: number | null;
  /** Whatever the deploy stamped into GIT_COMMIT_SHA, or null. */
  commit: string | null;
}

export interface DatabaseProbeResult {
  up: boolean;
  migrations: number | null;
}

/**
 * One round-trip when everything is fine: counting the migration rows proves
 * the connection works *and* answers the migration question. The fallback only
 * runs when that query fails, which is either "no such table" (pushed schema,
 * database is fine) or a genuinely unreachable database.
 */
export async function probeDatabase(): Promise<DatabaseProbeResult> {
  try {
    const result = await db.execute(sql`select count(*) as count from ${sql.identifier(MIGRATIONS_TABLE)}`);
    return { up: true, migrations: firstCount(result) };
  } catch {
    try {
      await db.execute(sql`select 1`);
      return { up: true, migrations: null };
    } catch {
      return { up: false, migrations: null };
    }
  }
}

// mysql2 hands back [rows, fields]; drizzle passes that through unchanged.
function firstCount(result: unknown): number | null {
  const rows = Array.isArray(result) ? result[0] : result;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  const count = row && typeof row === "object" ? (row as Record<string, unknown>).count : undefined;
  const parsed = Number(count);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function buildHealthReport(
  probe: () => Promise<DatabaseProbeResult> = probeDatabase,
): Promise<HealthReport> {
  const { up, migrations } = await probe();

  return {
    ok: up,
    db: up ? "up" : "down",
    migrations,
    commit: env.gitCommitSha() ?? null,
  };
}
