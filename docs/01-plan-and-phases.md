# 01 — Master Plan & Build Phases

> **Authored by Fable 5** (planning/architecture model) for handoff to
> **Sonnet 5 / Opus 4.8** builder sessions. Fable 5 owns architecture, spec/schema
> decisions, gap analysis, and review gates; Sonnet 5 handles most build phases and
> Opus 4.8 the money/security-critical ones — don't burn Fable time on routine
> implementation. Reviewed and re-confirmed by Fable 5 on 2026-07-16
> (see docs/06-fable5-review-notes.md for corrections builders must apply).
>
> **Status as of 2026-08-02:** phases 0–6 are done and phase 7 is under way — see
> docs/07-review-and-next-steps.md for the post-build review that found the gaps
> phase 7 actually closed (labeled B1–B5 below), and the "Phase overview" table
> for what's done vs. still open.

**Goal:** launch a sellable product with the minimum human input, front-loading all code
that can be written before any external account/credential/content exists.

**Planning model:** Fable 5 (this document set).
**Build models:** Opus 4.8 for money/security-critical phases, Sonnet (latest) for
scaffolding, CRUD, and UI-heavy phases. Rationale: auth, payments, and tier logic are
where a subtle bug costs real money or leaks paid content — spend the stronger model
there. Scaffold/CRUD/marketing phases are well-specified pattern work where Sonnet is
faster and equally reliable.

## Phase overview

| # | Phase | Model | Human input needed? | Depends on | Status |
|---|-------|-------|--------------------|------------|--------|
| 0 | Scaffold & foundations | Sonnet | none | — | ✅ Done |
| 1 | DB schema + client + seed scripts | Sonnet | none | 0 | ✅ Done |
| 2 | Auth core (sessions, tokens, gating helpers) | **Opus 4.8** | none | 1 | ✅ Done |
| 3 | Lemon Squeezy integration + email | **Opus 4.8** | Decisions in doc 05 (5 min, no accounts needed yet) | 2 | ✅ Done |
| 4 | Members portal | Sonnet | none | 2 (3 for upsell CTAs — stub OK) | ✅ Done |
| 5 | Admin panel | Sonnet | none | 2 | ✅ Done |
| 6 | Marketing site + SEO | Sonnet | none (placeholder copy/pricing OK) | 1 | ✅ Done |
| 7 | Integration QA + security pass, **expanded** to the B-series hardening from docs/07 | **Opus 4.8** + Sonnet | none | 3–6 | 🟡 Partly complete — see below |
| 8 | Deploy to Hostinger | Sonnet (guided) | **YES** — accounts, DB, domain, env vars | 7 | ⛔ Owner-blocked, not started |
| 9 | Content, real LS products, launch | Sonnet assists | **YES** — real content, LS store live, test buy | 8 | ⛔ Owner-blocked, not started |

**Phases 0–7 are 100 % codeable with zero external dependencies.** The app must build
(`npm run build`, zero type errors) and run locally against any MySQL with mock env
values throughout. All external services are env-var driven and fail soft in dev.

**Phases 8 and 9 cannot proceed without the owner.** Nothing left in either phase is
codeable in advance — see "What remains owner-blocked" at the end of this document.

## Phase descriptions

### Phase 0 — Scaffold & foundations (Sonnet)
Next.js 15 + TS strict + Tailwind scaffold per the stack skill checklist. Route-group
skeleton `(marketing)`, `(portal)`, `admin`, auth routes as stubs. Base layout, fonts,
color tokens (deep green/navy palette), `.env.example` fully commented, `.gitignore`,
`npm run build` green. No DB, no auth yet.

### Phase 1 — DB schema + client + scripts (Sonnet)
`src/db/schema.ts` (all 11 tables per doc 02), `src/db/index.ts` single pool
(connectionLimit 8, timezone "Z"), drizzle config + migration generation,
`scripts/seed-admin.ts` and `scripts/seed-demo-content.ts` (idempotent upserts,
`import 'dotenv/config'` first line). Build must pass **without** a reachable DB.

### Phase 2 — Auth core (Opus 4.8)
iron-session wiring, bcrypt, `/login`, `/forgot-password`, `/reset-password`,
`/set-password` (token from purchase email), passwordTokens lifecycle,
`requireUser` / `requireTier` / `requireAdmin` server helpers, `middleware.ts`
(UX-only gate for `/portal/*` and `/admin/*`), in-memory rate limiting on all
credential endpoints. This phase sets the security foundation — every later phase
consumes its helpers.

### Phase 3 — Lemon Squeezy + email (Opus 4.8)
Webhook route with raw-body HMAC verification, `webhookEvents` idempotency, the full
event → tier state machine (doc 02 §6), checkout creation server action,
`src/lib/email.ts` (Resend) with welcome/set-password, reset, payment-received
templates. Everything testable locally with `lemonsqueezy.ts` mocked env + sample
webhook payload fixtures committed under `/fixtures`.

### Phase 4 — Members portal (Sonnet)
`/portal` dashboard (progress, latest updates), course pages with server-side markdown
rendering, lesson progress toggle, resources, updates feed, account page. Insider-only
content rendered as locked teasers with upgrade CTA for guide members. Every page
re-checks tier server-side via Phase 2 helpers — never trust middleware alone.

### Phase 5 — Admin panel (Sonnet)
One route per entity (modules, lessons, resources, updates, blog, users) with shared
`DataTable` + `EntityForm` components per the stack skill. Users list with tier
override. No CMS abstraction, plain server actions.

### Phase 6 — Marketing site + SEO (Sonnet)
`/`, `/guide` long-form sales page (problem → what's inside → curriculum preview from
published modules → pricing → FAQ → guarantee), `/pricing`, `/blog` (DB-backed),
`/about`, `/terms`, `/privacy`, `/refund-policy`. Metadata API everywhere, sitemap.ts +
robots.ts, JSON-LD (Product, Article, FAQPage), OG images. Placeholder copy is fine —
structure and SEO plumbing are the deliverable. Education-product wording only.

### Phase 7 — Integration QA + security pass (Opus 4.8 + Sonnet), expanded

The original scope (full-flow test with seeded data: webhook fixture → user created →
set-password email → login → gated content → upgrade → downgrade; no client-side
secrets, no lesson content reachable without a server tier check, rate limits live,
clean build, no edge-runtime deps) never ran as its own checklist pass. Instead, the
post-build review in docs/07-review-and-next-steps.md found concrete defects (B1–B5)
and product gaps (C1–C6), and subsequent Opus/Sonnet sessions closed them directly.
That work now **is** phase 7's real content. Done so far:

- **B1 — renewal idempotency (Opus).** Fixed the webhook idempotency key so monthly
  subscription renewals no longer collide and silently expire a paying member's
  access.
- **B2 — fixture correctness (Opus).** Regenerated webhook fixtures to match the real
  Lemon Squeezy payload shapes, so the replay tests actually exercise the renewal path.
- **B3 — webhook visibility (Opus + Sonnet).** Handler failures now return 500 so Lemon
  Squeezy retries; added `/admin/webhooks` (recent events, status, raw payload viewer,
  manual replay).
- **B4 — tests + CI (Opus).** vitest coverage of the webhook state machine, tier grace
  periods, and token semantics; GitHub Actions workflow (install → typecheck → lint →
  build → test) gates every PR.
- **B5 — smaller money-path hardening (Opus).** Fixed the silent guide-fallback on a
  misconfigured variant env var, widened the refund rule to derive tier rather than
  only act on `tier === "guide"`, and other small correctness fixes.
- **Placeholder consolidation (Sonnet).** Every owner-supplied value (guide price,
  legal entity name, contact email, refund window, legal last-updated date) moved into
  `src/config/site.ts` with `TODO(owner)` markers — a single file to edit instead of
  six pages.
- **Analytics (Sonnet, C3).** Cookieless Plausible integration, env-var gated and a
  no-op until an owner sets `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; tracks checkout-started and
  purchase-completed events.
- **GDPR admin actions (Sonnet, part of B5's follow-up).** Export-user-as-JSON and
  hard-delete-user actions on `/admin/users`, closing the gap `/privacy` promises.

**Still open, and still codeable without the owner:**

- No `docs/qa-report-phase7.md` has been written, and the original checklist's
  adversarial gating checks (verifying no lesson content leaks without a server tier
  check, etc.) haven't been run as a discrete pass.
- **C1 — pricing ladder.** docs/07 flags that Insider ($7/mo, includes everything)
  currently undercuts the Guide tripwire. Needs an explicit decision (see docs/07 §C1
  for the three options) before it's a code change.
- **C2 — email capture / lead magnet.** Nothing on the marketing site captures an email
  before purchase; docs/07 recommends this as the highest-ROI addition before launch.
- **C4 — retention mechanism.** No update-cadence or insider-notification mechanism
  exists yet for the updates feed that's supposed to be Insider's core value.
- **C5 — growth levers.** Affiliate program, order bump/annual upsell, programmatic SEO,
  Spanish site, dunning banner — all listed in docs/07 §C5, none started.

### Phase 8 — Deploy (Sonnet, guided by nextjs-deploy-hostinger skill)
**First phase that needs the human.** See doc 04 for the exact list of things the
owner must provide (Hostinger slot, MySQL DB, domain, Resend, Lemon Squeezy store,
env vars) and the deploy runbook.

### Phase 9 — Content & launch
Real curriculum content via admin panel, real LS products/variants + webhook URL,
$0.x test-mode purchase end-to-end, then live-mode buy, then launch checklist in
doc 04.

## What remains owner-blocked

Nothing below is a coding task — each needs an account, a decision only the owner can
make, or content only the owner can write:

- **Fill in `src/config/site.ts`.** Guide price, legal entity name, contact email,
  refund window (days), and the legal pages' last-updated date all default to visibly
  unset placeholders until the owner sets them.
- **Decide the pricing ladder (C1).** Pick one of the three options in docs/07 §C1
  before phase 9 — otherwise Insider continues to undercut the Guide.
- **Phase 8 — Deploy.** Hostinger Node.js slot, production MySQL database, domain +
  DNS, a verified Resend sending domain, and a live Lemon Squeezy store with real API
  keys and variant IDs. See doc 04 for the full list and the deploy runbook.
- **Phase 9 — Content & launch.** Real curriculum content written into the admin panel
  (modules, lessons, resources, updates, about-page story), the Lemon Squeezy store
  actually configured with the decided prices, a test-mode purchase run end-to-end,
  then a live-mode purchase, then the launch checklist in doc 04.
- **Optional pre-launch, per docs/07:** an email capture / lead magnet (C2), an
  update-cadence or insider-notification mechanism (C4), and the growth levers in C5
  (affiliate program, order bump, programmatic SEO, Spanish site, dunning banner) — all
  of these are real feature work an owner could ask a Sonnet session to build, but none
  are decided or requested yet.

## Rules for every build phase

1. Read the three skills (or the `/docs` restatement) before writing code.
2. `npm run build` green with zero type errors before a phase is "done".
3. Commit per phase with descriptive messages; never commit `.env`.
4. New env var ⇒ add to `.env.example` with a comment saying where it comes from.
5. Stack choices are fixed — a builder session must never swap libraries or add
   NextAuth/Prisma/Stripe/edge features "for convenience".
