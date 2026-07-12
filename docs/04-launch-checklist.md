# 04 — Deploy Runbook & Launch Checklist

Phases 8–9. First point where the owner must provide accounts, credentials, and
content. Load the `nextjs-deploy-hostinger` skill for every step here — it has the
verified fixes for the classic Hostinger failures (Remote MySQL whitelisting, env-var
mismatches after DB password changes, tsx/.env, npm PATH over SSH).

## 1. What the owner must provide (collect all of this before starting Phase 8)

| Item | Where it comes from |
|------|--------------------|
| Hostinger managed Node.js slot + which account | hPanel |
| Domain (or hostingersite.com subdomain to start) | hPanel / registrar |
| Hostinger MySQL database + user + password | hPanel → Databases (enable Remote MySQL if migrating/seeding from outside) |
| Lemon Squeezy store (activated for live payments) | lemonsqueezy.com |
| LS products/variants created per docs/05 decisions | LS dashboard → copy the 3 variant IDs |
| LS API key + webhook signing secret | LS → Settings → API / Webhooks |
| Resend account + verified sending domain | resend.com → Domains (SPF/DKIM DNS records) |
| Admin email + strong admin password | owner choice |

## 2. Environment variables (.env.example is the source of truth)

```bash
# --- App ---
APP_URL=                    # canonical https URL, no trailing slash (used in emails, checkout redirects, sitemap)
SESSION_SECRET=             # 32+ random chars: openssl rand -base64 32

# --- Database (Hostinger MySQL; host is usually localhost on the same slot) ---
DATABASE_URL=               # mysql://USER:PASSWORD@HOST:3306/DBNAME

# --- Lemon Squeezy (Settings → API; store id in store settings) ---
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=   # set when creating the webhook in LS dashboard
LS_VARIANT_GUIDE=              # variant id of the one-time guide product
LS_VARIANT_INSIDER_MONTHLY=
LS_VARIANT_INSIDER_YEARLY=

# --- Email (Resend; unset in dev = emails log to console) ---
RESEND_API_KEY=
EMAIL_FROM=                 # e.g. "Paraguay Residency Guide <hello@yourdomain.com>"

# --- Seed scripts only (not needed at runtime) ---
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Rules: never commit `.env`; changing the DB password in hPanel means updating the
live app's env var **immediately** (known crash pattern per deploy skill).

## 3. Phase 8 — Deploy runbook

1. Connect the GitHub repo to the Hostinger Node.js app (branch: main). Build
   command `npm run build`, start `npm start` (`next start -p $PORT`).
2. Create the MySQL DB; set all env vars in hPanel.
3. Run migrations against the prod DB (drizzle push/migrate via SSH, or from local
   with Remote MySQL IP whitelisted).
4. `npx tsx scripts/seed-admin.ts` (remember: scripts load .env via dotenv/config).
5. Optionally seed demo content for review; delete before launch.
6. Smoke test: home page, /login as admin, /admin CRUD, /portal with a test member.
7. Point the domain / subdomain; confirm HTTPS.
8. Create the LS webhook: URL `https://<domain>/api/webhooks/lemonsqueezy`,
   secret = LEMONSQUEEZY_WEBHOOK_SECRET, events: `order_created`,
   `subscription_created`, `subscription_payment_success`,
   `subscription_cancelled`, `subscription_expired`.
9. **LS test mode end-to-end:** buy guide with a test card → webhook fires → user
   created → set-password email arrives (Resend) → login → content unlocked. Then
   subscribe → insider unlock. Then cancel → downgrade. Check webhookEvents rows.

## 4. Phase 9 — Content & go-live checklist

- [ ] Real curriculum loaded via /admin (modules, lessons, resources), demo content removed
- [ ] All `[PLACEHOLDER]` marketing copy replaced; pricing final
- [ ] /terms, /privacy, /refund-policy reviewed (LS MoR requires them; refund terms must match what LS is told)
- [ ] Product wording check: education/information product, no guaranteed-outcome or "immigration services" language anywhere
- [ ] LS store switched to live mode; live variant IDs in env (test-mode IDs differ!)
- [ ] One real live purchase + refund it (verifies live webhook + refund flow)
- [ ] Resend domain verified (SPF/DKIM green), from-address matches domain
- [ ] robots.ts/sitemap verified on prod URL; submit sitemap in Google Search Console
- [ ] OG images render (check with a share debugger)
- [ ] Admin password is strong and unique; SESSION_SECRET is production-random
- [ ] Backup plan: enable Hostinger DB backups; note restore steps
- [ ] Uptime monitor pointed at / and /api/webhooks/lemonsqueezy host

## 5. Post-launch (backlog, not launch blockers)

- Blog cadence for SEO (residency requirements, cost breakdowns, comparisons —
  lead-gen skill content strategy)
- Email sequence beyond transactional (needs a marketing-email decision later)
- Yearly-plan promo surfaces, order bumps on checkout (LS supports)
- Law/fee updates feed as retention driver for insider tier
