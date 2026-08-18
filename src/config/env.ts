/**
 * Single typed reader for every environment variable this app depends on.
 *
 * The point is that a misconfigured production deployment fails loudly instead
 * of falling back to a dev default and looking fine. Each variable is classified
 * once, here, and every consumer reads it through this module rather than
 * touching `process.env` itself:
 *
 * - **production** — the app cannot serve traffic without it. Missing in
 *   production ⇒ throws, naming the variable and where the value comes from.
 *   Missing in development ⇒ warns once and falls back, which is the behaviour
 *   the rest of the app already relies on (build with no DB, no LS account).
 * - **feature** — one feature needs it. Missing ⇒ that feature is off (emails
 *   log to console, the cron endpoint 401s), and anything that genuinely cannot
 *   proceed throws at the point of use with the same named error.
 *   `scripts/preflight.ts` treats every feature variable as a launch blocker,
 *   because by go-live all of them are supposed to be set.
 * - **optional** — tuning or nice-to-have. Never fatal.
 *
 * Values are read on every call rather than cached at import: `next build`
 * imports this module with no env at all, and the tests set variables per case.
 */

export type EnvName =
  | "APP_URL"
  | "SESSION_SECRET"
  | "DATABASE_URL"
  | "LEMONSQUEEZY_API_KEY"
  | "LEMONSQUEEZY_STORE_ID"
  | "LEMONSQUEEZY_WEBHOOK_SECRET"
  | "LS_VARIANT_GUIDE"
  | "LS_VARIANT_INSIDER_MONTHLY"
  | "LS_VARIANT_INSIDER_YEARLY"
  | "RESEND_API_KEY"
  | "EMAIL_FROM"
  | "CRON_SECRET"
  | "TRUSTED_PROXY_HOPS"
  | "GIT_COMMIT_SHA"
  | "NEXT_PUBLIC_PLAUSIBLE_DOMAIN"
  | "ADMIN_EMAIL"
  | "ADMIN_PASSWORD";

export type Requirement =
  | { kind: "production" }
  | { kind: "feature"; feature: string; requiredWith?: EnvName }
  | { kind: "optional" };

export interface EnvSpec {
  name: EnvName;
  requirement: Requirement;
  /** What stops working without it. */
  purpose: string;
  /** Where the deployer gets the value — quoted verbatim in every error. */
  source: string;
  /** What a dev machine gets when it's unset. Documentation for the fallback the accessor applies. */
  devFallback?: string;
  /**
   * Format check for a value that *is* set. `production` is passed because a
   * couple of rules only apply there — http://localhost:3000 is a fine APP_URL
   * in dev and a broken one in production.
   */
  validate?: (value: string, context: { production: boolean }) => string | null;
}

const DEFAULT_APP_URL = "http://localhost:3000";

export const ENV_SPECS: readonly EnvSpec[] = [
  {
    name: "APP_URL",
    requirement: { kind: "production" },
    purpose: "canonical base URL used in emails, checkout redirects, sitemap and robots",
    source: "your domain in hPanel (or the temporary *.hostingersite.com subdomain)",
    devFallback: DEFAULT_APP_URL,
    validate: (value, { production }) => {
      if (value.endsWith("/")) return "must not have a trailing slash";
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return "is not a valid absolute URL";
      }
      if (production && url.protocol !== "https:") return "must be an https:// URL in production";
      if (production && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
        return "still points at localhost";
      }
      return null;
    },
  },
  {
    name: "SESSION_SECRET",
    requirement: { kind: "production" },
    purpose: "iron-session cookie encryption — no sessions, so nobody can log in",
    source: "generate one: openssl rand -base64 32",
    validate: (value) =>
      value.length < 32 ? `must be 32+ characters (this one is ${value.length})` : null,
  },
  {
    name: "DATABASE_URL",
    requirement: { kind: "production" },
    purpose: "MySQL connection — every page that reads data",
    source: "hPanel → Databases (enable Remote MySQL to reach it from outside the slot)",
    validate: (value) =>
      value.startsWith("mysql://") ? null : "must be a mysql:// connection string",
  },
  {
    name: "LEMONSQUEEZY_API_KEY",
    requirement: { kind: "feature", feature: "Lemon Squeezy checkout" },
    purpose: "creating checkouts and reading subscription state",
    source: "Lemon Squeezy → Settings → API",
  },
  {
    name: "LEMONSQUEEZY_STORE_ID",
    requirement: { kind: "feature", feature: "Lemon Squeezy checkout" },
    purpose: "which store a checkout is created against",
    source: "Lemon Squeezy → Settings → Stores (the numeric id)",
  },
  {
    name: "LEMONSQUEEZY_WEBHOOK_SECRET",
    requirement: { kind: "feature", feature: "Lemon Squeezy webhooks" },
    purpose: "HMAC verification of incoming webhooks — unset means the endpoint 401s and nobody is granted access after paying",
    source: "Lemon Squeezy → Settings → Webhooks, set when you create the endpoint",
  },
  {
    name: "LS_VARIANT_GUIDE",
    requirement: { kind: "feature", feature: "Lemon Squeezy checkout" },
    purpose: "maps the guide product to its Lemon Squeezy variant, in both directions",
    source: "Lemon Squeezy → Products → the variant → copy ID (test-mode and live ids differ!)",
  },
  {
    name: "LS_VARIANT_INSIDER_MONTHLY",
    requirement: { kind: "feature", feature: "Lemon Squeezy checkout" },
    purpose: "maps the monthly Insider subscription to its Lemon Squeezy variant",
    source: "Lemon Squeezy → Products → the variant → copy ID (test-mode and live ids differ!)",
  },
  {
    name: "LS_VARIANT_INSIDER_YEARLY",
    requirement: { kind: "feature", feature: "Lemon Squeezy checkout" },
    purpose: "maps the yearly Insider subscription to its Lemon Squeezy variant",
    source: "Lemon Squeezy → Products → the variant → copy ID (test-mode and live ids differ!)",
  },
  {
    name: "RESEND_API_KEY",
    requirement: { kind: "feature", feature: "Transactional email" },
    purpose: "sending set-password, reset and receipt emails — unset means they only log to the console",
    source: "resend.com → API Keys",
  },
  {
    name: "EMAIL_FROM",
    requirement: { kind: "feature", feature: "Transactional email", requiredWith: "RESEND_API_KEY" },
    purpose: "the From header on every email; its domain must be verified in Resend",
    source: 'resend.com → Domains, then write it as "Name <hello@yourdomain.com>"',
    validate: (value) =>
      /^[^<>]*<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
        ? null
        : 'must be an address, optionally with a display name: "Name <hello@yourdomain.com>"',
  },
  {
    name: "CRON_SECRET",
    requirement: { kind: "feature", feature: "Lead nurture cron" },
    purpose: "bearer token for POST /api/cron/nurture — unset means the nurture sequence never runs",
    source: "generate one: openssl rand -hex 32, then use it in the Hostinger cron entry",
  },
  {
    name: "TRUSTED_PROXY_HOPS",
    requirement: { kind: "optional" },
    purpose: "how many trusted proxies sit in front of the app when reading the client IP (rate limiting); defaults to 1",
    source: "your own deployment topology — 1 for Hostinger alone, 2 with a CDN in front",
    devFallback: "1",
    validate: (value) =>
      Number.isInteger(Number(value)) && Number(value) >= 1 ? null : "must be a whole number ≥ 1",
  },
  {
    name: "GIT_COMMIT_SHA",
    requirement: { kind: "optional" },
    purpose: "reported by GET /api/health so you can tell which build is live",
    source: "set it in the deploy step, e.g. GIT_COMMIT_SHA=$(git rev-parse HEAD)",
  },
  {
    name: "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
    requirement: { kind: "optional" },
    purpose: "enables cookieless Plausible analytics; a no-op when unset",
    // Read inline as process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN in
    // src/components/Analytics.tsx and src/lib/analytics.ts — NEXT_PUBLIC_*
    // variables are string-substituted into the client bundle at build time,
    // which only works on a literal member expression. Listed here so the
    // preflight table and this file stay the full inventory.
    source: "your Plausible project's site domain, e.g. yourdomain.com",
  },
  {
    name: "ADMIN_EMAIL",
    requirement: { kind: "optional" },
    purpose: "scripts/seed-admin.ts only; never read at runtime",
    source: "owner choice",
  },
  {
    name: "ADMIN_PASSWORD",
    requirement: { kind: "optional" },
    purpose: "scripts/seed-admin.ts only; never read at runtime",
    source: "owner choice — make it strong and unique",
  },
];

const SPECS_BY_NAME = new Map<EnvName, EnvSpec>(ENV_SPECS.map((spec) => [spec.name, spec]));

export function envSpec(name: EnvName): EnvSpec {
  const spec = SPECS_BY_NAME.get(name);
  if (!spec) throw new Error(`No env spec declared for ${name}`);
  return spec;
}

/** Trimmed value, or undefined when unset or empty — `FOO=` in a .env file is not a value. */
export function rawEnv(name: EnvName): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * True when this process is *serving* production traffic.
 *
 * `next build` also runs with NODE_ENV=production but has no deployment env
 * around it — the whole plan (docs/01) is that the app builds with no database
 * and no Lemon Squeezy account. Throwing there would break the build instead of
 * the deploy, so the build phase is treated like development. The boot gate and
 * scripts/preflight.ts pass `production: true` explicitly and don't depend on
 * this at all.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
}

function describe(spec: EnvSpec): string {
  return `  Purpose: ${spec.purpose}\n  Where to get it: ${spec.source}\n  See .env.example and docs/04-launch-checklist.md §2.`;
}

export function missingEnvError(spec: EnvSpec): Error {
  return new Error(`Missing required environment variable ${spec.name}.\n${describe(spec)}`);
}

export function invalidEnvError(spec: EnvSpec, reason: string): Error {
  return new Error(`Environment variable ${spec.name} ${reason}.\n${describe(spec)}`);
}

// Dev warnings are deduped so a fallback doesn't print on every render.
const warned = new Set<string>();

/** Test-only: lets a case assert on the warning that another case already triggered. */
export function resetEnvWarnings(): void {
  warned.clear();
}

function warnOnce(name: EnvName, message: string): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[env] ${message}`);
}

function validated(spec: EnvSpec, value: string): string {
  const problem = spec.validate?.(value, { production: isProduction() });
  if (problem && isProduction()) throw invalidEnvError(spec, problem);
  if (problem) warnOnce(spec.name, `${spec.name} ${problem}. Tolerated in development; this is fatal in production.`);
  return value;
}

/**
 * A production-required value. Throws in production when it's missing or
 * malformed; in development, warns once and returns the spec's dev fallback
 * (which may be undefined — the caller supplies the concrete default it wants).
 */
export function requireInProduction(name: EnvName): string | undefined {
  const spec = envSpec(name);
  const value = rawEnv(name);
  if (value === undefined) {
    if (isProduction()) throw missingEnvError(spec);
    warnOnce(
      name,
      spec.devFallback
        ? `${name} is not set — falling back to ${spec.devFallback}. This throws at boot in production.`
        : `${name} is not set. Tolerated in development; this throws at boot in production.`,
    );
    return spec.devFallback;
  }
  return validated(spec, value);
}

/** A feature variable. Unset means the feature is off; the caller decides what that costs. */
export function featureValue(name: EnvName): string | undefined {
  const value = rawEnv(name);
  return value === undefined ? undefined : validated(envSpec(name), value);
}

/** A feature variable at a point where the feature cannot proceed without it. */
export function requireFeatureValue(name: EnvName): string {
  const value = featureValue(name);
  if (value === undefined) throw missingEnvError(envSpec(name));
  return value;
}

export type EnvIssueLevel = "error" | "warning";

export interface EnvIssue {
  name: EnvName;
  level: EnvIssueLevel;
  /** "missing" or the validate() message. */
  reason: string;
  spec: EnvSpec;
}

export interface CheckEnvOptions {
  /** Treat the environment as production regardless of NODE_ENV — what preflight does. */
  production?: boolean;
  /** Treat feature variables as errors rather than warnings — also what preflight does. */
  requireFeatures?: boolean;
}

/**
 * Inspects every declared variable at once. Used by the boot assertion (which
 * only cares about production-required ones) and by scripts/preflight.ts (which
 * wants the whole table, feature variables included).
 */
export function checkEnv(options: CheckEnvOptions = {}): EnvIssue[] {
  const production = options.production ?? isProduction();
  const issues: EnvIssue[] = [];

  for (const spec of ENV_SPECS) {
    const value = rawEnv(spec.name);
    const featureLevel: EnvIssueLevel = options.requireFeatures ? "error" : "warning";

    if (value === undefined) {
      if (spec.requirement.kind === "production" && production) {
        issues.push({ name: spec.name, level: "error", reason: "missing", spec });
      } else if (spec.requirement.kind === "feature") {
        const { requiredWith } = spec.requirement;
        // EMAIL_FROM is only meaningful once RESEND_API_KEY is set, but once it
        // is, sending without it throws — so that pairing is always an error.
        if (requiredWith && rawEnv(requiredWith) !== undefined) {
          issues.push({
            name: spec.name,
            level: "error",
            reason: `missing, and required whenever ${requiredWith} is set`,
            spec,
          });
        } else {
          issues.push({
            name: spec.name,
            level: featureLevel,
            reason: `missing — "${spec.requirement.feature}" is disabled`,
            spec,
          });
        }
      }
      continue;
    }

    const problem = spec.validate?.(value, { production });
    if (problem) {
      issues.push({
        name: spec.name,
        level: spec.requirement.kind === "optional" ? "warning" : "error",
        reason: problem,
        spec,
      });
    }
  }

  return issues;
}

/**
 * Boot gate. Throws a single error listing everything wrong with the
 * production-required variables, so a broken deploy dies on start-up with the
 * whole list rather than on the first request with one line of it.
 *
 * Called from src/instrumentation.ts, which Next runs when the server starts.
 */
export function assertProductionEnv(): void {
  const issues = checkEnv({ production: true }).filter((issue) => issue.level === "error");
  if (issues.length === 0) return;

  const detail = issues
    .map(
      (issue, index) =>
        `${index + 1}) ${issue.name} — ${issue.reason}\n${describe(issue.spec)}`,
    )
    .join("\n\n");

  throw new Error(
    `Environment is not configured for production (${issues.length} problem${issues.length === 1 ? "" : "s"}):\n\n${detail}\n\nRun \`npx tsx scripts/preflight.ts\` for the full pre-flight check.`,
  );
}

// --- Typed accessors. Consumers use these, never process.env. ---

export const LS_VARIANT_VARS = {
  guide: "LS_VARIANT_GUIDE",
  "insider-monthly": "LS_VARIANT_INSIDER_MONTHLY",
  "insider-yearly": "LS_VARIANT_INSIDER_YEARLY",
} as const satisfies Record<string, EnvName>;

export type LsVariantKey = keyof typeof LS_VARIANT_VARS;

export const env = {
  /** Canonical base URL, no trailing slash. Falls back to localhost in dev only. */
  appUrl: (): string => requireInProduction("APP_URL") ?? DEFAULT_APP_URL,

  /**
   * Throws in development too: there is no safe fallback for a cookie
   * encryption key, and every auth path already depended on this throwing.
   */
  sessionSecret: (): string => {
    const spec = envSpec("SESSION_SECRET");
    const value = rawEnv("SESSION_SECRET");
    if (value === undefined) throw missingEnvError(spec);
    const problem = spec.validate?.(value, { production: isProduction() });
    if (problem) throw invalidEnvError(spec, problem);
    return value;
  },

  /**
   * Undefined in dev is deliberate: the mysql2 pool is created at import time
   * and only dials on the first query, so `next build` works with no database.
   */
  databaseUrl: (): string | undefined => requireInProduction("DATABASE_URL"),

  lemonSqueezyApiKey: (): string | undefined => featureValue("LEMONSQUEEZY_API_KEY"),
  lemonSqueezyStoreId: (): string | undefined => featureValue("LEMONSQUEEZY_STORE_ID"),
  lemonSqueezyWebhookSecret: (): string | undefined => featureValue("LEMONSQUEEZY_WEBHOOK_SECRET"),
  lsVariantId: (key: LsVariantKey): string | undefined => featureValue(LS_VARIANT_VARS[key]),

  resendApiKey: (): string | undefined => featureValue("RESEND_API_KEY"),
  emailFrom: (): string | undefined => featureValue("EMAIL_FROM"),

  cronSecret: (): string | undefined => featureValue("CRON_SECRET"),

  /** Whatever the deploy step stamped in, if anything. Reported by /api/health. */
  gitCommitSha: (): string | undefined => featureValue("GIT_COMMIT_SHA"),
};
