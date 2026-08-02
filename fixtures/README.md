# Lemon Squeezy webhook fixtures

Sample payloads for local testing of `/api/webhooks/lemonsqueezy` without a real
Lemon Squeezy account, and the oracle for `tests/webhook-state-machine.test.ts`.

## Where the shapes come from

Every `data.attributes` key here is taken from the attribute definitions in the
official Lemon Squeezy JS SDK (`@lemonsqueezy/lemonsqueezy.js` v4 type
declarations), which is the machine-readable form of the API reference. The
three object types that matter:

| Event | `data.type` | `data.id` is |
|-------|-------------|--------------|
| `order_created`, `order_refunded` | `orders` | the order id |
| `subscription_created`, `_cancelled`, `_resumed`, `_unpaused`, `_expired` | `subscriptions` | the **subscription** id — stable for the subscription's whole life |
| `subscription_payment_success` | `subscription-invoices` | the **invoice** id — new on every renewal |

Two consequences, both of which the handler now depends on (see defects B1/B2
in `docs/07-review-and-next-steps.md`):

1. **Every resource carries `updated_at`**, and it is the only field that
   separates two events of the same name on the same subscription (a
   cancel → resume → cancel sequence, for example). It is part of the
   idempotency key.
2. **A `subscription-invoices` object has no `renews_at` and no `ends_at`.**
   Its `status` is the *invoice* status (`paid`/`pending`/`void`/`refunded`),
   not the subscription status. So the renewal handler reads the new
   paid-through date from the subscription itself, fetched from
   `GET /v1/subscriptions/{id}` — see `fixtures/api/` below.

### What is NOT verified

`docs.lemonsqueezy.com` returns 403 to automated fetches, so the `meta` envelope
(`event_name`, `custom_data`, `test_mode`) was reproduced from the existing
fixtures and community examples rather than the official reference, and the
JSON:API `links` member is omitted entirely. Neither is read by the handler.
**Before trusting these as a release gate, re-capture one real delivery of each
event from the Lemon Squeezy dashboard's webhook log and diff it against these
files.**

Monetary amounts (`1900` on the order, `700` on the invoice) are test values
carried over from the previous fixtures and from the working figures in
`docs/05-open-questions.md`. The guide's real price is still TBD — do not read a
pricing decision out of these files.

## Files

```
order_created.json                        orders,                id 1001, Jane Buyer
order_refunded.json                       orders,                id 1001, refunded
subscription_created.json                 subscriptions,         id 2001, Sam Insider
subscription_payment_success.json         subscription-invoices, id 3001, billing_reason "initial"
subscription_payment_success_month2.json  subscription-invoices, id 3002, billing_reason "renewal"
subscription_cancelled.json               subscriptions,         id 2001, cancelled
subscription_resumed.json                 subscriptions,         id 2001, active again
subscription_unpaused.json                subscriptions,         id 2001, active again
subscription_expired.json                 subscriptions,         id 2001, expired

api/subscription_2001_after_month2_renewal.json
    Not a webhook. This is what GET /v1/subscriptions/2001 returns while the
    month-2 invoice is being processed: renews_at has rolled to 2026-09-17.
```

The scenario the timeline encodes:

| Date | Event | Result |
|------|-------|--------|
| 2026-07-17 | `order_created` | Jane created, `tier=guide`, welcome email |
| 2026-07-17 | `subscription_created` | Sam created, `tier=insider`, `tierExpiresAt` 2026-08-20 |
| 2026-07-17 | `subscription_payment_success` (invoice 3001) | initial payment |
| 2026-08-17 | `subscription_payment_success` (invoice 3002) | renewal → `tierExpiresAt` 2026-09-20 |
| 2026-08-20 | `subscription_cancelled` | status `cancelled`, access kept to `ends_at` + grace |
| 2026-08-25 | `subscription_resumed` | back to `active` |
| 2026-09-17 | `subscription_expired` | `tier` → `guide` if a guide purchase exists, else `none` |
| 2026-07-24 | `order_refunded` | purchase `refunded`; Jane → `tier=none` (no active sub) |

`tierExpiresAt` is always the paid-through date plus `TIER_GRACE_DAYS` (3).

## Replaying a fixture

```bash
./fixtures/send.sh order_created
./fixtures/send.sh subscription_created
./fixtures/send.sh subscription_payment_success
./fixtures/send.sh subscription_payment_success_month2
./fixtures/send.sh subscription_cancelled
./fixtures/send.sh subscription_resumed
./fixtures/send.sh subscription_unpaused
./fixtures/send.sh subscription_expired
./fixtures/send.sh order_refunded
```

Requires `LEMONSQUEEZY_WEBHOOK_SECRET` set in `.env` (any string works locally —
it just has to match what the script signs with).

**The two `subscription_payment_success` fixtures also need
`LEMONSQUEEZY_API_KEY`** pointed at a store where subscription `2001` exists,
because the handler fetches the subscription to get its `renews_at`. Without it
the event is logged with an error in `webhook_events` instead of being applied.
Everything the replay would prove is covered offline by
`tests/webhook-state-machine.test.ts`, which stubs that fetch with
`fixtures/api/`, so `npm test` is the better first check.

Replay the same fixture twice in a row to confirm idempotency — the second call
returns `{"ok":true,"duplicate":true}` and the row counts in
`webhook_events`/`purchases`/`subscriptions` do not change.

Check results with:

```sql
SELECT id, email, tier, tier_expires_at FROM users;
SELECT * FROM purchases;
SELECT * FROM subscriptions;
SELECT ls_event_id, event_name, processed_at, error FROM webhook_events;
```
