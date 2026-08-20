/**
 * Which owner-supplied values in src/config/site.ts are still unset.
 *
 * The placeholders are all written in the `[SET …]` shape, so an unfilled
 * field is detectable rather than merely commented — and a launch-blocking
 * placeholder that reaches production (Lemon Squeezy checks the legal pages
 * before activating a store) shows up on the dashboard instead of on the
 * live site.
 */

import { siteConfig } from "@/config/site";

export interface ConfigGap {
  field: string;
  /** Where an unfilled value is visible to a customer. */
  blocks: string;
}

/** A value the owner never filled in — see the `[SET …]` markers in site.ts. */
export function isPlaceholder(value: string | null): boolean {
  return value === null || value.trim().startsWith("[");
}

/**
 * Widened past `siteConfig`'s literal types on purpose: the config is `as
 * const`, so a `Pick` of it would only accept today's exact strings and the
 * function could never be tested against a filled-in value.
 */
export interface OwnerConfig {
  contactEmail: string;
  legalEntityName: string;
  guidePrice: string;
  leadMagnetChecklistUrl: string | null;
}

export function findConfigGaps(config: OwnerConfig): ConfigGap[] {
  const gaps: ConfigGap[] = [];

  if (isPlaceholder(config.contactEmail)) {
    gaps.push({ field: "contactEmail", blocks: "Terms, Privacy and Refund Policy" });
  }
  if (isPlaceholder(config.legalEntityName)) {
    gaps.push({ field: "legalEntityName", blocks: "the legal pages Lemon Squeezy reviews" });
  }
  if (isPlaceholder(config.guidePrice)) {
    gaps.push({ field: "guidePrice", blocks: "every buy button" });
  }
  if (isPlaceholder(config.leadMagnetChecklistUrl)) {
    gaps.push({ field: "leadMagnetChecklistUrl", blocks: "the checklist promised on /subscribe/confirm" });
  }

  return gaps;
}

export function pendingOwnerConfig(): ConfigGap[] {
  return findConfigGaps(siteConfig);
}
