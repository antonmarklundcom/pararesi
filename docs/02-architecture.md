# 02 — Technical Architecture

One Next.js 15 App Router app, one domain, one MySQL database, one Node process
(`next start` on Hostinger managed Node.js). No serverless assumptions anywhere:
in-memory rate limiting and caches are valid because there is exactly one process.

## 1. Directory layout

```
src/
  app/
    (marketing)/            # public pages, shared marketing layout (header/footer)
      page.tsx              # /
      guide/page.tsx        # tripwire sales page
      pricing/page.tsx
      blog/page.tsx
      blog/[slug]/page.tsx
      about/page.tsx
      terms/page.tsx
      privacy/page.tsx
      refund-policy/page.tsx
    (auth)/
      login/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
      set-password/page.tsx     # ?token=... from purchase/welcome email
    portal/                     # gated: logged-in members
      layout.tsx                # requireUser() here + portal nav
      page.tsx                  # dashboard
      course/[module]/[lesson]/page.tsx
      resources/page.tsx
      updates/page.tsx
      account/page.tsx
    admin/                      # gated: role=admin
      layout.tsx                # requireAdmin() here
      modules/  lessons/  resources/  updates/  users/  blog/
    api/webhooks/lemonsqueezy/route.ts
    sitemap.ts
    robots.ts
  db/
    index.ts                # THE single mysql2 pool + drizzle instance
    schema.ts
  lib/
    session.ts              # iron-session config + getSession()
    auth.ts                 # requireUser / requireTier / requireAdmin / effectiveTier
    ratelimit.ts            # in-memory fixed-window limiter (single process = OK)
    lemonsqueezy.ts         # API client, checkout creation, variant→productKey map
    email.ts                # provider-agnostic; Resend implementation behind it
    markdown.ts             # server-side MD → sanitized HTML
  components/
    marketing/  portal/  admin/  ui/
scripts/
  seed-admin.ts
  seed-demo-content.ts
fixtures/                   # sample LS webhook payloads for local testing
middleware.ts
drizzle.config.ts
.env.example
```

## 2. Database (src/db/schema.ts, drizzle mysql-core)

Pool rules (stack skill): single pool created in `src/db/index.ts` only —
`mysql.createPool({ uri: DATABASE_URL, connectionLimit: 8, timezone: "Z" })`.
Nothing else may create connections. All datetimes stored UTC.

| Table | Columns (key points) |
|-------|---------------------|
| `users` | id PK, email **unique**, passwordHash (**nullable** — null until set-password), name, role enum('admin','member') default member, tier enum('none','guide','insider') default none, tierExpiresAt datetime **nullable** (null = lifetime), lsCustomerId, createdAt, **updatedAt** |
| `passwordTokens` | id, userId FK, tokenHash (sha256 of raw token — raw only in email link), purpose enum('set','reset'), expiresAt, usedAt nullable |
| `purchases` | id, userId FK, **lsOrderId unique** (idempotency key), lsProductId, lsVariantId, productKey, amountUsd, status, raw JSON, createdAt, **updatedAt** |
| `subscriptions` | id, userId FK, **lsSubscriptionId unique**, status, renewsAt, endsAt, raw JSON, createdAt, **updatedAt** |
| `modules` | id, **slug unique**, title, description, sortOrder, minTier enum('guide','insider'), status enum('draft','published') |
| `lessons` | id, moduleId FK, slug, title, contentMd longtext, videoUrl nullable, sortOrder, status enum('draft','published'); unique(moduleId, slug) |
| `lessonProgress` | userId + lessonId **composite unique**, completedAt |
| `resources` | id, title, description, fileUrl, minTier, sortOrder, status |
| `updatesPosts` | id, title, contentMd, minTier, publishedAt, status |
| `blogPosts` | id, **slug unique**, title, excerpt, contentMd, metaTitle, metaDescription, publishedAt, status |
| `webhookEvents` | id, **lsEventId unique**, eventName, processedAt nullable, error text nullable, raw JSON, createdAt |

Skill rules applied: status/published pattern on everything publicly listable; role
enum from day one; `updatedAt` on money-adjacent tables (users, purchases,
subscriptions). Sessions are iron-session cookies — **no sessions table**.

## 3. Auth

- **iron-session** encrypted httpOnly cookie (`SESSION_SECRET`, 32+ chars), sameSite
  lax, secure in prod, 30-day TTL. Session payload: `{ userId, role, tier }` — but
  role/tier are a *cache*; authorization always re-reads the user row server-side.
- **bcrypt** (cost 12) for passwords. `passwordHash` nullable: webhook-created users
  have no password until they use the set-password link.
- **No public /register.** Accounts exist only via purchase webhook or seed script.
- Token flow: generate 32 random bytes → store sha256 hash in `passwordTokens` →
  email link `/set-password?token=<raw>`. `purpose='set'` expires 7 days,
  `purpose='reset'` 1 hour. Single use (`usedAt`). Consuming a token marks all other
  open tokens for that user used.
- **Rate limiting** (`src/lib/ratelimit.ts`): in-memory Map, fixed window. login: 5
  attempts / 15 min per email and per IP; forgot-password: 3 / hour per email;
  webhook: none. Single process on Hostinger ⇒ in-memory is correct, not a hack.

### Gating model (critical rule from the stack skill)

`middleware.ts` is **UX only**: checks the session cookie exists/unseals for
`/portal/*` (else redirect `/login?next=…`) and `role=admin` for `/admin/*`. It must
stay edge-compatible (iron-session unseal only, **no DB, no mysql2 import** — Next
runs middleware in its edge sandbox even under `next start`).

Real enforcement is server-side in every layout/page/action:

```ts
requireUser()                  // session + fresh user row, else redirect('/login')
requireTier(user, 'guide')     // effectiveTier >= minTier, else null → render teaser
requireAdmin()                 // role === 'admin', else redirect('/portal')

effectiveTier(user):           // read-time downgrade, independent of webhooks
  if tier === 'insider' && tierExpiresAt && tierExpiresAt < now:
      → 'guide' if user has any purchase with productKey 'guide', else 'none'
  else → tier
```

Lesson/resource/update content is **only ever fetched in server components after a
tier check**. Insider content for guide members renders title + teaser + upgrade CTA
(the internal upsell surface), never the content itself — not even hidden in the DOM.

## 4. Tiers

| Tier | How acquired | Expiry |
|------|-------------|--------|
| `guide` | one-time LS purchase | never (tierExpiresAt null) |
| `insider` | LS subscription (monthly/yearly) | tierExpiresAt = renews_at + 3-day grace, pushed forward on each payment webhook |

Downgrade rule (webhook `subscription_expired`, and mirrored in `effectiveTier`):
insider → `guide` if they ever purchased guide, else `none`. **Not** on
`subscription_cancelled` — a cancelled subscription stays paid-up until
`ends_at`/`renews_at`; see doc 06 R1.

## 5. Lemon Squeezy

Env: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`,
`LS_VARIANT_GUIDE`, `LS_VARIANT_INSIDER_MONTHLY`, `LS_VARIANT_INSIDER_YEARLY`.
All LS calls server-side only.

**Checkout:** server action `createCheckout(productKey)` → POST /v1/checkouts with
`checkout_data.custom = { productKey, userId? }` (userId included when the buyer is
logged in — see doc 06 R4 on why email alone isn't enough) and email prefill when
logged in → redirect to the returned hosted-checkout URL. Buy buttons: /guide,
/pricing, locked-content CTAs.

**Webhook** `/api/webhooks/lemonsqueezy` (Node runtime, `export const dynamic =
'force-dynamic'`):

1. Read **raw body** (`await req.text()`) — signature is over raw bytes.
2. Verify `X-Signature` = HMAC-SHA256(raw, secret) with `crypto.timingSafeEqual`.
   Fail → 401, nothing stored.
3. Parse. Insert into `webhookEvents`; duplicate `lsEventId` → return 200
   immediately (idempotent).
4. Process inline in try/catch; success sets `processedAt`, failure stores `error`
   on the row. **Always return 200 fast** (except bad signature).

| Event | Action |
|-------|--------|
| `order_created` | resolve user by custom_data.userId if present, else find-or-create by email (store lsCustomerId); insert purchase (skip if lsOrderId exists); if productKey=guide and tier<guide → tier=guide; if brand-new user → create 'set' token + send welcome/set-password email; else send payment-received email |
| `order_refunded` | mark purchase status=refunded; if it was the guide purchase and no active subscription remains → tier=none |
| `subscription_created`, `subscription_payment_success`, `subscription_resumed`, `subscription_unpaused` | resolve user (as above); upsert subscription row; tier=insider; tierExpiresAt = renews_at + 3 days |
| `subscription_cancelled` | update subscription status only — **do not downgrade**; set tierExpiresAt = ends_at (fallback renews_at) + 3 days so the member keeps access through the period they already paid for |
| `subscription_expired` | update subscription status; apply the downgrade rule (the real terminal event) |

Idempotency key: `${event_name}:${data.id}` (Lemon Squeezy doesn't send a separate
delivery id) — a retried delivery of the same event is a no-op; each distinct event
type for a resource still gets its own row. Verified in Phase 3 by replaying every
fixture twice.

Unknown events: store row, mark processed, ignore. `fixtures/` holds one sample
payload per handled event for local `curl` testing with a dev secret.

## 6. Email (src/lib/email.ts)

Interface `sendEmail({ to, template, data })` with templates: `welcome-set-password`,
`password-reset`, `payment-received`. Resend implementation behind it (swap-able).
Dev mode without `RESEND_API_KEY`: log the full email (incl. links) to console —
keeps Phases 2–7 runnable with no account.

## 7. Marketing & SEO (nextjs-national-lead-gen patterns)

- `/guide` long-form sales page: problem → what's inside → curriculum preview
  (published modules from DB) → pricing → FAQ → guarantee. **Wording is always
  education/information product** — never immigration services, legal advice, or
  guaranteed outcomes (MoR compliance). /terms, /privacy, /refund-policy required
  by the MoR.
- Metadata API per page; `sitemap.ts` (static routes + published blog slugs) and
  `robots.ts` (disallow /portal, /admin, /api); JSON-LD: Product on /guide, Article
  on blog posts, FAQPage on the FAQ section; static OG images in /public.
- Blog is DB-backed (blogPosts + admin CRUD) — one content pipeline, no MDX.
- Design: bespoke Tailwind, deep green/navy palette, generous whitespace,
  trustworthy/modern — explicitly not a clickfunnels look.

### Rendering strategy (Hostinger + build-without-DB constraint)

Pure-content pages (about/terms/privacy/refund/auth) → static. Every page that
queries the DB (guide curriculum preview, blog, portal, admin, sitemap) →
`export const dynamic = 'force-dynamic'`. This keeps `npm run build` green with no
reachable database (build-time queries are the classic Hostinger build failure) and
is cheap on a single always-on Node process.

## 8. Money-path sequence

```
Buyer → /guide → [Buy — price TBD, $7–27 range] → server action → LS hosted checkout (card, taxes: LS as MoR)
  → LS webhook order_created → verify HMAC → webhookEvents insert (idempotent)
  → user created (passwordHash null, tier=guide) + purchase row
  → email: "Set your password" → /set-password?token=… → session created
  → /portal (guide content unlocked, insider shown as locked teasers)
  → teaser CTA → LS subscription checkout → subscription_created webhook
  → tier=insider, tierExpiresAt=renews_at+3d → full unlock
  → lapse → subscription_expired → back to guide
```

## 9. Security invariants (Phase 7 verifies each one)

1. Webhook signature verified against raw body before any parsing/DB write.
2. Gated content only fetched server-side after `requireTier`; no tier-gated data in
   client props for locked items.
3. No secrets in client bundles (`LEMONSQUEEZY_*`, `RESEND_*`, `SESSION_SECRET`,
   `DATABASE_URL` are server-only; nothing prefixed `NEXT_PUBLIC_` except truly
   public values).
4. Credential endpoints rate-limited; identical responses whether or not an email
   exists (no user enumeration).
5. Password tokens stored hashed, single-use, expiring.
6. Markdown rendered server-side and sanitized (admin-authored, but defense in depth).
7. `npm run build` zero type errors; runs under plain `next start`.
