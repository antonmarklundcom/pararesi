import { describe, it, expect, afterEach } from "vitest";
import { parseForwardedFor, trustedProxyHops } from "./request-ip";

/**
 * QA-07-F9 (docs/qa-report-phase7.md). `x-forwarded-for` is appended to by each
 * hop, so its leftmost entries are supplied by the caller. Reading the leftmost
 * one let anyone present a different "IP" on every request and walk straight
 * through every IP-keyed rate limit in the app.
 */
describe("parseForwardedFor", () => {
  it("returns the entry the nearest proxy appended, not the one the client sent", () => {
    expect(parseForwardedFor("1.2.3.4, 203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("ignores a forged chain entirely with one proxy in front", () => {
    const forged = "10.0.0.1, 10.0.0.2, 10.0.0.3, 203.0.113.9";
    expect(parseForwardedFor(forged, 1)).toBe("203.0.113.9");
  });

  it("counts in from the right when several proxies are trusted", () => {
    // client, CDN, host proxy — with 2 trusted hops the client is the CDN's
    // record of it, one in from the right.
    expect(parseForwardedFor("1.2.3.4, 198.51.100.7, 203.0.113.9", 2)).toBe("198.51.100.7");
  });

  it("handles a single-entry header", () => {
    expect(parseForwardedFor("203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("clamps rather than falling off either end", () => {
    // More trusted hops claimed than entries present: the leftmost is as far as
    // it goes, which over-limits rather than trusting a forged entry.
    expect(parseForwardedFor("203.0.113.9", 5)).toBe("203.0.113.9");
    expect(parseForwardedFor("1.2.3.4, 203.0.113.9", 0)).toBe("203.0.113.9");
  });

  it("tolerates whitespace, empty entries and a missing header", () => {
    expect(parseForwardedFor("  1.2.3.4 ,  203.0.113.9  ", 1)).toBe("203.0.113.9");
    expect(parseForwardedFor("203.0.113.9, , ", 1)).toBe("203.0.113.9");
    expect(parseForwardedFor("", 1)).toBeNull();
    expect(parseForwardedFor(null, 1)).toBeNull();
    expect(parseForwardedFor(" , ", 1)).toBeNull();
  });
});

describe("trustedProxyHops", () => {
  const original = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = original;
  });

  it("defaults to one proxy, matching the documented Hostinger deployment", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(trustedProxyHops()).toBe(1);
  });

  it("reads a configured hop count", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(trustedProxyHops()).toBe(2);
  });

  it("falls back to the safe default on junk rather than trusting more hops", () => {
    for (const value of ["", "0", "-1", "abc", "1.5"]) {
      process.env.TRUSTED_PROXY_HOPS = value;
      expect(trustedProxyHops()).toBe(1);
    }
  });
});
