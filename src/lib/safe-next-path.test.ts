import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-next-path";

/** QA-07-F4 (docs/qa-report-phase7.md): open redirect on the login form's `?next=`. */
describe("safeNextPath", () => {
  it("accepts an ordinary same-site path", () => {
    expect(safeNextPath("/portal")).toBe("/portal");
    expect(safeNextPath("/portal/course/basics/intro")).toBe("/portal/course/basics/intro");
    expect(safeNextPath("/admin/users?tier=insider")).toBe("/admin/users?tier=insider");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("//evil.example/portal")).toBeNull();
  });

  /**
   * The regression this file exists for. Browsers normalise a backslash to a
   * forward slash when parsing a URL, so each of these leaves the app as
   * `//evil.example` — an off-site redirect that passed a "starts with /" check.
   */
  it("rejects a backslash-smuggled protocol-relative URL", () => {
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("/\\/evil.example")).toBeNull();
    expect(safeNextPath("/\\\\evil.example")).toBeNull();
  });

  it("rejects absolute URLs and non-strings", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("portal")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });

  it("rejects control characters that a proxy and a browser might parse differently", () => {
    expect(safeNextPath("/portal\r\nSet-Cookie: a=b")).toBeNull();
    expect(safeNextPath("/portal\n")).toBeNull();
    expect(safeNextPath("/\tportal")).toBeNull();
  });

  it("rejects the empty and bare-slash cases rather than returning them", () => {
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("/")).toBeNull();
  });
});
