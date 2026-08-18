import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import {
  ENV_SPECS,
  LS_VARIANT_VARS,
  checkEnv,
  rawEnv,
  type EnvName,
  type LsVariantKey,
} from "../src/config/env";

/**
 * Deploy pre-flight. Run it before go-live (docs/04 §3 step 5) and again after
 * the domain is pointed and the Lemon Squeezy store is live:
 *
 *   npx tsx scripts/preflight.ts            # config + database + external APIs
 *   npx tsx scripts/preflight.ts --offline  # no network calls
 *   npx tsx scripts/preflight.ts --live     # also GETs APP_URL/api/health
 *
 * Every check is read-only. Nothing here ever prints a secret's value: results
 * say "set" or name the variable, never what it contains, so the output is safe
 * to paste into an issue.
 *
 * Exits non-zero if anything failed, so it can gate a deploy script.
 */

type Status = "pass" | "warn" | "fail" | "skip";

interface Result {
  section: string;
  check: string;
  status: Status;
  detail: string;
}

const results: Result[] = [];

function record(section: string, check: string, status: Status, detail: string): void {
  results.push({ section, check, status, detail });
}

const argv = new Set(process.argv.slice(2));
const OFFLINE = argv.has("--offline");
const LIVE = argv.has("--live");

const LS_API = "https://api.lemonsqueezy.com/v1";
const RESEND_API = "https://api.resend.com";
const TIMEOUT_MS = 15_000;

/** Never let a hostname, user or password out of an error message. */
function safeError(error: unknown): string {
  const raw =
    error instanceof Error
      ? ((error as NodeJS.ErrnoException).code ?? error.message)
      : String(error);
  return raw.replace(/\/\/[^@\s]+@/g, "//***@").slice(0, 160);
}

async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A non-JSON error page is fine — the status code carries the meaning.
  }
  return { status: res.status, body };
}

// --- 1. Environment variables -------------------------------------------------

/**
 * Values safe to echo in the output. Everything else is reported as "set" and
 * never printed — the table is meant to be pasteable into an issue.
 */
const NON_SECRET: ReadonlySet<EnvName> = new Set<EnvName>([
  "APP_URL",
  "EMAIL_FROM",
  "LEMONSQUEEZY_STORE_ID",
  "LS_VARIANT_GUIDE",
  "LS_VARIANT_INSIDER_MONTHLY",
  "LS_VARIANT_INSIDER_YEARLY",
  "TRUSTED_PROXY_HOPS",
  "GIT_COMMIT_SHA",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
]);

function describeValue(name: EnvName, value: string): string {
  if (NON_SECRET.has(name)) return value;
  // Length is the one property of a secret worth printing — it's what
  // SESSION_SECRET is judged on.
  return `set (${value.length} chars)`;
}

/**
 * Runs the whole declared inventory through the same rules the app boots
 * under, with `production: true` regardless of this shell's NODE_ENV — the
 * pre-flight always judges the config as if it were serving live traffic.
 *
 * This is where the checklist items live that have no external service to
 * query: SESSION_SECRET's length, APP_URL's scheme and trailing slash, and
 * CRON_SECRET being set at all are all spec validators in src/config/env.ts.
 */
function checkEnvironment(): void {
  const issues = new Map(
    checkEnv({ production: true, requireFeatures: true }).map((issue) => [issue.name, issue]),
  );

  for (const spec of ENV_SPECS) {
    const issue = issues.get(spec.name);
    const value = rawEnv(spec.name);

    if (issue) {
      record("Environment", spec.name, issue.level === "error" ? "fail" : "warn", issue.reason);
      continue;
    }
    // An unset variable with no issue against it is an optional one — no row.
    if (value === undefined) continue;
    record("Environment", spec.name, "pass", describeValue(spec.name, value));
  }
}

// --- 2. Database --------------------------------------------------------------

async function migrationsInRepo(): Promise<number> {
  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entries?: unknown[] };
  return journal.entries?.length ?? 0;
}

async function checkDatabase(): Promise<void> {
  const url = rawEnv("DATABASE_URL");
  if (!url) {
    record("Database", "reachable", "fail", "DATABASE_URL is not set");
    return;
  }
  if (OFFLINE) {
    record("Database", "reachable", "skip", "--offline");
    return;
  }

  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({ uri: url, connectTimeout: TIMEOUT_MS });
    await connection.query("select 1");
    record("Database", "reachable", "pass", "connected");
  } catch (error) {
    record("Database", "reachable", "fail", safeError(error));
    if (connection) await connection.end().catch(() => {});
    return;
  }

  try {
    const expected = await migrationsInRepo();
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      "select count(*) as applied from `__drizzle_migrations`",
    );
    const applied = Number(rows[0]?.applied ?? 0);

    if (applied >= expected) {
      record("Database", "migrations applied", "pass", `${applied} applied, ${expected} in repo`);
    } else {
      record(
        "Database",
        "migrations applied",
        "fail",
        `${applied} applied but ${expected} in repo — run \`npm run db:migrate\``,
      );
    }
  } catch {
    // No __drizzle_migrations table: either the schema was pushed rather than
    // migrated, or nothing has been applied at all. Those are very different,
    // so fall back to asking whether the tables exist.
    try {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        "select count(*) as present from information_schema.tables where table_schema = database() and table_name in ('users', 'leads', 'webhook_events', 'cron_runs')",
      );
      const present = Number(rows[0]?.present ?? 0);
      if (present === 4) {
        record(
          "Database",
          "migrations applied",
          "warn",
          "no __drizzle_migrations table (schema pushed?), but the core tables are present",
        );
      } else {
        record(
          "Database",
          "migrations applied",
          "fail",
          `schema is not applied — ${present}/4 core tables found; run \`npm run db:migrate\``,
        );
      }
    } catch (error) {
      record("Database", "migrations applied", "fail", safeError(error));
    }
  }

  await connection.end().catch(() => {});
}

// --- 3. Lemon Squeezy ---------------------------------------------------------

function attributesOf(body: unknown): Record<string, unknown> | null {
  const data = (body as { data?: unknown })?.data;
  const first = Array.isArray(data) ? data[0] : data;
  const attributes = (first as { attributes?: unknown })?.attributes;
  return attributes && typeof attributes === "object" ? (attributes as Record<string, unknown>) : null;
}

/**
 * Lemon Squeezy test mode and live mode are separate worlds with separate
 * variant ids — the trap doc 04 §4 flags. Variants carry no test_mode flag, but
 * webhooks and orders do, and an API key only ever returns its own mode's data.
 */
async function detectLsTestMode(apiKey: string, storeId: string | undefined): Promise<boolean | null> {
  const headers = { Accept: "application/vnd.api+json", Authorization: `Bearer ${apiKey}` };
  const storeFilter = storeId ? `?filter[store_id]=${encodeURIComponent(storeId)}` : "";

  for (const url of [`${LS_API}/webhooks${storeFilter}`, `${LS_API}/orders${storeFilter}`]) {
    try {
      const { status, body } = await getJson(url, headers);
      if (status !== 200) continue;
      const testMode = attributesOf(body)?.test_mode;
      if (typeof testMode === "boolean") return testMode;
    } catch {
      // Fall through to the next probe; an undetermined mode is a warning, not a failure.
    }
  }
  return null;
}

function appUrlLooksLive(): boolean {
  const appUrl = rawEnv("APP_URL");
  if (!appUrl) return false;
  try {
    const url = new URL(appUrl);
    return url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

async function checkLemonSqueezy(): Promise<void> {
  const apiKey = rawEnv("LEMONSQUEEZY_API_KEY");
  const storeId = rawEnv("LEMONSQUEEZY_STORE_ID");

  if (!apiKey) {
    record("Lemon Squeezy", "API key", "fail", "LEMONSQUEEZY_API_KEY is not set");
    return;
  }
  if (OFFLINE) {
    record("Lemon Squeezy", "API key", "skip", "--offline");
    return;
  }

  const headers = { Accept: "application/vnd.api+json", Authorization: `Bearer ${apiKey}` };

  if (storeId) {
    try {
      const { status } = await getJson(`${LS_API}/stores/${encodeURIComponent(storeId)}`, headers);
      if (status === 200) record("Lemon Squeezy", "store id", "pass", `store ${storeId} resolves`);
      else if (status === 401 || status === 403)
        record("Lemon Squeezy", "store id", "fail", `API key rejected (HTTP ${status})`);
      else record("Lemon Squeezy", "store id", "fail", `store ${storeId} not found (HTTP ${status})`);
    } catch (error) {
      record("Lemon Squeezy", "store id", "fail", safeError(error));
    }
  }

  for (const [productKey, envName] of Object.entries(LS_VARIANT_VARS) as [LsVariantKey, EnvName][]) {
    const variantId = rawEnv(envName);
    if (!variantId) {
      record("Lemon Squeezy", `variant ${productKey}`, "fail", `${envName} is not set`);
      continue;
    }

    try {
      const { status, body } = await getJson(
        `${LS_API}/variants/${encodeURIComponent(variantId)}`,
        headers,
      );
      if (status === 200) {
        const name = attributesOf(body)?.name;
        record(
          "Lemon Squeezy",
          `variant ${productKey}`,
          "pass",
          `${variantId} → ${typeof name === "string" ? name : "resolved"}`,
        );
      } else if (status === 404) {
        record(
          "Lemon Squeezy",
          `variant ${productKey}`,
          "fail",
          `${envName}=${variantId} does not exist for this API key — wrong store, or a test-mode id in a live key`,
        );
      } else {
        record("Lemon Squeezy", `variant ${productKey}`, "fail", `HTTP ${status} resolving ${variantId}`);
      }
    } catch (error) {
      record("Lemon Squeezy", `variant ${productKey}`, "fail", safeError(error));
    }
  }

  const testMode = await detectLsTestMode(apiKey, storeId);
  if (testMode === null) {
    record(
      "Lemon Squeezy",
      "mode",
      "warn",
      "could not determine test vs live mode (no webhooks or orders to read it from yet)",
    );
  } else if (testMode && appUrlLooksLive()) {
    record(
      "Lemon Squeezy",
      "mode",
      "warn",
      "API key is in TEST mode while APP_URL is a live domain — the variant ids above are test-mode ids (docs/04 §4)",
    );
  } else {
    record("Lemon Squeezy", "mode", "pass", testMode ? "test mode (APP_URL is not live)" : "live mode");
  }
}

// --- 4. Email -----------------------------------------------------------------

/** "Name <hello@example.com>" or "hello@example.com" → "example.com". */
function emailFromDomain(value: string): string | null {
  const address = value.match(/<([^>]+)>/)?.[1] ?? value;
  const domain = address.trim().split("@")[1];
  return domain ? domain.toLowerCase() : null;
}

async function checkEmail(): Promise<void> {
  const apiKey = rawEnv("RESEND_API_KEY");
  const from = rawEnv("EMAIL_FROM");

  if (!apiKey) {
    record("Email", "Resend key", "fail", "RESEND_API_KEY is not set");
    return;
  }
  if (!from) {
    record("Email", "EMAIL_FROM", "fail", "EMAIL_FROM is not set, so no email can be sent");
    return;
  }
  if (OFFLINE) {
    record("Email", "Resend key", "skip", "--offline");
    return;
  }

  let body: unknown;
  try {
    const response = await getJson(`${RESEND_API}/domains`, { Authorization: `Bearer ${apiKey}` });
    if (response.status === 401 || response.status === 403) {
      record("Email", "Resend key", "fail", `key rejected (HTTP ${response.status})`);
      return;
    }
    if (response.status !== 200) {
      record("Email", "Resend key", "fail", `HTTP ${response.status} listing domains`);
      return;
    }
    record("Email", "Resend key", "pass", "accepted");
    body = response.body;
  } catch (error) {
    record("Email", "Resend key", "fail", safeError(error));
    return;
  }

  const domains = ((body as { data?: unknown })?.data ?? []) as { name?: string; status?: string }[];
  const wanted = emailFromDomain(from);

  if (!wanted) {
    record("Email", "EMAIL_FROM domain", "fail", "EMAIL_FROM has no parseable domain");
    return;
  }

  const match = domains.find((domain) => domain.name?.toLowerCase() === wanted);
  if (!match) {
    record(
      "Email",
      "EMAIL_FROM domain",
      "fail",
      `${wanted} is not a domain on this Resend account — mail will be rejected`,
    );
  } else if (match.status !== "verified") {
    record("Email", "EMAIL_FROM domain", "fail", `${wanted} is "${match.status}", not verified — finish the DNS records`);
  } else {
    record("Email", "EMAIL_FROM domain", "pass", `${wanted} verified`);
  }
}

// --- 5. Live deployment -------------------------------------------------------

/** Post-go-live only: proves the deployed build answers and its database is up. */
async function checkLiveHealth(): Promise<void> {
  const appUrl = rawEnv("APP_URL");
  if (!appUrl) {
    record("Live", "GET /api/health", "fail", "APP_URL is not set");
    return;
  }

  try {
    const { status, body } = await getJson(`${appUrl}/api/health`, { accept: "application/json" });
    const report = body as { ok?: boolean; db?: string; migrations?: number | null; commit?: string | null };
    if (status === 200 && report?.ok) {
      record(
        "Live",
        "GET /api/health",
        "pass",
        `db ${report.db}, ${report.migrations ?? "?"} migrations${report.commit ? `, commit ${report.commit.slice(0, 8)}` : ""}`,
      );
    } else {
      record("Live", "GET /api/health", "fail", `HTTP ${status}, db ${report?.db ?? "unknown"}`);
    }
  } catch (error) {
    record("Live", "GET /api/health", "fail", safeError(error));
  }
}

// --- Report -------------------------------------------------------------------

const LABELS: Record<Status, string> = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
  skip: "SKIP",
};

function printTable(): void {
  const checkWidth = Math.max(...results.map((r) => `${r.section} · ${r.check}`.length));

  let currentSection = "";
  for (const result of results) {
    if (result.section !== currentSection) {
      currentSection = result.section;
      console.log("");
    }
    const label = `${result.section} · ${result.check}`.padEnd(checkWidth);
    console.log(`  ${LABELS[result.status].padEnd(4)}  ${label}  ${result.detail}`);
  }
}

async function main(): Promise<void> {
  checkEnvironment();
  await checkDatabase();
  await checkLemonSqueezy();
  await checkEmail();
  if (LIVE) await checkLiveHealth();

  console.log(`\nPre-flight${OFFLINE ? " (offline)" : ""} — ${results.length} checks`);
  printTable();

  const failed = results.filter((r) => r.status === "fail");
  const warned = results.filter((r) => r.status === "warn");

  console.log(
    `\n${results.filter((r) => r.status === "pass").length} passed, ${warned.length} warnings, ${failed.length} failures`,
  );

  if (failed.length > 0) {
    console.log("\nNot ready to deploy. Fix the FAIL rows above; docs/04-launch-checklist.md §2 says where each value comes from.");
    process.exit(1);
  }
  console.log("\nAll checks passed. Re-run with --live after the domain is pointed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Pre-flight itself failed:", safeError(error));
  process.exit(1);
});
