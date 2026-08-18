import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { HealthReport } from "@/lib/health";

const report = vi.fn<() => Promise<HealthReport>>();

// The route's job is the HTTP contract — status code, headers, body shape. The
// database round-trip belongs to buildHealthReport, which is mocked out here so
// this runs without MySQL, in the style of tests/nurture-cron-route.test.ts.
vi.mock("@/lib/health", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/health")>();
  return { ...actual, buildHealthReport: () => report() };
});

const { GET } = await import("@/app/api/health/route");
const { buildHealthReport } = await vi.importActual<typeof import("@/lib/health")>("@/lib/health");

const UP: HealthReport = { ok: true, db: "up", migrations: 8, commit: null };

beforeEach(() => {
  report.mockReset();
  report.mockResolvedValue(UP);
  vi.stubEnv("GIT_COMMIT_SHA", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("200s with the database up and the applied migration count", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(UP);
  });

  it("503s when the database is unreachable, so an uptime monitor actually pages", async () => {
    report.mockResolvedValue({ ok: false, db: "down", migrations: null, commit: null });

    const res = await GET();

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ ok: false, db: "down" });
  });

  it("is never cached — a monitor must see the current state, not the last one", async () => {
    expect((await GET()).headers.get("cache-control")).toBe("no-store");
  });

  it("exposes nothing beyond the four documented keys", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:hunter2@host:3306/db");
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));

    const raw = await (await GET()).text();

    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["commit", "db", "migrations", "ok"]);
    expect(raw).not.toContain("hunter2");
  });
});

describe("buildHealthReport", () => {
  it("reports a healthy database and its migration count", async () => {
    await expect(buildHealthReport(async () => ({ up: true, migrations: 3 }))).resolves.toEqual({
      ok: true,
      db: "up",
      migrations: 3,
      commit: null,
    });
  });

  it("is not ok when the probe cannot reach the database", async () => {
    await expect(buildHealthReport(async () => ({ up: false, migrations: null }))).resolves.toEqual({
      ok: false,
      db: "down",
      migrations: null,
      commit: null,
    });
  });

  it("reports a reachable database whose migration table is missing", async () => {
    await expect(buildHealthReport(async () => ({ up: true, migrations: null }))).resolves.toMatchObject({
      ok: true,
      db: "up",
      migrations: null,
    });
  });

  it("includes the commit when the deploy stamped one in", async () => {
    vi.stubEnv("GIT_COMMIT_SHA", "abc123def456");

    const result = await buildHealthReport(async () => ({ up: true, migrations: 8 }));

    expect(result.commit).toBe("abc123def456");
  });
});
