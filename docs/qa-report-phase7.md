# QA report — Phase 7 adversarial QA & security pass

**Date:** 2026-08-13
**Scope:** the auth, session, Lemon Squeezy webhook, checkout, admin-authorization
and lead/email paths, as specified in docs/01-plan-and-phases.md §Phase 7.
**Method:** source review of every route, server action and library on those paths,
against the state machine in docs/02-architecture.md §6 and the gating rules in §3,
plus the existing vitest suite as a baseline (190 tests green before this pass).

This is the discrete adversarial pass docs/01 said had never been run. The B-series
defects (B1–B5) were already closed by earlier sessions and are not re-litigated
here; everything below is new.

**Outcome:** 13 findings. 12 are fixed in this PR with a regression test each
(F13 is a timing fix, where an assertion would be flaky — see its entry). Six
further observations are recorded as accepted risks or as items that cannot be
settled without a live database or Lemon Squeezy account; they are listed
separately at the end rather than guessed at.

**Test count:** 190 → 234.

---

## Severity key

| | |
|---|---|
| **High** | Money or access is granted, revoked or leaked incorrectly, with no manual step required. |
| **Medium** | An attacker gains a meaningful capability (abuse of our sending domain, bypassing a control, off-site redirect) or a paying customer can be left unable to reach what they bought. |
| **Low** | Real but narrow: needs an unlikely precondition, or the damage is bounded. |

---

## F1 — A subscription with no `renews_at` grants lifetime Insider · **High**

**Where:** `src/lib/webhook/handlers.ts`, `handleSubscriptionActive`.

**Evidence.** The handler wrote:

```ts
await deps.store.updateUser(user.id, {
  tier: "insider",
  tierExpiresAt: renewsAt ? withGrace(renewsAt) : null,
});
```

and `resolveEffectiveTier` (`src/lib/tiers.ts`) only downgrades when there is a date
to compare against:

```ts
if (tier === "insider" && tierExpiresAt && tierExpiresAt < now) { … }
return tier;
```

So `tierExpiresAt: null` on an insider is not "expiry unknown" — it is *never
expires*. The same nullability is handled correctly two functions further down, in
`handleSubscriptionCancelled`, which takes `endsAt ?? renewsAt`; this path did not.

`handleSubscriptionActive` is reached by `subscription_created`,
`subscription_resumed`, `subscription_unpaused` and — via a live API fetch —
`subscription_payment_success`. A Lemon Squeezy subscription that is not going to
renew reports `renews_at: null` with the paid-through date in `ends_at`, so any of
those events on such a subscription handed out an unexpiring Insider tier that no
later webhook would ever take away: `subscription_expired` clears `tierExpiresAt`
but by then the member is already reading Insider content indefinitely, and the
downgrade only lands if that event arrives at all.

**Fix.** Fall back to `ends_at`, and when a payload carries neither date keep the
paid-through date the member already had rather than clearing it. Clearing is never
the conservative choice here.

**Test.** `tests/webhook-hardening.test.ts` — "falls back to ends_at when renews_at
is null", "keeps the existing paid-through date when the payload carries neither
date".

**Needs live confirmation:** the exact combination of `renews_at`/`ends_at` Lemon
Squeezy sends on a resumed-but-cancelled subscription is documented behaviour but
not something this repo can verify without a store. The fix is correct for every
combination, so this does not block it.

---

## F2 — Checkout custom data decided what was bought · **High**

**Where:** `src/lib/webhook/handlers.ts`, `handleOrderCreated`.

**Evidence.**

```ts
const productKey = payload.meta.custom_data?.productKey ?? deps.productKeyForVariantId(variantId);
```

`meta.custom_data` is echoed back from `checkout_data.custom`, which
`src/lib/lemonsqueezy.ts` sets when it creates a checkout via the API. But a Lemon
Squeezy *hosted checkout* also accepts custom data straight off the URL
(`checkout[custom][…]`), so the field is buyer-influenced, not server-authoritative.
It was being trusted ahead of the one value that is authenticated by the signed
payload — the variant actually paid for.

Consequences, in increasing order of cost: the `purchases` ledger records a product
the buyer did not buy; `findGuidePurchase` (which keys on `product_key = "guide"`)
then treats it as a guide entitlement, so the fallback tier after a subscription
expires or a refund lands is computed from a label the buyer chose; and a buyer of
any variant could have their order recorded as `guide` and be granted guide tier by
`grantAtLeastTier`.

The variant→key mapping was already the trusted path — the B5 work made an unmapped
variant throw rather than silently sell the guide. `custom_data` sat in front of it
and skipped that check entirely.

**Fix.** Derive the product key from `variant_id` only. The unmapped-variant throw is
unchanged, so a misconfigured `LS_VARIANT_*` still fails loudly and retriably.

**Test.** `tests/webhook-state-machine.test.ts` — "ignores a custom_data productKey
and derives the product from the variant id", "still fails loudly when the variant
maps to nothing, rather than trusting custom_data".

**Related, not fixed — see Observation O1** on `custom_data.userId`, which is trusted
by the same route for a different purpose.

---

## F3 — One subscription expiring revoked another · **High**

**Where:** `src/lib/webhook/handlers.ts`, `handleSubscriptionEnded`.

**Evidence.**

```ts
const guidePurchase = await deps.store.findGuidePurchase(user.id);
await deps.store.updateUser(user.id, { tier: guidePurchase ? "guide" : "none", tierExpiresAt: null });
```

The downgrade looked only at the user's guide purchase and ignored every other
subscription they hold. A member with two subscription rows — the ordinary case is
someone who let a subscription lapse and later resubscribed, leaving the old row to
expire — is dropped to `guide` or `none` while actively paying.

Note that `handleOrderRefunded`, immediately above, already does this correctly via
`entitledTier()`; the comment there explains the reasoning ("Deriving the tier makes
the rule total, and makes it agree with subscription_expired"). It did not, in fact,
agree with `subscription_expired`.

This is also the attack leg of Observation O1: because `custom_data.userId`
attributes a purchase to any account id, an attacker could open a cheap subscription
against a victim's account, cancel it, and have the resulting `subscription_expired`
revoke the victim's own paid access. That is a denial of service costing one month's
subscription. Fixing the general correctness bug closes it.

**Fix.** Look for a surviving active subscription first, keep the member on Insider
if one exists, and re-anchor `tierExpiresAt` to *that* subscription's paid-through
date — leaving the dead subscription's date in place would expire them within the
grace window instead.

**Test.** `tests/webhook-hardening.test.ts` — "keeps insider when a second
subscription is still active", "still downgrades when the expiring subscription was
the only one".

---

## F4 — Open redirect on the login form's `?next=` · **Medium**

**Where:** `src/app/(auth)/login/actions.ts`, `safeNextPath`.

**Evidence.**

```ts
if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return null;
```

The `//` guard is the well-known half of this check. The half that was missing is the
backslash: browsers normalise `\` to `/` while parsing a URL, so a `Location` header
of `/\evil.example` is fetched as `//evil.example` — a protocol-relative URL, and an
off-site redirect wearing a relative path.

`middleware.ts` sets `next` from the requested pathname, but the value round-trips
through a hidden form field, so it is attacker-supplied in practice: a phishing link
to `/login?next=/\evil.example` sends the victim off-site *after* a successful login
on the real site, which is the version of an open redirect that actually converts.

**Fix.** Moved to `src/lib/safe-next-path.ts` (a `"use server"` file cannot be
imported by a test) and tightened: exactly one leading slash followed by a character
that is neither slash nor backslash, and no control characters — a raw CR/LF in a
`Location` value can be parsed differently by a proxy than by the browser behind it.

**Test.** `src/lib/safe-next-path.test.ts` (6 cases, including `/\host`, `/\/host`
and `/\\host`).

---

## F5 — A lost dedupe race reported failure instead of duplicate · **Medium**

**Where:** `src/lib/webhook/handlers.ts`, `processWebhook`.

**Evidence.** `findWebhookEventByLsId` followed by `createWebhookEvent` is not
atomic, and Lemon Squeezy can have two deliveries of the same event in flight. Both
can pass the lookup; the unique index on `webhook_events.ls_event_id` then rejects
the loser's insert. That insert sat *outside* the `try`, so the rejection escaped
`processWebhook` as an unhandled throw, surfaced as an opaque 500, and invited Lemon
Squeezy to retry an event that the winning delivery had already applied correctly.

The database is consistent either way — the index does its job — so this is a
reporting defect rather than a double-apply. It matters because `/admin/webhooks`
(B3) is how a failure gets noticed, and a spurious failure there is noise on exactly
the surface that is supposed to be signal.

**Fix.** Wrap the insert; a failure means someone else got there first, which is a
duplicate.

**Test.** `tests/webhook-hardening.test.ts` — "reports duplicate when the insert
loses to a concurrent delivery".

---

## F6 — A returning buyer who never set a password got a dead-end email · **Medium**

**Where:** `src/lib/webhook/handlers.ts`, `handleOrderCreated` /
`handleSubscriptionActive`.

**Evidence.** A `users` row is created by the first purchase webhook with
`password_hash` NULL; the set-password link arrives by email and expires after 7
days. The welcome email was sent on `isNew` alone, so a customer who ignored or lost
that first link and later bought again received "Payment received — log in to your
account", pointing at `/portal`, which they cannot reach. Their only route in is to
guess that `/forgot-password` doubles as first-password setup. That is a paying
customer who cannot get what they paid for, arriving through the money path.

**Fix.** Added `hasPassword` to the webhook's `UserRecord` (derived from
`password_hash`) and send the set-password link whenever the account cannot yet be
logged into, whether or not the row is new.

**Test.** `tests/webhook-state-machine.test.ts` — "re-sends the set-password link
when the returning buyer never set one", alongside the existing payment-received case
(now given an account that *has* a password).

---

## F7 — `/forgot-password` was rate-limited by email only · **Medium**

**Where:** `src/app/(auth)/forgot-password/actions.ts`.

**Evidence.**

```ts
const allowed = rateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000);
```

One bucket, keyed on the address being reset. That stops an attacker grinding a
single account, and does nothing about the actual abuse case: one host walking an
address list, causing us to send a genuine password-reset email — from our verified
Resend sending domain — to every address that has an account. That is free
third-party mail-bombing plus a sending-reputation hit, and it burns the Resend
quota. `loginAction` and `subscribeAction` both already limited per-IP as well; this
endpoint was the outlier.

**Fix.** Added the IP bucket (10/hour). While there, the policy for all three
credential endpoints moved into `src/lib/credential-ratelimit.ts` so "did this
endpoint remember both buckets?" is answerable in one place. The helpers take an
injectable limiter, which is what makes them testable without waiting out real
windows.

**Test.** `src/lib/credential-ratelimit.test.ts` — "stops one host from spraying
reset mail across many addresses", plus a case pinning that the IP bucket is charged
even when the email bucket already refused (`a && b` would have short-circuited and
made repeat attempts against one address free of IP budget).

---

## F8 — `/reset-password` and `/set-password` had no rate limit at all · **Medium**

**Where:** `src/lib/auth-flows.ts`, `applyPasswordFromToken`.

**Evidence.** Both actions call straight into `applyPasswordFromToken`, which runs
`bcrypt.hash(password, 12)` — roughly 250 ms of CPU — on every submission, before any
check that the token is real. On a single Node process (the documented Hostinger
deployment, and the stated premise of `src/lib/ratelimit.ts`), an unauthenticated
endpoint that burns a quarter-second of CPU per request is a cheap way to starve the
rest of the site.

Guessing the token itself is *not* the threat — it is 32 random bytes, hashed at rest
— which is why the bucket is per-IP and generous rather than tight.

**Fix.** `allowPasswordTokenSubmit` (10 per 15 minutes per IP), checked before the
hash rather than after.

**Test.** `src/lib/credential-ratelimit.test.ts` — "limits per IP", "keeps separate
hosts independent".

---

## F9 — `x-forwarded-for` was read from the client-controlled end · **Medium**

**Where:** `src/lib/request-ip.ts`.

**Evidence.**

```ts
const forwardedFor = h.get("x-forwarded-for");
if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
```

`x-forwarded-for` is a list each hop *appends* to. The leftmost entry is therefore
whatever the caller sent, and taking it means an attacker presents a different "IP"
on every request and walks through every IP-keyed rate limit in the app — login,
subscribe, and the two added above. The per-email buckets survive, but the per-IP
half of the defence was decorative.

**Fix.** Read the entry the nearest trusted proxy appended (the rightmost), with
`TRUSTED_PROXY_HOPS` (default 1, matching the documented single-proxy deployment) for
setups with a CDN in front as well. Guessing the hop count too *low* is the safe
direction — it buckets several clients together and limits more aggressively — so the
parser clamps rather than falling off the end. Documented in `.env.example`.

**Test.** `src/lib/request-ip.test.ts` — 10 cases including a forged 4-entry chain,
the 2-hop configuration, clamping, and junk env values.

**Needs live confirmation:** whether Hostinger's proxy *appends to* or *replaces* the
incoming header. If it replaces, leftmost and rightmost are the same value and this
change is a no-op; if it appends, this change is the whole fix. Either way the
default of 1 is correct for one proxy. Worth a one-line check against the deployed
app in phase 8.

---

## F10 — Unescaped interpolation into email HTML · **Medium**

**Where:** `src/lib/email.ts`, `renderTemplate`.

**Evidence.** Every template interpolated its values directly:

```ts
html: `<p>Hi${data.name ? ` ${data.name}` : ""},</p> … <p><a href="${data.setPasswordUrl}">…`
```

`data.name` originates from `attrs.user_name` on the Lemon Squeezy order — i.e. what
the buyer typed into the checkout — and reaches `welcome-set-password` and
`payment-received`. `data.title` is admin-authored and reaches `update-published`.
The URLs are built from `APP_URL`.

The payoff is not XSS in a browser; it is that a buyer can put working markup inside
a genuine, correctly-authenticated transactional email sent from our own domain. A
`name` of `<a href="https://evil.example">click here to verify your account</a>`
produces exactly the phishing email a recipient has every reason to trust, and the
quote-less `href="${…}"` interpolations allow attribute breakout as well.

**Fix.** Escape the whole data record once in `renderEmail`, before it reaches any
template, so a new template cannot forget. Subjects take the raw values — escaping
there would put a literal `&amp;` in the recipient's inbox list. URLs are escaped
too: `&` → `&amp;` is the correct encoding inside an `href` and every mail client
decodes it back.

**Test.** `src/lib/email.test.ts` — 7 cases covering markup in `name`, a script tag,
attribute breakout via a URL, an admin title, the plain-text subject, and the
unsubscribe footer.

---

## F11 — Analytics could stall the webhook indefinitely · **Low**

**Where:** `src/lib/analytics.ts`, `trackServerEvent`.

**Evidence.** `handleOrderCreated` awaits `trackServerEvent("Purchase completed", …)`
in line. The `fetch` to Plausible had no timeout, and the `try/catch` around it only
covers a *failed* request, not a hung one. A Plausible outage that accepts the
connection and never responds therefore holds the webhook request open until Lemon
Squeezy times out and retries — an analytics blip turning into a customer who has
paid and is waiting for access. The file's own comment ("Analytics must never affect
the caller — e.g. a Plausible outage must not fail webhook processing") states the
intent the code did not fully implement.

**Fix.** `signal: AbortSignal.timeout(3000)`; the existing catch absorbs the abort.

**Test.** `src/lib/analytics.test.ts` — asserts the signal is attached, that nothing
is sent when unconfigured, and that a transport failure still resolves.

---

## F12 — A password change did not invalidate existing sessions · **Medium**

**Where:** `src/lib/session.ts`, `src/lib/auth-flows.ts`,
`src/app/portal/account/actions.ts`.

**Evidence.** iron-session keeps no server-side session state — the sealed cookie
*is* the session, with a 30-day `maxAge` (`getSessionOptions`). `applyPasswordFromToken`
and `changePasswordAction` both wrote a new `password_hash` and nothing else. There
was therefore nothing for a password change to invalidate: an attacker holding a
stolen session cookie kept full access for up to 30 days *after* the victim noticed
and reset their password.

This matters most on the recovery path. `/forgot-password` → `/reset-password` is
precisely the flow a user runs when they believe their account is compromised, and it
did not evict the attacker.

**Fix.** A `users.session_epoch` column (migration `0005_confused_tyger_tiger.sql`).
Sessions carry the epoch they were issued under; `getCurrentUser` rejects a session
whose epoch no longer matches, which covers every gate since they all go through it.
`setUserPassword` bumps the column in SQL (`session_epoch + 1`, not read-modify-write,
so two concurrent changes cannot both write the same value) and the acting session
re-reads it afterwards, so the device performing the change stays logged in and every
other one does not. Sessions minted before the column existed carry no epoch and are
read as 0 — the default every existing row gets — so shipping this does not log the
userbase out.

Middleware still cannot check this (no database access in the middleware runtime), so
a stale cookie briefly passes the UX-only gate before the page's own `requireUser`
rejects it. That matches the existing documented split in
docs/02-architecture.md §3.

**Test.** `src/lib/session.test.ts` — `sessionEpochMatches` across current, stale and
pre-migration sessions.

---

## F13 — Login leaked account existence by timing · **Low**

**Where:** `src/app/(auth)/login/actions.ts`.

**Evidence.**

```ts
if (!user || !user.passwordHash) return { error: GENERIC_ERROR };
const passwordMatches = await bcrypt.compare(password, user.passwordHash);
```

An address with no account returned in microseconds; an address with one cost a full
bcrypt verify at cost 12 (~250 ms). That difference is trivially measurable over the
network and is a reliable oracle for which addresses have accounts here — which is
the exact thing the deliberately generic error message, and the whole
no-enumeration design of `/forgot-password`, exist to prevent.

**Fix.** Compare against a decoy hash when there is no stored hash, so both paths pay
the same cost. The decoy is a real bcrypt hash of random bytes, computed lazily on the
first login attempt rather than at import (so the ~250 ms never lands during a build
or a cold render), and nothing can match it.

**No regression test.** A timing assertion is inherently flaky in CI — the honest
version of this test would compare two wall-clock measurements on a shared runner and
fail randomly. The fix is verified by inspection: both branches now await exactly one
`bcrypt.compare`. Flagging it rather than shipping a test that asserts nothing.

---

# Observations — not fixed

These are real, and deliberately left alone. Each says why.

**O1 — `custom_data.userId` attributes a purchase to any account id.**
`resolveUser` trusts `meta.custom_data.userId` ahead of email matching, and as
established in F2 that field is buyer-influenced on a hosted checkout. The direction
of the abuse is limited: the attacker is the one paying, so the worst they can do is
*gift* entitlement to an account they do not control, and suppress their own welcome
email. The genuinely harmful leg — using it to get a victim's access revoked later —
was F3, and is fixed. The feature it exists for (a member who types a different email
at checkout still gets their own account upgraded) is real and documented, so the
field stays trusted for identity, never for what was bought. Now commented as such at
the call site.

**O2 — `/subscribe/confirm` and `/unsubscribe` mutate on GET.** A corporate mail
scanner or link-preview bot that follows links will consume the token: it will record
a double opt-in the human never gave (weakening the consent evidence the double
opt-in exists to produce), or unsubscribe a lead who never asked to leave. The remedy
— a POST-behind-a-button confirm step — costs real conversion on the opt-in and is a
product decision, not a bug fix. Recorded here so the trade-off is explicit rather
than accidental. RFC 8058 one-click unsubscribe is the standards-track version of the
second half, if the owner ever wants it.

**O3 — `notifyUpdatesPostAction` loads the full `users` table.**
`db.select().from(users)` with no filter, then filters in memory. Correct, and fine
at any plausible size for this product; it is only worth changing if the list reaches
a size where it isn't, which is a good problem.

**O4 — Rate-limit buckets reset on deploy.** Documented and accepted in
`src/lib/ratelimit.ts` itself, with reasoning this pass agrees with. Unchanged.

**O5 — `subscription_updated` and `subscription_payment_failed` are logged but not
acted on.** Deliberate per the switch statement's comment. Worth revisiting once
there is real subscription traffic to observe, but acting on them now would be
speculative.

**O6 — Admin authorization is complete.** Checked every server action reachable from
`/admin`: all of `blog`, `modules`, `lessons`, `resources`, `updates`, `users` and
`leads` call `requireAdmin()` as their first statement, and the two thin wrappers in
`app/admin/webhooks/actions.ts` that do not are safe because every function they
delegate to in `src/lib/webhook/admin.ts` calls it. Server actions are directly
invocable regardless of which layout rendered the button, so the layout's
`requireAdmin` is not what protects them — this was checked on that basis rather than
by reading the nav. No finding. Recorded because "we looked and it was fine" is the
useful output of an authorization review.

---

# Checks run with no finding

The original phase 7 checklist in docs/01, item by item:

- **No gated content reachable without a server-side tier check.** `/portal/course/
  [module]/[lesson]` re-checks with `requireTier` and, when locked, selects only
  `lessons.title` — `content_md` is never fetched for a member below the tier, so
  there is nothing to leak into the RSC payload. `/portal/updates` and
  `/portal/resources` re-derive the tier with `effectiveTier` per request and render
  `LockedTeaser` instead of content. Progress toggling re-checks `requireUser` and
  scopes every query to `user.id`.
- **Middleware is not load-bearing.** Every gated layout, page and action re-checks
  server-side. Confirmed by reading each one, not by trusting the comment.
- **Tier is not cached in the session.** `SessionData` holds `userId` and `role`
  only, and `effectiveTier` re-reads on every gate, so an expiry or refund takes
  effect on the next request.
- **No client-side secrets.** The only `NEXT_PUBLIC_*` variable is the Plausible
  domain. `LEMONSQUEEZY_API_KEY`, the webhook secret, `SESSION_SECRET`, `CRON_SECRET`
  and `RESEND_API_KEY` are read exclusively in server modules; the two client
  components on the money path (`BuyButton`, `InsiderPricingCard`) call a server
  action and receive a URL.
- **Webhook signature verification.** Raw body, HMAC-SHA256,
  `crypto.timingSafeEqual` with a length pre-check (a length mismatch would throw
  otherwise). No secret configured ⇒ 401, i.e. fails closed.
- **Cron endpoint.** `POST` only, constant-time bearer comparison, and no
  `CRON_SECRET` ⇒ 401 with the same body as a bad token, so an unconfigured
  deployment is not discoverable.
- **Token handling.** Password and lead tokens are 32 random bytes, stored as
  SHA-256, single-use, expiring, and consuming one invalidates the holder's other
  open tokens. The two tables are deliberately disjoint and the lead purposes are not
  interchangeable (`purpose` is re-checked after the hash lookup, so an unsubscribe
  token cannot be replayed as a confirmation).
- **Lead consent.** Nothing is mailed before `confirmed_at` is set; an
  already-confirmed address gets no mail from the public form, so the form cannot be
  used to send a subscriber an email on demand or to test who is on the list; a
  previously unsubscribed address is treated as pending rather than resubscribed.
- **Markdown rendering.** `sanitize-html` on all admin-authored content before
  `dangerouslySetInnerHTML`, with a narrow tag/attribute allowlist.
- **No edge-runtime dependencies.** `npm run build` reports the middleware as the
  only edge bundle, and it imports nothing beyond iron-session.
- **Build, typecheck, lint, test.** All green.

---

# Items that need a live database or Lemon Squeezy account

Stated explicitly rather than guessed at, per the phase 7 brief:

1. **The exact `renews_at`/`ends_at` shapes** Lemon Squeezy sends for
   `subscription_resumed` and `subscription_unpaused` on a subscription that will not
   renew (F1). The fix is correct for every combination; what is unverified is how
   often the null case actually arises.
2. **Whether Hostinger's proxy appends to or replaces `x-forwarded-for`** (F9). One
   `curl` against the deployed app settles it and confirms `TRUSTED_PROXY_HOPS=1`.
3. **The `session_epoch` migration against real data** (F12).
   `0005_confused_tyger_tiger.sql` is a single `ALTER TABLE … ADD … NOT NULL DEFAULT
   0`, which is safe by construction, but it has only been generated, never run.
4. **End-to-end money path with a real test-mode purchase** — checkout → webhook →
   user created → set-password email → login → gated content → renewal → cancel →
   expiry. The state machine is covered by 234 tests against in-memory doubles and
   committed fixtures, which is as far as this can be taken without a store. This is
   phase 9's test-mode buy and remains the last unverified link.
5. **Resend delivery of the escaped templates** (F10) — rendering is tested, actual
   delivery and client rendering are not.
