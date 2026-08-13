import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NurtureRunResult } from "@/lib/nurture-run";

const runNurtureBatch = vi.fn<() => Promise<NurtureRunResult>>();

// The route pulls its work from runNurtureBatch; mock it so the HTTP contract
// (auth, status codes) can be tested without a database or Resend.
vi.mock("@/lib/nurture-run", () => ({
  runNurtureBatch: () => runNurtureBatch(),
}));

const { POST } = await import("@/app/api/cron/nurture/route");

const SECRET = "test-cron-secret";

function request(authorization?: string) {
  return new Request("https://example.test/api/cron/nurture", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  runNurtureBatch.mockReset();
  runNurtureBatch.mockResolvedValue({ eligible: 0, sent: 0, failed: 0 });
  process.env.CRON_SECRET = SECRET;
});

describe("POST /api/cron/nurture", () => {
  it("401s when no secret is configured at all", async () => {
    delete process.env.CRON_SECRET;

    const res = await POST(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(401);
    expect(runNurtureBatch).not.toHaveBeenCalled();
  });

  it("401s a request with no bearer token", async () => {
    const res = await POST(request());

    expect(res.status).toBe(401);
    expect(runNurtureBatch).not.toHaveBeenCalled();
  });

  it("401s a request with the wrong bearer token", async () => {
    const res = await POST(request("Bearer wrong-secret"));

    expect(res.status).toBe(401);
    expect(runNurtureBatch).not.toHaveBeenCalled();
  });

  it("runs the batch and 200s when the token matches", async () => {
    runNurtureBatch.mockResolvedValue({ eligible: 2, sent: 2, failed: 0 });

    const res = await POST(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ eligible: 2, sent: 2, failed: 0 });
    expect(runNurtureBatch).toHaveBeenCalledTimes(1);
  });

  it("500s when the batch reports a partial failure, so a monitored cron shows red", async () => {
    runNurtureBatch.mockResolvedValue({ eligible: 3, sent: 2, failed: 1 });

    const res = await POST(request(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ eligible: 3, sent: 2, failed: 1 });
  });
});
