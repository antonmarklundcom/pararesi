#!/usr/bin/env bash
# Signs and replays a fixture payload against the local webhook endpoint.
# Usage: ./fixtures/send.sh <fixture-name-without-.json> [webhook-url]
set -euo pipefail

FIXTURE_NAME="${1:?Usage: send.sh <fixture-name> [webhook-url]}"
URL="${2:-${APP_URL:-http://localhost:3000}/api/webhooks/lemonsqueezy}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_FILE="$SCRIPT_DIR/${FIXTURE_NAME}.json"

if [ ! -f "$FIXTURE_FILE" ]; then
  echo "No such fixture: $FIXTURE_FILE" >&2
  exit 1
fi

# Load LEMONSQUEEZY_WEBHOOK_SECRET from .env if not already set.
if [ -z "${LEMONSQUEEZY_WEBHOOK_SECRET:-}" ] && [ -f "$SCRIPT_DIR/../.env" ]; then
  LEMONSQUEEZY_WEBHOOK_SECRET="$(grep -E '^LEMONSQUEEZY_WEBHOOK_SECRET=' "$SCRIPT_DIR/../.env" | cut -d= -f2-)"
fi

if [ -z "${LEMONSQUEEZY_WEBHOOK_SECRET:-}" ]; then
  echo "LEMONSQUEEZY_WEBHOOK_SECRET is not set (env or .env)" >&2
  exit 1
fi

SIGNATURE="$(openssl dgst -sha256 -hmac "$LEMONSQUEEZY_WEBHOOK_SECRET" "$FIXTURE_FILE" | sed 's/^.* //')"

echo "POST $URL  (fixture: $FIXTURE_NAME)"
curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  --data-binary "@$FIXTURE_FILE" \
  -w '\nHTTP %{http_code}\n'
