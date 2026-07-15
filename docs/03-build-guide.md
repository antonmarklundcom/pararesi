# 03 — Build Guide (phase-by-phase, with kickoff prompts)

How to use: open a fresh Claude Code session per phase (or per 2–3 adjacent phases),
select the model listed, paste the kickoff prompt. Every prompt assumes the session
reads `/docs/01`, `/docs/02` and — when available — the three skills
(`nodejs-mysql-hostinger-stack`, `nextjs-deploy-hostinger`, `nextjs-national-lead-gen`).

**Definition of done for every phase:** `npm run build` passes with zero type errors,
work committed with a clear message, `.env.example` updated for any new var.

---

## Phase 0 — Scaffold & foundations — **Sonnet**

Deliverables:
- Next.js 15 (App Router) + TypeScript strict + Tailwind, initialized in repo root.
- Folder skeleton exactly per doc 02 §1; route groups with placeholder pages.
- Root layout + `(marketing)` layout (header/footer shell), font setup, Tailwind
  theme tokens: deep green primary, navy secondary, generous spacing scale.
- `.env.example` with every var from doc 04 §2, each commented with where it comes from.
- No DB, no auth. Build green.

Kickoff prompt:
> Read docs/01-plan-and-phases.md and docs/02-architecture.md. Execute Phase 0 exactly:
> scaffold Next.js 15 + TS strict + Tailwind in the repo root, create the full
> directory/route-group skeleton from doc 02 §1 with placeholder pages, set up the
> deep green/navy Tailwind theme and marketing layout shell, and write the complete
> commented .env.example from doc 04 §2. Target Hostinger managed Node.js: no edge
> runtime, must run under `next start`. Done = npm run build clean, committed.

## Phase 1 — DB schema + client + seed scripts — **Sonnet**

Deliverables:
- `src/db/schema.ts`: all 11 tables from doc 02 §2, exact enums/uniques/nullables.
- `src/db/index.ts`: the single mysql2 pool (`connectionLimit: 8`, `timezone: "Z"`),
  lazily created so importing it never connects at build time.
- `drizzle.config.ts` + generated SQL migration in `/drizzle`.
- `scripts/seed-admin.ts` (ADMIN_EMAIL/ADMIN_PASSWORD from env, idempotent upsert)
  and `scripts/seed-demo-content.ts` (2 modules, 6 lessons, 3 resources, 2 updates
  posts, 2 blog posts; idempotent by slug). Both start with `import 'dotenv/config'`
  (tsx does not autoload .env — deploy skill).

Kickoff prompt:
> Read docs/02-architecture.md §2. Execute Phase 1: implement the exact schema in
> src/db/schema.ts (Drizzle mysql-core), the single pool in src/db/index.ts with
> connectionLimit 8 and timezone "Z" (lazy — build must pass without a DB), drizzle
> config + generated migration, and the two idempotent tsx seed scripts from doc 03
> with `import 'dotenv/config'` first. Do not create any other DB connection anywhere.
> Done = npm run build clean with no database reachable, committed.

## Phase 2 — Auth core — **Opus 4.8**

Deliverables:
- `src/lib/session.ts` (iron-session config), `src/lib/auth.ts` (`requireUser`,
  `requireTier`, `requireAdmin`, `effectiveTier` per doc 02 §3–4),
  `src/lib/ratelimit.ts` (in-memory fixed window).
- Pages + server actions: /login, /forgot-password, /reset-password, /set-password.
  Token lifecycle per doc 02 §3 (hashed, single-use, purpose-scoped expiry).
- `middleware.ts`: cookie-presence/unseal gate for /portal/* and /admin/*, redirect
  to /login?next=…. No DB imports (edge sandbox).
- Anti-enumeration: forgot-password always responds "if that email exists…".
- Dev email logging via a stub `src/lib/email.ts` (Phase 3 completes it).

Kickoff prompt:
> Read docs/02-architecture.md §3–4 and the nodejs-mysql-hostinger-stack skill's
> auth/roles rules. Execute Phase 2: iron-session + bcrypt auth exactly as specified —
> requireUser/requireTier/requireAdmin/effectiveTier helpers, login/forgot/reset/
> set-password flows with hashed single-use tokens, in-memory rate limiting on all
> credential endpoints, UX-only middleware with no DB imports. No public register
> route. Every security invariant in doc 02 §9 that touches auth must hold.
> Done = flows work against a local MySQL with seeded admin, build clean, committed.

## Phase 3 — Lemon Squeezy + email — **Opus 4.8**

Prereq: decisions in docs/05-open-questions.md confirmed by owner.

Deliverables:
- `src/lib/lemonsqueezy.ts`: API client (fetch, server-only), `createCheckout`
  server action with `checkout_data.custom = { productKey }` + email prefill,
  variantId→productKey mapping from env.
- `/api/webhooks/lemonsqueezy/route.ts`: raw-body HMAC (timingSafeEqual) →
  webhookEvents idempotent insert → event handlers per doc 02 §5 table → always 200.
- `src/lib/email.ts` complete: Resend + the three templates; console transport when
  RESEND_API_KEY unset.
- `fixtures/` sample payloads (order_created, subscription_created,
  subscription_payment_success, subscription_cancelled, subscription_expired) + a
  short `fixtures/README.md` with curl commands that sign with a dev secret.

Kickoff prompt:
> Read docs/02-architecture.md §5–6, §8 and docs/05-open-questions.md (decisions are
> resolved there). Execute Phase 3: Lemon Squeezy checkout server action, the webhook
> route with raw-body HMAC verification before parsing, webhookEvents idempotency,
> the full event→tier state machine including the insider downgrade rule, and the
> Resend email lib with console fallback. Commit signed-fixture curl instructions in
> /fixtures. All LS calls server-side; never trust webhook payloads for anything but
> their own order/subscription scope. Done = every fixture replays correctly and
> idempotently against local DB, build clean, committed.

## Phase 4 — Members portal — **Sonnet**

Deliverables:
- `portal/layout.tsx` calls `requireUser()`; nav: Dashboard, Course, Resources,
  Updates, Account.
- Dashboard: continue-where-you-left-off, progress %, latest updates, upsell card
  when effectiveTier=guide.
- Course pages: module list → lesson view (server-rendered sanitized markdown,
  optional video embed, prev/next, mark-complete server action writing
  lessonProgress). Published-only. Insider items for guide users = locked teaser +
  checkout CTA (content never fetched).
- Resources (tier-filtered downloads), Updates feed (tier-gated posts), Account
  (name/email, change password, purchases list, LS customer-portal link for
  subscribers).

Kickoff prompt:
> Read docs/02-architecture.md §1, §3–4. Execute Phase 4: build the full /portal
> experience. Hard rule: every page/action re-checks tier server-side with
> requireUser/requireTier; locked insider content renders title+teaser+upgrade CTA
> only — the content itself must never be queried for under-tier users. Use the
> Phase 3 createCheckout action for CTAs. force-dynamic on all portal pages.
> Done = seeded demo content fully browsable as admin, guide-tier, and none-tier
> test users, build clean, committed.

## Phase 5 — Admin panel — **Sonnet**

Deliverables:
- `admin/layout.tsx` calls `requireAdmin()`.
- Shared `DataTable` and `EntityForm` components; one route per entity: modules,
  lessons (nested under module context), resources, updates, blog, users.
- Users: list, search by email, tier override + tierExpiresAt edit (support use),
  purchases/subscriptions shown read-only.
- Draft/published toggle everywhere; sortOrder editing; markdown textareas with
  preview for contentMd fields.

Kickoff prompt:
> Read docs/02-architecture.md and the stack skill's admin CRUD pattern. Execute
> Phase 5: /admin CRUD for modules, lessons, resources, updates posts, blog posts,
> and users (tier override) using one route per entity and shared table+form
> components. Server actions only, requireAdmin everywhere, no CMS abstraction.
> Done = full content lifecycle possible from the browser, build clean, committed.

## Phase 6 — Marketing site + SEO — **Sonnet**

Deliverables:
- All (marketing) pages per doc 02 §7 with real structure and placeholder copy
  clearly marked `[PLACEHOLDER — owner to replace]` where owner voice is needed.
- /guide sales page sections in order: problem → what's inside → curriculum preview
  (published guide-tier modules from DB, force-dynamic) → pricing → FAQ →
  guarantee/refund note. Buy buttons wired to createCheckout.
- /pricing: guide vs insider comparison, monthly/yearly toggle.
- SEO: per-page metadata, sitemap.ts, robots.ts (block /portal /admin /api),
  JSON-LD Product//guide, Article/blog, FAQPage; OG images.
- MoR-safe wording: education/information product only; no outcome guarantees, no
  "immigration services". /terms, /privacy, /refund-policy complete.

Kickoff prompt:
> Read docs/02-architecture.md §7 and the nextjs-national-lead-gen skill (page
> architecture, conversion patterns, 2026 layout menu — pick clean split-hero +
> restrained bento, deep green/navy, trustworthy not clickfunnels). Execute Phase 6:
> all marketing pages, full SEO plumbing (metadata, sitemap, robots, JSON-LD, OG),
> /guide long-form sales page with DB-driven curriculum preview and Lemon Squeezy
> buy buttons. English, education-product wording only (merchant-of-record
> compliance). Mark placeholder copy with [PLACEHOLDER]. Done = Lighthouse-sane,
> build clean, committed.

## Phase 7 — Integration QA + security pass — **Opus 4.8**

Checklist (all must pass):
1. Fresh DB → migrate → seed scripts → replay order_created fixture → set-password
   link from console → login → guide content visible, insider locked.
2. Replay subscription fixtures → full unlock → expiry fixture → downgraded to guide.
3. Replay every fixture twice → no duplicate users/purchases/tier flapping.
4. Each invariant in doc 02 §9 verified and noted in the QA report.
5. `npm run build` clean; app runs under `NODE_ENV=production next start`;
   grep client bundles for secrets.
6. Write `docs/qa-report-phase7.md` with findings/fixes.

Kickoff prompt:
> Read docs/02-architecture.md fully, especially §9. Execute Phase 7: run the QA
> checklist in docs/03-build-guide.md end-to-end against a fresh local MySQL, fix
> everything you find, and write docs/qa-report-phase7.md documenting each invariant
> check with evidence. Be adversarial: try to reach gated lesson content without the
> right tier via direct URL, server action, and API. Done = all checks pass, report
> committed.

## Phases 8–9 — Deploy & launch

Follow docs/04-launch-checklist.md. These need the owner (accounts/credentials).
Model: Sonnet with the nextjs-deploy-hostinger skill loaded.
