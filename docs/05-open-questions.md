# 05 — Open Lemon Squeezy Decisions (resolve before Phase 3)

Per project brief: stack questions are closed, but LS product structure has a few
genuinely ambiguous points. Each has a **recommended default** — if the owner says
nothing, Phase 3 builds the default. Record decisions by editing this file.

## Q1. Product structure in the LS dashboard

**Recommended (default):** two products in one store —
1. "Paraguay Residency Guide" — single one-time variant → `LS_VARIANT_GUIDE`
2. "Residency Insider" — subscription with two variants (monthly, yearly) →
   `LS_VARIANT_INSIDER_MONTHLY`, `LS_VARIANT_INSIDER_YEARLY`

Alternative: one product with three variants — messier checkout copy, no benefit.

**Decision:** _pending (default applies)_

## Q2. Price points

Brief says $7–27 tripwire. Recommended: **guide $19 one-time**, insider **$19/mo or
$149/yr** (yearly ≈ 35 % off, standard anchor). Prices live only in LS + marketing
copy — no code dependency, changeable anytime.

**Decision:** _pending (placeholders used in copy until set)_

## Q3. Does buying insider *include* the guide content?

Recommended: **yes** — insider unlocks everything (minTier gate is hierarchical:
insider ≥ guide). Simpler mental model, matches the schema. Consequence: an
insider-first buyer who cancels and never bought guide drops to `none` (per the
downgrade rule), which is correct for a subscription they stopped paying for.

**Decision:** _pending (default applies)_

## Q4. Guide-owner upgrade pricing to insider

LS cannot prorate across separate products. Recommended: **no discount mechanics at
launch** — insider is priced as pure subscription value; the guide was a cheap
tripwire. Optional later: LS discount code shown only to guide members on the
upsell CTA.

**Decision:** _pending (default applies)_

## Q5. Grace period after failed renewal

Recommended: **3 days** past `renews_at` before effectiveTier drops (constant in
code, `TIER_GRACE_DAYS`). LS dunning usually retries within this window.

**Decision:** _pending (default applies)_

## Q6. Refund handling

`order_refunded` webhook: recommended **handle it** (Phase 3): mark purchase
status refunded; if it was the guide purchase and user has no active subscription →
tier=none. Keeps the tier state honest and is ~20 lines.

**Decision:** _pending (default applies)_
