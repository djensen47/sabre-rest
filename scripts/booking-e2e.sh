#!/usr/bin/env bash
# booking-e2e.sh — full end-to-end smoke test.
#
# bargain-finder-max → revalidate-itinerary → create-booking → get-booking
# → modify-booking → cancel-booking → get-booking (verify).
#
# Designed for single-leg, single-segment, same-day one-way searches.
# Multi-leg / connecting itineraries are intentionally out of scope for
# this smoke test (they need per-segment date bookkeeping that bash+jq
# is the wrong tool for). If the chosen itinerary has more than one
# segment, the script aborts with a clear message.
#
# Prerequisites:
#   1. `npm run build`
#   2. A .env file with SABRE_CLIENT_ID, SABRE_CLIENT_SECRET,
#      SABRE_BASE_URL (loaded automatically by the CLI).
#   3. `jq` on PATH.
#
# Usage:
#   scripts/booking-e2e.sh --from DFW --to LAX --departure-date 2026-05-15
#
# Flags:
#   --from <iata>                 Origin IATA (required)
#   --to <iata>                   Destination IATA (required)
#   --departure-date <YYYY-MM-DD> Departure date (required)
#   --itinerary-index <n>         Which BFM result to book (default: 0)
#   --given-name <name>           Traveler given name (default: JOHN)
#   --surname <name>              Traveler surname (default: DOE)
#   --phone <number>              Contact phone (default: 1234567890)
#   --email <addr>                Contact email (optional)
#   --base-url <url>              Override SABRE_BASE_URL
#   -h, --help                    Show this help

set -o pipefail

CLI="node dist/cli.js"
FROM=""
TO=""
DEP_DATE=""
ITIN_INDEX=0
GIVEN_NAME="JOHN"
SURNAME="DOE"
PHONE="1234567890"
EMAIL=""
BASE_URL=""

usage() {
  sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --departure-date) DEP_DATE="${2:-}"; shift 2 ;;
    --itinerary-index) ITIN_INDEX="${2:-}"; shift 2 ;;
    --given-name) GIVEN_NAME="${2:-}"; shift 2 ;;
    --surname) SURNAME="${2:-}"; shift 2 ;;
    --phone) PHONE="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; usage >&2; exit 2 ;;
  esac
done

missing=()
[[ -z "$FROM" ]] && missing+=("--from")
[[ -z "$TO" ]] && missing+=("--to")
[[ -z "$DEP_DATE" ]] && missing+=("--departure-date")
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

TMP_ERR=$(mktemp)
trap 'rm -f "$TMP_ERR"' EXIT

CONFIRMATION_ID=""
CLEANUP_ATTEMPTED=0

# Runs the CLI capturing stdout only; stderr goes to $TMP_ERR. On
# failure, the stderr is echoed back to the console. Using a single
# temp file across calls is fine because each call fully consumes it
# before the next.
run_cli() {
  : > "$TMP_ERR"
  "$@" 2>"$TMP_ERR"
}

cleanup() {
  [[ -z "$CONFIRMATION_ID" || "$CLEANUP_ATTEMPTED" == "1" ]] && return
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
  echo "" >&2
  echo "$1 FAILED" >&2
  cleanup
  exit 1
}

step() {
  local n="$1" label="$2"
  echo ""
  echo "[$n] $label"
  printf '%*s\n' $(( ${#n} + ${#label} + 4 )) '' | tr ' ' '-'
}

# ---------------------------------------------------------------------------
step 1 "bargain-finder-max ($FROM → $TO on $DEP_DATE)"
BFM_FILE=$(mktemp)
trap 'rm -f "$TMP_ERR" "$BFM_FILE"' EXIT
if ! $CLI bargain-finder-max "${BASE_URL_FLAG[@]}" \
    --from "$FROM" --to "$TO" --departure-date "$DEP_DATE" \
    >"$BFM_FILE" 2>"$TMP_ERR"; then
  cat "$TMP_ERR" >&2
  fail "bargain-finder-max"
fi

if [[ -n "${BOOKING_E2E_DEBUG:-}" ]]; then
  cp "$BFM_FILE" /tmp/booking-e2e-bfm.json
  echo "(debug) BFM response: /tmp/booking-e2e-bfm.json ($(wc -l < /tmp/booking-e2e-bfm.json) lines)"
fi

# Require exactly one leg, one segment for this smoke test.
ITIN=$(jq --argjson i "$ITIN_INDEX" '.itineraries[$i]' "$BFM_FILE")
if [[ "$ITIN" == "null" ]]; then
  echo "error: no itinerary at index $ITIN_INDEX (BFM returned $(jq '.itineraries | length' "$BFM_FILE") results)" >&2
  exit 1
fi
LEG_COUNT=$(echo "$ITIN" | jq '.legs | length')
SEG_COUNT=$(echo "$ITIN" | jq '.legs[0].segments | length')
if [[ "$LEG_COUNT" != "1" || "$SEG_COUNT" != "1" ]]; then
  echo "error: this smoke test only supports single-leg/single-segment itineraries" >&2
  echo "       got legs=$LEG_COUNT segments=$SEG_COUNT at itinerary index $ITIN_INDEX" >&2
  echo "       try --itinerary-index N to pick a simpler result" >&2
  exit 1
fi

CARRIER=$(echo "$ITIN" | jq -r '.legs[0].segments[0].marketingCarrier // empty')
FLIGHT_NUM=$(echo "$ITIN" | jq -r '.legs[0].segments[0].marketingFlightNumber // empty')
DEP_TIME=$(echo "$ITIN" | jq -r '.legs[0].segments[0].departure.time // empty')
ARR_TIME=$(echo "$ITIN" | jq -r '.legs[0].segments[0].arrival.time // empty')
BOOKING_CLASS=$(echo "$ITIN" | jq -r '.fareOffers[0].passengerFares[0].fareComponents[0].segments[0].bookingCode // empty')

if [[ -z "$CARRIER" || -z "$FLIGHT_NUM" || -z "$DEP_TIME" || -z "$ARR_TIME" || -z "$BOOKING_CLASS" ]]; then
  echo "error: BFM result is missing one or more required fields" >&2
  echo "  carrier=$CARRIER flight#=$FLIGHT_NUM depTime=$DEP_TIME arrTime=$ARR_TIME class=$BOOKING_CLASS" >&2
  exit 1
fi

# Strip timezone offset if present (12:40:00+04:00 → 12:40:00).
DEP_TIME_LOCAL="${DEP_TIME%%[+-]*}"
ARR_TIME_LOCAL="${ARR_TIME%%[+-]*}"
# Short HH:MM form for createBooking's departureTime field.
DEP_HHMM="${DEP_TIME_LOCAL%:*}"

echo "itinerary:    ${FROM} → ${TO}"
echo "flight:       ${CARRIER}${FLIGHT_NUM}"
echo "depart:       ${DEP_DATE} ${DEP_TIME_LOCAL}"
echo "arrive:       ${ARR_TIME_LOCAL}"
echo "bookingClass: ${BOOKING_CLASS}"

# ---------------------------------------------------------------------------
step 2 "revalidate-itinerary"
if ! REVAL_OUT=$(run_cli $CLI revalidate-itinerary "${BASE_URL_FLAG[@]}" \
    --from "$FROM" --to "$TO" --departure-date "$DEP_DATE" \
    --carrier "$CARRIER" --flight-number "$FLIGHT_NUM" \
    --flight-depart "${DEP_DATE}T${DEP_TIME_LOCAL}" \
    --flight-arrive "${DEP_DATE}T${ARR_TIME_LOCAL}" \
    --class "$BOOKING_CLASS"); then
  cat "$TMP_ERR" >&2
  fail "revalidate-itinerary"
fi
REVAL_COUNT=$(echo "$REVAL_OUT" | jq '.itineraries | length // 0')
echo "priced itineraries: $REVAL_COUNT"
if [[ "$REVAL_COUNT" == "0" ]]; then
  fail "revalidate-itinerary (no itineraries returned)"
fi

# ---------------------------------------------------------------------------
step 3 "create-booking"
CREATE_BODY=$(jq -n \
  --arg flightNumber "$FLIGHT_NUM" \
  --arg airlineCode "$CARRIER" \
  --arg from "$FROM" \
  --arg to "$TO" \
  --arg depDate "$DEP_DATE" \
  --arg depTime "$DEP_HHMM" \
  --arg bookingClass "$BOOKING_CLASS" \
  --arg givenName "$GIVEN_NAME" \
  --arg surname "$SURNAME" \
  --arg phone "$PHONE" \
  --arg email "$EMAIL" \
  '{
    flightDetails: {
      flights: [{
        flightNumber: ($flightNumber | tonumber),
        airlineCode: $airlineCode,
        fromAirportCode: $from,
        toAirportCode: $to,
        departureDate: $depDate,
        departureTime: $depTime,
        bookingClass: $bookingClass
      }]
    },
    travelers: [{
      givenName: $givenName,
      surname: $surname,
      passengerCode: "ADT"
    }],
    contactInfo: (
      { phones: [$phone] }
      + (if $email == "" then {} else { emails: [$email] } end)
    )
  }')

if ! CREATE_OUT=$(run_cli $CLI create-booking "${BASE_URL_FLAG[@]}" --body "$CREATE_BODY"); then
  cat "$TMP_ERR" >&2
  fail "create-booking"
fi
CONFIRMATION_ID=$(echo "$CREATE_OUT" | jq -r '.confirmationId // empty')
if [[ -z "$CONFIRMATION_ID" ]]; then
  echo "$CREATE_OUT" >&2
  fail "create-booking (no confirmationId)"
fi
echo "confirmationId: $CONFIRMATION_ID"

# ---------------------------------------------------------------------------
step 4 "get-booking"
if ! GET_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "get-booking"
fi
BOOKING_SIGNATURE=$(echo "$GET_OUT" | jq -r '.bookingSignature // empty')
echo "bookingSignature: ${BOOKING_SIGNATURE:-(none)}"
echo "isTicketed:       $(echo "$GET_OUT" | jq -r '.isTicketed // false')"
echo "isCancelable:     $(echo "$GET_OUT" | jq -r '.isCancelable // false')"
echo "flights:          $(echo "$GET_OUT" | jq -r '.flights | length // 0')"
[[ -z "$BOOKING_SIGNATURE" ]] && fail "get-booking (no bookingSignature)"

# ---------------------------------------------------------------------------
step 5 "modify-booking (add GENERAL remark)"
MODIFY_BODY=$(echo "$GET_OUT" | jq \
  --arg cid "$CONFIRMATION_ID" \
  --arg sig "$BOOKING_SIGNATURE" \
  '{
    confirmationId: $cid,
    bookingSignature: $sig,
    before: { remarks: (.remarks // []) },
    after: { remarks: ((.remarks // []) + [{type: "GENERAL", text: "booking-e2e smoke test"}]) },
    retrieveBooking: true
  }')
if ! MODIFY_OUT=$(run_cli $CLI modify-booking "${BASE_URL_FLAG[@]}" --body "$MODIFY_BODY"); then
  cat "$TMP_ERR" >&2
  fail "modify-booking"
fi
echo "remarks: $(echo "$MODIFY_OUT" | jq -r '.booking.remarks | length // 0')"

# ---------------------------------------------------------------------------
step 6 "cancel-booking (cancelAll)"
if ! CANCEL_OUT=$(run_cli $CLI cancel-booking "${BASE_URL_FLAG[@]}" \
    --confirmation-id "$CONFIRMATION_ID" --cancel-all --retrieve-booking); then
  cat "$TMP_ERR" >&2
  fail "cancel-booking"
fi
CLEANUP_ATTEMPTED=1
echo "voidedTickets:   $(echo "$CANCEL_OUT" | jq -r '.voidedTickets | length // 0')"
echo "refundedTickets: $(echo "$CANCEL_OUT" | jq -r '.refundedTickets | length // 0')"

# ---------------------------------------------------------------------------
step 7 "get-booking (post-cancel)"
if VERIFY_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  echo "isCancelable: $(echo "$VERIFY_OUT" | jq -r '.isCancelable // false')"
else
  if grep -q 'status: 404' "$TMP_ERR"; then
    echo "booking no longer retrievable (404) — cancellation confirmed"
  else
    cat "$TMP_ERR" >&2
    fail "get-booking (post-cancel)"
  fi
fi

echo ""
echo "booking-e2e: OK"
