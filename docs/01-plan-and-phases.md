# 01 — Master Plan & Build Phases

**Goal:** launch a sellable product with the minimum human input, front-loading all code
that can be written before any external account/credential/content exists.

**Planning model:** Fable 5 (this document set).
**Build models:** Opus 4.8 for money/security-critical phases, Sonnet (latest) for
scaffolding, CRUD, and UI-heavy phases. Rationale: auth, payments, and tier logic are
where a subtle bug costs real money or leaks paid content — spend the stronger model
there. Scaffold/CRUD/marketing phases are well-specified pattern work where Sonnet is
faster and equally reliable.

## Phase overview

| # | Phase | Model | Human input needed? | Depends on |
|---|-------|-------|--------------------|------------|
| 0 | Scaffold & foundations | Sonnet | none | — |
| 1 | DB schema + client + seed scripts | Sonnet | none | 0 |
| 2 | Auth core (sessions, tokens, gating helpers) | **Opus 4.8** | none | 1 |
| 3 | Lemon Squeezy integration + email | **Opus 4.8** | Decisions in doc 05 (5 min, no accounts needed yet) | 2 |
| 4 | Members portal | Sonnet | none | 2 (3 for upsell CTAs — stub OK) |
| 5 | Admin panel | Sonnet | none | 2 |
| 6 | Marketing site + SEO | Sonnet | none (placeholder copy/pricing OK) | 1 |
| 7 | Integration QA + security pass | **Opus 4.8** | none | 3–6 |
| 8 | Deploy to Hostinger | Sonnet (guided) | **YES** — accounts, DB, domain, env vars | 7 |
| 9 | Content, real LS products, launch | Sonnet assists | **YES** — real content, LS store live, test buy | 8 |

**Phases 0–7 are 100 % codeable with zero external dependencies.** The app must build
(`npm run build`, zero type errors) and run locally against any MySQL with mock env
values throughout. All external services are env-var driven and fail soft in dev.

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

### Phase 7 — Integration QA + security pass (Opus 4.8)
Full-flow test with seeded data: webhook fixture → user created → set-password email
(logged to console in dev) → login → gated content → upgrade → downgrade. Verify: no
client-side secrets, no lesson content reachable without server tier check, rate
limits live, `npm run build` clean, no edge-runtime deps, works under plain
`next start`.

### Phase 8 — Deploy (Sonnet, guided by nextjs-deploy-hostinger skill)
**First phase that needs the human.** See doc 04 for the exact list of things the
owner must provide (Hostinger slot, MySQL DB, domain, Resend, Lemon Squeezy store,
env vars) and the deploy runbook.

### Phase 9 — Content & launch
Real curriculum content via admin panel, real LS products/variants + webhook URL,
$0.x test-mode purchase end-to-end, then live-mode buy, then launch checklist in
doc 04.

## Rules for every build phase

1. Read the three skills (or the `/docs` restatement) before writing code.
2. `npm run build` green with zero type errors before a phase is "done".
3. Commit per phase with descriptive messages; never commit `.env`.
4. New env var ⇒ add to `.env.example` with a comment saying where it comes from.
5. Stack choices are fixed — a builder session must never swap libraries or add
   NextAuth/Prisma/Stripe/edge features "for convenience".
