# 07 — Plan Review & Next Steps (2026-07-24)

Review pass over docs/01–06 against the code actually on `main`. Verified locally:
`npm ci` → `npx tsc --noEmit` clean → `npm run build` green, 30 routes, middleware
38.9 kB. The plan held up well: phases 0–6 are genuinely done and the architecture
survived contact with the code. What follows is (A) what is actually left, (B) defects
found while reading the built code, and (C) product/plan improvements worth making
before launch.

## A. Where the build really stands

| Phase | Plan says | Reality |
|-------|-----------|---------|
| 0–6 | done | ✅ done, build green |
| 7 — QA + security pass | Opus 4.8, adversarial, `docs/qa-report-phase7.md` | ❌ **never ran.** No QA report exists. PR #4 was titled "phase 8" but contained only one commit (LockedTeaser tier fix) — deploy never happened |
| 8 — Deploy | needs owner | ❌ not started. No Hostinger app, no prod DB, no live env vars |
| 9 — Content & launch | needs owner | ❌ not started |

Also stale/left over:

- `README.md` still says *"Status: Planning phase complete. No application code yet."*
  — wrong for six phases now; anyone (human or model) opening the repo is misinformed.
- Guide one-time price is still **TBD** — `[PLACEHOLDER price]` appears twice on
  `/guide` and once on `/pricing`. Nothing can be sold until it is set.
- Legal placeholders block the Lemon Squeezy store review: legal entity name, contact
  email, refund window, and "last updated" dates in `/terms`, `/privacy`,
  `/refund-policy`.
- `/about` is a placeholder — for a trust-dependent info product this is a conversion
  page, not filler.

## B. Defects found in the built code

### B1. 🔴 Idempotency key silently kills subscription renewals (money bug)

`src/app/api/webhooks/lemonsqueezy/route.ts:51`

```ts
const lsEventId = `${eventName}:${resourceId}`;
```

`resourceId` is `data.id`, which for every subscription event is the **subscription
id — stable for the life of the subscription**. Consequences:

- Month 2's `subscription_payment_success` produces the same key as month 1's →
  short-circuits at line 54 as `duplicate: true` → `tierExpiresAt` is never extended →
  a paying member loses insider access ~1 month + 3 grace days after signup.
- `cancel → resume → cancel` : the second cancel is dropped.
- The failure is silent: HTTP 200, no error row, no alert. The first symptom is a
  paying customer emailing that their access disappeared.

This is exactly what review note **R3** told Phase 3 to verify and it was not done.
Fix: key on `eventName + data.id + attributes.updated_at` (R3's own fallback), and
treat the real LS shape — `subscription_payment_success` delivers a
`subscription-invoices` object with its own unique id, not a `subscriptions` object.

### B2. 🔴 The fixtures encode the wrong payload shape, so the Phase 7 replay test would have passed

`fixtures/subscription_payment_success.json` has `"type": "subscriptions"`,
`"id": "2001"` and no `updated_at` / invoice fields. Phase 7 checklist item 3
("replay every fixture twice → no duplicate users/purchases/tier flapping") would
report success on a webhook handler that drops every renewal. Fixtures must be
regenerated from a real LS test-mode delivery (capture from the dashboard's webhook
log) before they are trusted as a test oracle.

### B3. 🟠 Handler failures are invisible

The route always returns 200 except on bad signature (`route.ts:76-78`), so a thrown
handler = no LS retry, no email, no alert — just an `error` string in a DB column
nobody reads. There is no admin surface for `webhookEvents` and no monitoring
anywhere in the app. For a business where a dropped webhook = a customer who paid and
got nothing, this is the highest-value gap after B1. Minimum viable fix: return 500
for transient failures so LS retries, plus an `/admin/webhooks` page listing recent
events with their error/processed state and a manual replay button.

### B4. 🟠 No automated tests, no CI

Zero test files, no `.github/workflows`. Every phase gate has been "build is green",
which cannot catch B1 — the build is green *and* renewals are broken. The money logic
is small and pure enough to test cheaply: the webhook state machine (each event →
expected tier/tierExpiresAt), `effectiveTier` grace-period boundaries, and
`consumePasswordToken` single-use semantics. Add vitest + a GitHub Actions workflow
(install → typecheck → lint → build → test) so future model-built PRs are gated by
something stronger than a successful compile.

### B5. 🟡 Smaller items

- `handleOrderCreated` falls back to `productKey = "guide"` when variant mapping fails
  (`route.ts:162`). A misconfigured `LS_VARIANT_*` env var therefore silently
  downgrades an insider purchase instead of erroring loudly.
- `handleOrderRefunded` only acts when `user.tier === "guide"`; a refunded order for a
  user whose tier drifted otherwise is a no-op. Rare, but the branch deserves a
  comment or a widened rule.
- Rate-limit buckets are in-memory (correct for single-process Hostinger, per the
  stack rule) but reset on every deploy/restart — acceptable, worth documenting so
  nobody "fixes" it with Redis later.
- No GDPR data export/delete path, while `/privacy` will promise data rights. Two
  admin actions (export user JSON, hard-delete user) close it.
- Session stores `role`/`tier` at login; both are re-read from the DB in
  `requireAdmin`/`effectiveTier`, so this is safe — but the cached `tier` is now
  effectively unused and invites a future bug. Consider dropping it from `SessionData`.

## C. Plan-level improvements

### C1. 🔴 The pricing ladder is upside down and will cannibalize the guide

Decided prices (doc 05): guide = one-time, TBD in the $7–27 range; insider =
**$7/mo or $47/yr**; and Q3 decided **insider includes everything**.

A rational buyer therefore never buys the guide: $7 for one month of insider unlocks
the entire guide plus the updates feed, and can be cancelled immediately. The tripwire
undercuts itself, and the headline conversion asset (the $x guide) becomes dead
inventory. Three ways out, pick one before Phase 9:

1. **Raise insider** to $19–29/mo and keep it "everything included". Guide at $27
   stays a real tripwire; insider is the premium tier. Simplest, and $7/mo is
   underpriced for residency-grade information anyway.
2. **Narrow insider**: insider = updates feed + new material + community, and does
   *not* include the core guide. Requires reverting Q3 and changing the hierarchical
   `minTier` gate to an entitlement check — real code work, so decide now, not later.
3. **Insider as an add-on**: guide purchase required before insider checkout. Keeps
   the schema, changes only the pricing page and checkout gating.

Recommendation: **option 1** — no code change, protects both products, and a $7/mo
price point sets a low-value anchor for a product whose subject matter (residency,
banking, taxes) is high-stakes.

### C2. ✅ There is no email capture anywhere on the marketing site — **shipped 2026-08-05**

Shipped: a double opt-in lead capture system. `leads` + `lead_tokens` tables
(migration `drizzle/0001_curved_madelyne_pryor.sql`), a `LeadCaptureForm` on `/` and
`/guide` offering the free document checklist, a `subscribeAction` that validates and
rate-limits by email and IP and is idempotent per address, a `confirm-subscription`
email through the existing Resend wrapper (single-use, hashed, 7-day token mirroring
the password-token rules), a `/subscribe/confirm` page, a `"Lead captured"` Plausible
event, and a read-only `/admin/leads` list with per-row delete so a removal request
can be honoured. Unit tests cover validation, upsert idempotency, and token
single-use/expiry.

Self-service unsubscribe shipped 2026-08-13: `/unsubscribe?token=…` backed by a
hashed, single-use `unsubscribe`-purpose lead token, minted per send, with a link
in the footer of every outbound lead email.

Still open, deliberately: the checklist PDF itself (owner content — add it to the
Resources set in docs/09 §2) and the 4-email sequence below. Only confirmed,
non-unsubscribed rows may ever be mailed.

Original finding:

For a $7–27 info product the list *is* the business, and right now the only way to
enter the funnel is to buy immediately. Every visitor who is not ready today is lost
permanently. Highest-ROI addition before launch:

- A lead magnet (e.g. "Paraguay residency document checklist — PDF") behind an email
  form on `/` and `/guide`.
- A `leads` table + double opt-in, reusing the existing Resend wrapper.
- A short automated sequence (day 0 checklist → day 2 cost breakdown → day 4 the
  three mistakes → day 6 guide offer). Doc 04 §5 currently parks "email sequence
  beyond transactional" as post-launch backlog; it should be launch scope, or the
  paid/SEO traffic you send has no second chance.

### C3. 🟠 No analytics — you cannot optimize what you cannot see

Nothing tracks visits, checkout starts, or conversion. Add a cookieless analytics
script (Plausible/Umami — no consent banner needed, keeps the privacy page simple) and
mark three events: guide checkout started, insider checkout started, purchase
completed. Ten minutes of work that determines whether every later copy decision is
evidence-based or a guess.

### C4. 🟠 Retention has no mechanism

Insider's whole value is the updates feed, but nothing in the plan schedules content
or notifies members that new material exists. Cheap and effective: a monthly
"what changed in Paraguayan residency law" post + an email blast to insiders when an
update publishes (one admin button, reuses `sendEmail`). Without it, month-2 churn on
a $7 subscription will be brutal.

### C5. 🟡 Other growth levers, roughly by effort/return

- **Affiliate program** — Lemon Squeezy has it built in; Paraguay/expat YouTubers and
  newsletter writers are a natural fit. Zero code.
- **Order bump / annual upsell at checkout** — LS-native, already noted in doc 04 §5.
- **Programmatic SEO** — the blog is DB-backed already; a set of comparison and
  cost-breakdown posts (Paraguay vs Panama/Uruguay residency, total cost, timeline,
  banking) is the cheapest durable traffic for this niche.
- **Spanish version of the marketing site** — the audience researching Paraguayan
  residency skews EN, but ES doubles the SEO surface at low marginal cost once the
  content exists.
- **Dunning surface**: when a subscription goes `past_due`, show an in-portal banner
  linking to the LS customer portal. Recovers revenue LS's own emails miss.

### C6. 🟡 Process improvement for the remaining phases

The plan's "done = build clean, committed" gate is what let B1 through. For phases
7–9, tighten it to: build clean **+ tests pass in CI + the specific invariant from
doc 02 §9 demonstrated with evidence in the phase's report**. Phase 7's checklist
already asks for evidence; it just needs to be enforced before Phase 8 starts.

## Recommended order of work

1. Fix **B1** + regenerate fixtures (**B2**) — nothing else matters if renewals break.
2. Add vitest coverage of the webhook state machine + `effectiveTier`, and the CI
   workflow (**B4**) — this is what makes the fix verifiable.
3. Decide **C1** pricing, set the guide price, clear every `[PLACEHOLDER]` (**A**).
4. Run **Phase 7** properly against a real local MySQL and write
   `docs/qa-report-phase7.md`, including the adversarial gating checks.
5. Add webhook visibility (**B3**) and analytics (**C3**) — both are pre-launch, both
   are small.
6. **Phase 8** deploy, then **Phase 9** content/launch per doc 04.
7. Post-launch, in order: lead magnet + sequence (**C2**), update cadence + insider
   notifications (**C4**), then the growth levers in **C5**.

Items 1–2 and 5 are pure code with no external dependency — they can be built before
any Hostinger/LS account exists, consistent with the plan's front-loading principle.
