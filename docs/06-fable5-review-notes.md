# 06 — Fable 5 Review Notes (2026-07-16)

Second Fable 5 planning pass over the docs/01–05 package. The plan is sound and
Phase 0 can start as written; the items below are corrections/verifications the
relevant builder sessions **must** apply. None require re-architecting.

## Blocking corrections (apply during the listed phase)

### R1. `subscription_cancelled` must NOT downgrade immediately — Phase 3 (Opus 4.8)

Doc 02 §5 says `subscription_cancelled` → "apply downgrade rule". That is wrong for
Lemon Squeezy semantics: `subscription_cancelled` fires when the member *cancels*,
but the subscription stays paid-up until period end (`ends_at`). Downgrading at
cancel strips access the member already paid for.

Correct handling:
- `subscription_cancelled`: update subscription status; keep `tier = 'insider'`;
  set `tierExpiresAt = ends_at + TIER_GRACE_DAYS` (fall back to `renews_at` if
  `ends_at` absent). `effectiveTier` performs the actual downgrade at read time.
- `subscription_expired`: this is the real terminal event — apply the downgrade
  rule (insider → guide if any guide purchase, else none) and set tier accordingly.
- Also handle `subscription_resumed` / `subscription_unpaused`: restore
  status and re-extend `tierExpiresAt` from `renews_at`, so an un-cancel before
  period end restores insider cleanly. Add these two to the doc 04 §3 step 8
  webhook event list.

### R2. `order_refunded` missing from event tables — Phase 3 + Phase 8

Docs/05 Q6 (accepted) says refunds are handled, but `order_refunded` appears in
neither the doc 02 §5 handler table nor the doc 04 §3 step 8 LS webhook
subscription list. Add it to both: mark purchase refunded; if it was the guide
purchase and no active subscription → tier=none.

### R3. Webhook idempotency key — verify during Phase 3

The `webhookEvents.lsEventId unique` column assumes every LS delivery carries a
stable unique event id. Verify against the real payload/headers (LS sends
`X-Event-Id` / `meta.webhook_id` depending on API version). If retries of the same
event don't share a stable id, key idempotency on
`(eventName, data.id, data.attributes.updated_at)` instead. Whatever is chosen,
the fixture replay test in Phase 7 item 3 must prove double-delivery is a no-op.

### R4. Tie checkouts to the logged-in user, not just email — Phase 3

`checkout_data.custom = { productKey }` plus find-or-create-by-email means a
logged-in guide member who enters a *different* email at the LS checkout gets
their insider tier applied to a brand-new orphan account. Fix: when the buyer is
logged in, include `userId` in `checkout_data.custom` and prefer it over email
matching in the webhook handler (still validate the user exists). Email
find-or-create remains the path for anonymous buyers.

## Non-blocking consistency fixes

- **R5. Pricing copy:** doc 02 §8 shows "[Buy $17]" and docs/05 previously
  recommended $19/$149. Decided prices (docs/05, 2026-07-16): **Insider $7/mo /
  $47/yr; guide one-time price TBD** ([PLACEHOLDER] in copy). Phase 6 must use
  these, not the old examples.
- **R6. Expired set-password links:** the 7-day 'set' token can lapse before a
  buyer ever logs in. The reset flow already covers this (passwordHash null ≠
  blocked), but Phase 2 should make /login and an expired /set-password page point
  clearly at "forgot password" so the purchase isn't perceived as lost.
- **R7. Model naming:** doc 01 says "Sonnet (latest)" — current builder targets are
  **Sonnet 5** (routine phases) and **Opus 4.8** (phases 2, 3, 7), per the
  portfolio-wide tiering convention.
