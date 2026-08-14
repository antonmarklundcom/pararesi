// Single source of truth for owner-supplied values that were previously hardcoded
// as [PLACEHOLDER] markers scattered across the marketing pages (docs/07 §A).
// Fill in each TODO(owner) field below — that's the only edit needed before launch.

export const siteConfig = {
  // Discounted from the $97 anchor price — owner decision, see docs/07 §C1.
  guidePrice: "$7",
  guideOriginalPrice: "$97",

  legalEntityName: "Paraguay Residency Guide",

  /** TODO(owner): support/contact email shown on Terms, Privacy, Refund Policy. */
  contactEmail: "[SET CONTACT EMAIL]",

  // The Guide is a final-sale, no-refunds product — an owner decision, not an
  // unset field. 0 means "no refunds"; see /refund-policy.
  refundWindowDays: 0,

  legalLastUpdated: "2026-08-14",

  /**
   * TODO(owner): public URL of the free document-checklist PDF (the lead
   * magnet promised by LeadCaptureForm). Leave null until the file exists —
   * /subscribe/confirm falls back to a "we'll be in touch" message when unset,
   * so nothing breaks or links to a 404 in the meantime.
   */
  leadMagnetChecklistUrl: null as string | null,

  // Insider subscription prices are already decided (docs/05) and live in code —
  // centralized here so /pricing and checkout copy can't drift out of sync.
  insiderMonthlyPrice: "$7",
  insiderYearlyPrice: "$47",
} as const;
