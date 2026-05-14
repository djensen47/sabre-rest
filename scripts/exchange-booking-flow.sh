#!/usr/bin/env bash
# exchange-booking-flow.sh — manual smoke test for Exchange Booking v1.1.0.
#
# Drives the sabre-rest CLI through:
#   1. get-booking      → verify the PNR exists, surface flights + ticket numbers
#   2. exchange-booking → run the exchange (quote or commit, depending on payload)
#   3. (post-commit)    → get-booking again to surface the new ticketed state
#
# The PNR locator is taken from a flag and injected into the payload at run
# time, so the same payload file can be reused across PNRs. Everything else
# (originalTicketNumber, newSegments, priceTolerance, optional confirm block,
# etc.) lives in the JSON payload.
#
# Quote vs commit:
#   - Omit "confirm" from the payload → quote-only. PQR is created with the
#     change-fee + fare-difference; no FOP collected.
#   - Include "confirm" with formOfPayment → commit. FOP is charged and the
#     new ticket is issued as part of the same transaction.
#
# Prerequisites:
#   1. `npm run build`
#   2. A .env file in the current directory with SABRE_CLIENT_ID,
#      SABRE_CLIENT_SECRET, and SABRE_BASE_URL.
#   3. `jq` on PATH.
#   4. A JSON payload file with at least originalTicketNumber, receivedFrom,
#      and either cancelSegments + newSegments, or one of them. PR locator
#      need not be present — it is injected from --pnr.
#
# Usage:
#   scripts/exchange-booking-flow.sh --pnr IJNPIE --payload ./exchange.json
#   scripts/exchange-booking-flow.sh --pnr IJNPIE --payload ./exchange.json \
#     --base-url https://api.cert.platform.sabre.com
#   scripts/exchange-booking-flow.sh --pnr IJNPIE --payload ./exchange.json --debug
#
# This script does NOT cancel or roll back a successful exchange. Exchange
# Booking is a destructive, billable transaction against an existing PNR.
# Run it on test PNRs only.

set -u
set -o pipefail

CLI="node dist/cli.js"
PNR=""
PAYLOAD=""
BASE_URL=""
DEBUG=0

usage() {
  cat <<EOF
Usage: $0 --pnr <locator> --payload <file> [--base-url <url>] [--debug]

Drives an exchange against an existing PNR.

Flags:
  --pnr <locator>    PNR record locator to exchange (required)
  --payload <file>   JSON ExchangeFlightInput minus pnrLocator (required)
  --base-url <url>   Override SABRE_BASE_URL (optional)
  --debug            Print the outbound HTTP request to stderr
  -h, --help         Show this help

The PNR locator is merged into the payload at run time as pnrLocator.

Quote vs commit:
  Omit "confirm" from the payload → quote (no FOP charged).
  Include "confirm" with formOfPayment → commit (FOP charged, ticket issued).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pnr)
      PNR="${2:-}"
      shift 2
      ;;
    --payload)
      PAYLOAD="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --debug)
      DEBUG=1
      shift 1
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

if [[ -z "$PNR" ]]; then
  echo "error: --pnr is required" >&2
  usage >&2
  exit 2
fi

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

DEBUG_FLAG=()
if [[ "$DEBUG" == "1" ]]; then
  DEBUG_FLAG=(--debug-request)
fi

fail() {
  local step="$1"
  echo "" >&2
  echo "$step FAILED" >&2
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
step 1 "get-booking ($PNR) — verify PNR + surface ticket numbers"
if ! GET_OUT=$($CLI get-booking ${BASE_URL_FLAG[@]+"${BASE_URL_FLAG[@]}"} --confirmation-id "$PNR" 2>&1); then
  echo "$GET_OUT" >&2
  fail "get-booking"
fi
echo "isTicketed:   $(echo "$GET_OUT" | jq -r '.isTicketed // false')"
echo "isCancelable: $(echo "$GET_OUT" | jq -r '.isCancelable // false')"
echo "flights:      $(echo "$GET_OUT" | jq -r '.flights | length // 0')"
TICKETS=$(echo "$GET_OUT" | jq -r '.flightTickets[]?.number // empty' 2>/dev/null || echo "")
if [[ -n "$TICKETS" ]]; then
  echo "tickets:"
  printf '  %s\n' $TICKETS
else
  echo "tickets:      (none surfaced; use the value already in your payload)"
fi

# ---------------------------------------------------------------------------
step 2 "exchange-booking — running with pnrLocator=$PNR"
PAYLOAD_JSON=$(cat "$PAYLOAD")
# Inject pnrLocator from --pnr; overrides any value in the payload to make
# the payload portable across PNRs.
EXCHANGE_BODY=$(echo "$PAYLOAD_JSON" | jq --arg pnr "$PNR" '. + {pnrLocator: $pnr}')

# Detect quote-vs-commit so the operator sees what mode we're running in.
HAS_CONFIRM=$(echo "$EXCHANGE_BODY" | jq -r 'if .confirm == null then "0" else "1" end')
if [[ "$HAS_CONFIRM" == "1" ]]; then
  echo "mode: COMMIT (confirm block present — FOP will be charged)"
else
  echo "mode: QUOTE (no confirm block — PQR stored, no FOP charged)"
fi

if ! EXCHANGE_OUT=$($CLI exchange-booking ${BASE_URL_FLAG[@]+${BASE_URL_FLAG[@]+"${BASE_URL_FLAG[@]}"}} ${DEBUG_FLAG[@]+"${DEBUG_FLAG[@]}"} --body "$EXCHANGE_BODY" 2>&1); then
  echo "$EXCHANGE_OUT" >&2
  fail "exchange-booking"
fi

STATUS=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.status // "(none)"')
echo "applicationResults.status: $STATUS"

WARN_COUNT=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.warnings | length // 0')
ERR_COUNT=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.errors | length // 0')
echo "warnings: $WARN_COUNT   errors: $ERR_COUNT"

CONF_COUNT=$(echo "$EXCHANGE_OUT" | jq -r '.exchangeConfirmations | length // 0')
PQR_COUNT=$(echo "$EXCHANGE_OUT" | jq -r '.priceQuoteReissue | length // 0')
echo "exchangeConfirmations: $CONF_COUNT"
echo "priceQuoteReissue:     $PQR_COUNT"

if [[ "$CONF_COUNT" != "0" ]]; then
  echo ""
  echo "Confirmations:"
  echo "$EXCHANGE_OUT" | jq -r '.exchangeConfirmations[] | "  PQR \(.pqrNumber // "?")  amountReturned=\(.amountReturned // "?")  autoRedirect=\(.autoRedirect // "-")  \(.additionalText // "")"'
fi

if [[ "$PQR_COUNT" != "0" ]]; then
  echo ""
  echo "Price Quote Reissue summary:"
  echo "$EXCHANGE_OUT" | jq -r '.priceQuoteReissue[] |
    "  PQR \(.pqrNumber // "?")\n" +
    "    base:   \(.itinTotalFare.baseFare.amount // "?") \(.itinTotalFare.baseFare.currencyCode // "")\n" +
    "    taxes:  \(.itinTotalFare.taxes.totalAmount // "?")\n" +
    "    total:  \(.itinTotalFare.totalFare.amount // "?") \(.itinTotalFare.totalFare.currencyCode // "")\n" +
    "    chgFee: \((.exchangeDetails.changeFees // []) | map(.amount // "?") | join(", "))\n" +
    "    docNum: \(.exchangeDetails.docNumber // "?")"'
fi

if [[ "$ERR_COUNT" != "0" ]]; then
  echo ""
  echo "Errors:" >&2
  echo "$EXCHANGE_OUT" | jq '.applicationResults.errors' >&2
  fail "exchange-booking (Sabre returned application errors)"
fi

# ---------------------------------------------------------------------------
if [[ "$HAS_CONFIRM" == "1" ]]; then
  step 3 "get-booking ($PNR) — verify post-commit state"
  if ! VERIFY_OUT=$($CLI get-booking ${BASE_URL_FLAG[@]+"${BASE_URL_FLAG[@]}"} --confirmation-id "$PNR" 2>&1); then
    echo "$VERIFY_OUT" >&2
    fail "get-booking (post-commit)"
  fi
  echo "isTicketed:   $(echo "$VERIFY_OUT" | jq -r '.isTicketed // false')"
  echo "flights:      $(echo "$VERIFY_OUT" | jq -r '.flights | length // 0')"
  NEW_TICKETS=$(echo "$VERIFY_OUT" | jq -r '.flightTickets[]?.number // empty' 2>/dev/null || echo "")
  if [[ -n "$NEW_TICKETS" ]]; then
    echo "tickets:"
    printf '  %s\n' $NEW_TICKETS
  fi
fi

echo ""
echo "exchange-booking-flow: OK"
