// Single source of truth for owner-supplied values that were previously hardcoded
// as [PLACEHOLDER] markers scattered across the marketing pages (docs/07 §A).
// Fill in each TODO(owner) field below — that's the only edit needed before launch.

export const siteConfig = {
  /** TODO(owner): set the one-time Guide price, e.g. "$27". */
  guidePrice: "[SET GUIDE PRICE]",

  /** TODO(owner): legal entity name that operates this business (for Terms). */
  legalEntityName: "[SET LEGAL ENTITY NAME]",

  /** TODO(owner): support/contact email shown on Terms, Privacy, Refund Policy. */
  contactEmail: "[SET CONTACT EMAIL]",

  /** TODO(owner): refund window in days for the one-time Guide purchase. */
  refundWindowDays: 0,

  /** TODO(owner): ISO date (e.g. "2026-08-02") the legal pages were last reviewed. */
  legalLastUpdated: "[SET LAST UPDATED DATE]",

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
