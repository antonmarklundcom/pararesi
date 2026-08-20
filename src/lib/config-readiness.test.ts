import { describe, it, expect } from "vitest";
import { findConfigGaps, isPlaceholder } from "./config-readiness";
import { siteConfig } from "@/config/site";

const filled = {
  contactEmail: "hello@example.com",
  legalEntityName: "Example AB",
  guidePrice: "$7",
  leadMagnetChecklistUrl: "/downloads/checklist.pdf" as string | null,
};

describe("isPlaceholder", () => {
  it("treats the [SET …] marker shape and a null as unset", () => {
    expect(isPlaceholder("[SET CONTACT EMAIL]")).toBe(true);
    expect(isPlaceholder("  [SET CONTACT EMAIL]")).toBe(true);
    expect(isPlaceholder(null)).toBe(true);
  });

  it("accepts a real value", () => {
    expect(isPlaceholder("hello@example.com")).toBe(false);
    expect(isPlaceholder("$7")).toBe(false);
  });
});

describe("findConfigGaps", () => {
  it("reports nothing once every owner field is filled", () => {
    expect(findConfigGaps(filled)).toEqual([]);
  });

  it("names each unfilled field and what it blocks", () => {
    const gaps = findConfigGaps({ ...filled, contactEmail: "[SET CONTACT EMAIL]", leadMagnetChecklistUrl: null });

    expect(gaps.map((gap) => gap.field)).toEqual(["contactEmail", "leadMagnetChecklistUrl"]);
    expect(gaps[0].blocks).toContain("Terms");
  });

  it("still describes the live site config, whatever state it is in", () => {
    // Not an assertion about today's values — just that the real config is a
    // valid input, so the dashboard can never throw on it.
    expect(Array.isArray(findConfigGaps(siteConfig))).toBe(true);
  });
});
