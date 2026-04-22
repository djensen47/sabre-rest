#!/usr/bin/env bash
# booking-flow.sh — manual end-to-end smoke test for Booking Management v1.
#
# Chains the sabre-rest CLI through create → get → modify → cancel against
# a live Sabre environment. Useful after mapper changes to catch
# wire-format issues (defaulted fields, envelope shapes, runtime rejections)
# that unit tests can't see.
#
# Prerequisites:
#   1. `npm run build`
#   2. A .env file in the current directory with SABRE_CLIENT_ID,
#      SABRE_CLIENT_SECRET, and SABRE_BASE_URL. (The CLI loads .env
#      automatically.)
#   3. `jq` on PATH (used to parse intermediate JSON).
#   4. A JSON file with a valid createBooking payload for your account.
#
# Usage:
#   scripts/booking-flow.sh --payload ./payload.json
#   scripts/booking-flow.sh --payload ./payload.json --base-url https://api.cert.platform.sabre.com
#
# Flow:
#   1. create-booking  → capture confirmationId
#   2. get-booking     → capture bookingSignature
#   3. modify-booking  → add a GENERAL remark (safe, minimal change)
#   4. cancel-booking  → cancelAll: true
#   5. get-booking     → verify cancellation (404 is accepted as confirmation)
#
# If any step after step 1 fails, the script attempts a best-effort
# cancel-booking as cleanup so test bookings don't leak.

set -u
set -o pipefail

CLI="node dist/cli.js"
PAYLOAD=""
BASE_URL=""

usage() {
  cat <<EOF
Usage: $0 --payload <file> [--base-url <url>]

Chains create-booking → get-booking → modify-booking → cancel-booking.

Flags:
  --payload <file>   JSON file with a createBooking input (required)
  --base-url <url>   Override SABRE_BASE_URL (optional)
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --payload)
      PAYLOAD="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$PAYLOAD" ]]; then
  echo "error: --payload is required" >&2
  usage >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: 'jq' is required on PATH" >&2
  exit 2
fi

if [[ ! -f "dist/cli.js" ]]; then
  echo "error: dist/cli.js not found — run 'npm run build' first" >&2
  exit 2
fi

if [[ ! -f "$PAYLOAD" ]]; then
  echo "error: payload file not found: $PAYLOAD" >&2
  exit 2
fi

BASE_URL_FLAG=()
if [[ -n "$BASE_URL" ]]; then
  BASE_URL_FLAG=(--base-url "$BASE_URL")
fi

CONFIRMATION_ID=""
CLEANUP_ATTEMPTED=0

cleanup() {
  if [[ -z "$CONFIRMATION_ID" || "$CLEANUP_ATTEMPTED" == "1" ]]; then
    return
  fi
  CLEANUP_ATTEMPTED=1
  echo "" >&2
  echo "cleanup: attempting cancel-booking for $CONFIRMATION_ID" >&2
  if $CLI cancel-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID" --cancel-all >/dev/null 2>&1; then
    echo "cleanup: cancel-booking succeeded" >&2
  else
    echo "cleanup: cancel-booking FAILED (manual cancellation may be required)" >&2
  fi
}

fail() {
  local step="$1"
  echo "" >&2
  echo "$step FAILED" >&2
  cleanup
  exit 1
}

step() {
  local n="$1" label="$2"
  echo ""
  echo "[$n] $label"
  local width=$(( ${#n} + ${#label} + 4 ))
  printf '%*s\n' "$width" '' | tr ' ' '-'
}

# ---------------------------------------------------------------------------
step 1 "create-booking"
PAYLOAD_JSON=$(cat "$PAYLOAD")
if ! CREATE_OUT=$($CLI create-booking "${BASE_URL_FLAG[@]}" --body "$PAYLOAD_JSON" 2>&1); then
  echo "$CREATE_OUT" >&2
  fail "create-booking"
fi
CONFIRMATION_ID=$(echo "$CREATE_OUT" | jq -r '.confirmationId // empty')
if [[ -z "$CONFIRMATION_ID" ]]; then
  echo "$CREATE_OUT" >&2
  fail "create-booking (no confirmationId in response)"
fi
echo "confirmationId: $CONFIRMATION_ID"
echo "timestamp:      $(echo "$CREATE_OUT" | jq -r '.timestamp // "(none)"')"

# ---------------------------------------------------------------------------
step 2 "get-booking"
GET_OUT=$($CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID") || fail "get-booking"
BOOKING_SIGNATURE=$(echo "$GET_OUT" | jq -r '.bookingSignature // empty')
echo "bookingId:        $(echo "$GET_OUT" | jq -r '.bookingId // "(none)"')"
echo "bookingSignature: ${BOOKING_SIGNATURE:-(none)}"
echo "isTicketed:       $(echo "$GET_OUT" | jq -r '.isTicketed // false')"
echo "isCancelable:     $(echo "$GET_OUT" | jq -r '.isCancelable // false')"
echo "flights:          $(echo "$GET_OUT" | jq -r '.flights | length // 0')"
echo "travelers:        $(echo "$GET_OUT" | jq -r '.travelers | length // 0')"
if [[ -z "$BOOKING_SIGNATURE" ]]; then
  fail "get-booking (no bookingSignature — cannot modify)"
fi

# ---------------------------------------------------------------------------
step 3 "modify-booking (add GENERAL remark)"
# Build before/after from the current booking's remarks so we don't clobber
# anything Sabre already attached.
MODIFY_BODY=$(echo "$GET_OUT" | jq \
  --arg cid "$CONFIRMATION_ID" \
  --arg sig "$BOOKING_SIGNATURE" \
  '{
    confirmationId: $cid,
    bookingSignature: $sig,
    before: { remarks: (.remarks // []) },
    after: { remarks: ((.remarks // []) + [{type: "GENERAL", text: "booking-flow smoke test"}]) },
    retrieveBooking: true
  }')
MODIFY_OUT=$($CLI modify-booking "${BASE_URL_FLAG[@]}" --body "$MODIFY_BODY") || fail "modify-booking"
echo "timestamp: $(echo "$MODIFY_OUT" | jq -r '.timestamp // "(none)"')"
echo "remarks:   $(echo "$MODIFY_OUT" | jq -r '.booking.remarks | length // 0')"

# ---------------------------------------------------------------------------
step 4 "cancel-booking (cancelAll)"
CANCEL_OUT=$($CLI cancel-booking "${BASE_URL_FLAG[@]}" \
  --confirmation-id "$CONFIRMATION_ID" \
  --cancel-all \
  --retrieve-booking) || fail "cancel-booking"
CLEANUP_ATTEMPTED=1  # don't re-cancel in the trap
echo "timestamp:       $(echo "$CANCEL_OUT" | jq -r '.timestamp // "(none)"')"
echo "voidedTickets:   $(echo "$CANCEL_OUT" | jq -r '.voidedTickets | length // 0')"
echo "refundedTickets: $(echo "$CANCEL_OUT" | jq -r '.refundedTickets | length // 0')"
echo "flightRefunds:   $(echo "$CANCEL_OUT" | jq -r '.flightRefunds | length // 0')"

# ---------------------------------------------------------------------------
step 5 "get-booking (post-cancel verification)"
if VERIFY_OUT=$($CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID" 2>&1); then
  echo "isCancelable: $(echo "$VERIFY_OUT" | jq -r '.isCancelable // false')"
  echo "flights:      $(echo "$VERIFY_OUT" | jq -r '.flights | length // 0')"
else
  if echo "$VERIFY_OUT" | grep -q 'status: 404'; then
    echo "booking no longer retrievable (404) — cancellation confirmed"
  else
    echo "$VERIFY_OUT" >&2
    fail "get-booking (post-cancel)"
  fi
fi

echo ""
echo "booking-flow: OK"
