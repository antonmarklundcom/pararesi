# Lemon Squeezy webhook fixtures

Sample payloads for local testing of `/api/webhooks/lemonsqueezy` without a real
Lemon Squeezy account. Each one exercises exactly one handled event
(docs/02-architecture.md §5).

Requires `LEMONSQUEEZY_WEBHOOK_SECRET` set in `.env` (any string works locally —
it just has to match what the script below signs with).

## Replaying a fixture

```bash
./fixtures/send.sh order_created
./fixtures/send.sh subscription_created
./fixtures/send.sh subscription_payment_success
./fixtures/send.sh subscription_cancelled
./fixtures/send.sh subscription_expired
./fixtures/send.sh order_refunded
```

Replay the same fixture twice in a row to confirm idempotency — the second
call should return `{"ok":true,"duplicate":true}` and the row counts in
`webhook_events`/`purchases`/`subscriptions` should not change.

## Suggested end-to-end order

1. `order_created` — creates a user (passwordHash null), a `purchases` row,
   sets `tier=guide`, and logs a welcome/set-password email to the console
   (`RESEND_API_KEY` unset in dev).
2. `subscription_created` — creates a *different* user
   (`sam.insider@example.com`), a `subscriptions` row, sets `tier=insider`
   with `tierExpiresAt` = `renews_at` + 3 days.
3. `subscription_payment_success` — renews the same subscription, pushes
   `tierExpiresAt` forward.
4. `subscription_cancelled` or `subscription_expired` — downgrades that user:
   `guide` if they also have a guide purchase, else `none`.
5. `order_refunded` — marks the `jane.buyer@example.com` purchase refunded and,
   since she has no active subscription, drops her back to `tier=none`.

Check results with:

```sql
SELECT id, email, tier, tier_expires_at FROM users;
SELECT * FROM purchases;
SELECT * FROM subscriptions;
SELECT ls_event_id, event_name, processed_at, error FROM webhook_events;
```
