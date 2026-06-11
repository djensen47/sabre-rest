#!/usr/bin/env bash
# flight-reshop-flow.sh — manual smoke test for Flight Reshop v1.0.
#
# Shops for priceable reissue offers against an existing ticket using the
# Flight Reshop API (the REST replacement for the legacy ExchangeShoppingRQ).
# This is a READ-ONLY shopping call: it does not cancel, rebook, or reissue
# anything, so there is no cleanup step and nothing billable is created.
#
# It drives the sabre-rest CLI:
#   flight-reshop --body '{journeys, tickets, ...}'
# and prints a short summary of the offers (or the downline error).
#
# What "good" looks like (verified in CERT on PCC H50H since 2026-06-09,
# when Sabre activated automated reissue):
#   - offers[] populated (~45-50 on AA DFW->LAX), each with
#     totalPriceDifference (grandTotal + type = Add collect/Even/Refund).
# If instead you get HTTP 200 with errors[].description = "Automated reissue
# not active for this ticket" and NO offers, the endpoint is entitled and
# reachable but the ticket/PCC is not provisioned for automated reissue.
# This script surfaces that error verbatim so the state is obvious.
#
# Provide either:
#   --ticket <number>   an existing electronic ticket number (required), and
#   --from / --to       the change-to journey origin/destination (city or
#                       airport IATA codes), and
#   --shop-date         the desired new departure date (YYYY-MM-DD).
# Optionally --booking-id <PNR>, --cabin <name>, --target-pcc <pcc>.
#
# To mint a fresh AA ticket to feed this script, run
# booking-ticket-lifecycle.sh (which issues and then voids a ticket) — note
# that script voids same-day, so capture the ticket number while it is open,
# or issue one separately.
#
# Prerequisites:
#   1. `npm run build`
#   2. A .env file with SABRE_CLIENT_ID, SABRE_CLIENT_SECRET, SABRE_BASE_URL
#      (loaded automatically by the CLI).
#   3. `jq` on PATH.
#
# Usage:
#   scripts/flight-reshop-flow.sh --ticket 0012972101507 \
#     --from DFW --to LAX --shop-date 2026-09-26
#   scripts/flight-reshop-flow.sh --ticket 0012972101507 \
#     --from DFW --to LAX --shop-date 2026-09-26 \
#     --booking-id GLEBNY --cabin Business --debug

set -u
set -o pipefail

CLI="node dist/cli.js"
TICKET=""
FROM=""
TO=""
SHOP_DATE=""
BOOKING_ID=""
CABIN=""
TARGET_PCC=""
BASE_URL=""
DEBUG=0

usage() {
  sed -n '2,46p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ticket) TICKET="${2:-}"; shift 2 ;;
    --from) FROM="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --shop-date) SHOP_DATE="${2:-}"; shift 2 ;;
    --booking-id) BOOKING_ID="${2:-}"; shift 2 ;;
    --cabin) CABIN="${2:-}"; shift 2 ;;
    --target-pcc) TARGET_PCC="${2:-}"; shift 2 ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --debug) DEBUG=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; usage >&2; exit 2 ;;
  esac
done

missing=()
[[ -z "$TICKET" ]] && missing+=("--ticket")
[[ -z "$FROM" ]] && missing+=("--from")
[[ -z "$TO" ]] && missing+=("--to")
[[ -z "$SHOP_DATE" ]] && missing+=("--shop-date")
if (( ${#missing[@]} > 0 )); then
  echo "error: missing required flags: ${missing[*]}" >&2
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

BASE_URL_FLAG=()
[[ -n "$BASE_URL" ]] && BASE_URL_FLAG=(--base-url "$BASE_URL")
DEBUG_FLAG=()
[[ "$DEBUG" == "1" ]] && DEBUG_FLAG=(--debug-request)

# Decide whether origin/destination are city or airport codes by length is
# unreliable (both are 3 letters), so default to cityCode — Sabre accepts
# either and city covers the common case. Override by editing the payload
# if you need airportCode semantics.
BODY=$(jq -n \
  --arg from "$FROM" \
  --arg to "$TO" \
  --arg date "$SHOP_DATE" \
  --arg ticket "$TICKET" \
  --arg bookingId "$BOOKING_ID" \
  --arg cabin "$CABIN" \
  --arg pcc "$TARGET_PCC" \
  '{
    journeys: [{
      departureLocation: { cityCode: $from },
      arrivalLocation: { cityCode: $to },
      departureDate: $date
    }],
    tickets: [{ number: $ticket }]
  }
  + (if $bookingId == "" then {} else { bookingId: $bookingId } end)
  + (if $cabin == "" then {} else { cabinName: $cabin } end)
  + (if $pcc == "" then {} else { targetPcc: $pcc } end)')

echo "flight-reshop: ticket=$TICKET  ${FROM}->${TO} on ${SHOP_DATE}"
echo ""

OUT=$($CLI flight-reshop ${BASE_URL_FLAG[@]+"${BASE_URL_FLAG[@]}"} ${DEBUG_FLAG[@]+"${DEBUG_FLAG[@]}"} --body "$BODY")
STATUS=$?
if [[ $STATUS -ne 0 ]]; then
  echo "flight-reshop FAILED (CLI exit $STATUS)" >&2
  echo "$OUT" >&2
  exit 1
fi

OFFERS=$(echo "$OUT" | jq -r '.numberOfOffers // (.offers | length) // 0')
echo "numberOfOffers: $OFFERS"

if [[ "${OFFERS:-0}" -gt 0 ]] 2>/dev/null; then
  echo ""
  echo "offers:"
  echo "$OUT" | jq -r '
    .offers[] |
    "  offer \(.id // "?"): " +
    "\(.totalPriceDifference.type // "?") " +
    "\(.totalPriceDifference.grandTotal // "?") \(.totalPriceDifference.currencyCode // "") " +
    "priceGuaranteed=\(.isPriceGuaranteed // false)"'
else
  echo ""
  echo "no offers — errors:"
  echo "$OUT" | jq -r '(.errors // []) | if length == 0 then "  (none returned)" else .[] | "  [\(.category // "?")/\(.type // "?")] \(.description // "")" end'
fi

echo ""
echo "flight-reshop-flow: done"
