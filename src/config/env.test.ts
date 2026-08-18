import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertProductionEnv,
  checkEnv,
  env,
  featureValue,
  isProduction,
  rawEnv,
  requireFeatureValue,
  requireInProduction,
  resetEnvWarnings,
} from "./env";

/** The three variables the app refuses to serve production traffic without. */
const PRODUCTION_ENV = {
  APP_URL: "https://example.com",
  SESSION_SECRET: "x".repeat(32),
  DATABASE_URL: "mysql://user:pw@localhost:3306/db",
};

function stub(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

/** Clears every declared variable so a case starts from a known-empty environment. */
function clearAll() {
  const names = [
    "APP_URL",
    "SESSION_SECRET",
    "DATABASE_URL",
    "LEMONSQUEEZY_API_KEY",
    "LEMONSQUEEZY_STORE_ID",
    "LEMONSQUEEZY_WEBHOOK_SECRET",
    "LS_VARIANT_GUIDE",
    "LS_VARIANT_INSIDER_MONTHLY",
    "LS_VARIANT_INSIDER_YEARLY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "CRON_SECRET",
    "TRUSTED_PROXY_HOPS",
    "GIT_COMMIT_SHA",
    "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
  ];
  for (const name of names) vi.stubEnv(name, undefined);
}

beforeEach(() => {
  clearAll();
  resetEnvWarnings();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("rawEnv", () => {
  it("trims, and treats an empty value as unset", () => {
    stub({ APP_URL: "  https://example.com  " });
    expect(rawEnv("APP_URL")).toBe("https://example.com");

    stub({ APP_URL: "   " });
    expect(rawEnv("APP_URL")).toBeUndefined();
  });
});

describe("isProduction", () => {
  it("is false in development and true when serving production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isProduction()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(isProduction()).toBe(true);
  });

  it("treats `next build` as not-production, so the app still builds with no env", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    expect(isProduction()).toBe(false);
    expect(() => requireInProduction("DATABASE_URL")).not.toThrow();
  });
});

describe("required-in-production variables", () => {
  it("falls back with a warning in development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(env.appUrl()).toBe("http://localhost:3000");
    expect(env.databaseUrl()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("APP_URL is not set"));
  });

  it("warns once per variable, not once per read", () => {
    vi.stubEnv("NODE_ENV", "development");

    env.appUrl();
    env.appUrl();
    env.appUrl();

    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("throws in production, naming the variable and where to get the value", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => env.databaseUrl()).toThrow(/Missing required environment variable DATABASE_URL/);
    expect(() => env.databaseUrl()).toThrow(/hPanel → Databases/);
  });

  it("tolerates a malformed value in development and rejects it in production", () => {
    stub({ APP_URL: "http://localhost:3000/" });

    vi.stubEnv("NODE_ENV", "development");
    expect(env.appUrl()).toBe("http://localhost:3000/");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("trailing slash"));

    vi.stubEnv("NODE_ENV", "production");
    expect(() => env.appUrl()).toThrow(/APP_URL must not have a trailing slash/);
  });

  it("rejects a non-https APP_URL only in production", () => {
    stub({ APP_URL: "http://example.com" });

    vi.stubEnv("NODE_ENV", "development");
    expect(env.appUrl()).toBe("http://example.com");

    vi.stubEnv("NODE_ENV", "production");
    expect(() => env.appUrl()).toThrow(/must be an https:\/\/ URL in production/);
  });

  it("throws for a too-short SESSION_SECRET in development too — there is no safe fallback", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() => env.sessionSecret()).toThrow(/Missing required environment variable SESSION_SECRET/);

    stub({ SESSION_SECRET: "short" });
    expect(() => env.sessionSecret()).toThrow(/must be 32\+ characters \(this one is 5\)/);

    stub({ SESSION_SECRET: "y".repeat(32) });
    expect(env.sessionSecret()).toBe("y".repeat(32));
  });
});

describe("feature variables", () => {
  it("are undefined when unset, in production as well as development", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(featureValue("RESEND_API_KEY")).toBeUndefined();
    expect(env.cronSecret()).toBeUndefined();
    expect(env.lsVariantId("guide")).toBeUndefined();
  });

  it("throw at the point of use, naming the variable and its source", () => {
    expect(() => requireFeatureValue("LS_VARIANT_GUIDE")).toThrow(
      /Missing required environment variable LS_VARIANT_GUIDE/,
    );
    expect(() => requireFeatureValue("LS_VARIANT_GUIDE")).toThrow(/test-mode and live ids differ/);
  });

  it("read through when set", () => {
    stub({ LS_VARIANT_INSIDER_MONTHLY: "12345", CRON_SECRET: "abc" });

    expect(env.lsVariantId("insider-monthly")).toBe("12345");
    expect(requireFeatureValue("CRON_SECRET")).toBe("abc");
  });
});

describe("optional variables", () => {
  it("are never fatal, in either environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    stub(PRODUCTION_ENV);

    expect(env.gitCommitSha()).toBeUndefined();
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("only produce a warning when set to something unusable", () => {
    stub({ ...PRODUCTION_ENV, TRUSTED_PROXY_HOPS: "lots" });

    const issue = checkEnv({ production: true }).find((i) => i.name === "TRUSTED_PROXY_HOPS");

    expect(issue).toMatchObject({ level: "warning", reason: "must be a whole number ≥ 1" });
    expect(checkEnv({ production: true, requireFeatures: true }).find((i) => i.name === "TRUSTED_PROXY_HOPS"))
      .toMatchObject({ level: "warning" });
  });
});

describe("checkEnv", () => {
  it("reports the production-required trio as errors and features as warnings", () => {
    const issues = checkEnv({ production: true });

    expect(issues.filter((i) => i.level === "error").map((i) => i.name)).toEqual([
      "APP_URL",
      "SESSION_SECRET",
      "DATABASE_URL",
    ]);
    expect(issues.filter((i) => i.level === "warning").map((i) => i.name)).toContain("CRON_SECRET");
  });

  it("reports nothing about production-required variables when not judging production", () => {
    const issues = checkEnv({ production: false });

    expect(issues.map((i) => i.name)).not.toContain("DATABASE_URL");
  });

  it("promotes feature variables to errors for pre-flight", () => {
    stub(PRODUCTION_ENV);

    const issues = checkEnv({ production: true, requireFeatures: true });

    expect(issues.every((i) => i.level === "error")).toBe(true);
    expect(issues.map((i) => i.name)).toContain("LEMONSQUEEZY_WEBHOOK_SECRET");
  });

  it("makes EMAIL_FROM an error as soon as RESEND_API_KEY is set", () => {
    stub({ ...PRODUCTION_ENV, RESEND_API_KEY: "re_test" });

    const issue = checkEnv({ production: true }).find((i) => i.name === "EMAIL_FROM");

    expect(issue).toMatchObject({ level: "error" });
    expect(issue?.reason).toMatch(/required whenever RESEND_API_KEY is set/);
  });

  it("leaves EMAIL_FROM as a warning while Resend is unconfigured", () => {
    stub(PRODUCTION_ENV);

    expect(checkEnv({ production: true }).find((i) => i.name === "EMAIL_FROM")).toMatchObject({
      level: "warning",
    });
  });
});

describe("assertProductionEnv", () => {
  it("lists every problem at once rather than the first one", () => {
    let message = "";
    try {
      assertProductionEnv();
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/3 problems/);
    expect(message).toContain("APP_URL");
    expect(message).toContain("SESSION_SECRET");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("scripts/preflight.ts");
  });

  it("does not care about feature variables — a store-less deploy still boots", () => {
    stub(PRODUCTION_ENV);

    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("catches a value that is set but invalid", () => {
    stub({ ...PRODUCTION_ENV, DATABASE_URL: "postgres://user:pw@host/db" });

    expect(() => assertProductionEnv()).toThrow(/must be a mysql:\/\/ connection string/);
  });
});
