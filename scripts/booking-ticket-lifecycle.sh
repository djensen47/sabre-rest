#!/usr/bin/env bash
# booking-ticket-lifecycle.sh — ticket-lifecycle smoke test.
#
# bargain-finder-max → revalidate-itinerary → create-booking → get-booking
# → check-tickets → fulfill-tickets → get-booking (verify ticketed)
# → void-tickets → cancel-booking → get-booking (verify cancellation).
#
# Extends booking-e2e.sh past the PNR creation point into the ticketing
# lifecycle. Issues a real ticket against the supplied form of payment,
# then voids it (same-day, no fee) before cancelling the PNR. Defaults
# to the universal Visa test PAN 4111-1111-1111-1111; whether Sabre
# CERT actually accepts that PAN is empirical and may depend on the
# carrier and PCC.
#
# Designed for single-leg, single-segment, same-day one-way searches.
# Multi-leg / connecting itineraries are intentionally out of scope —
# if the chosen itinerary has more than one segment, the script aborts
# with a clear message.
#
# Cleanup contract (best-effort, runs on any post-create failure):
#   1. If a ticket was issued, attempt void-tickets first (same-day, no fee).
#   2. Then attempt cancel-booking --cancel-all on the PNR.
# Loud failure messages are written to stderr if either step fails so
# that paid tickets and stale PNRs do not silently leak.
#
# Prerequisites:
#   1. `npm run build`
#   2. A .env file with SABRE_CLIENT_ID, SABRE_CLIENT_SECRET,
#      SABRE_BASE_URL (loaded automatically by the CLI).
#   3. `jq` on PATH.
#
# Usage:
#   scripts/booking-ticket-lifecycle.sh --from DFW --to LAX --departure-date 2026-05-20
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
#   --card-number <pan>           Credit card PAN (default: 4111111111111111)
#   --card-cvv <code>             Card security code (default: 123)
#   --card-expiry <YYYY-MM>       Card expiry (default: 2027-12)
#   --card-type <code>            Card vendor code (default: VI for Visa)
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
CARD_NUMBER="4111111111111111"
CARD_CVV="123"
CARD_EXPIRY="2027-12"
CARD_TYPE="VI"
BASE_URL=""

usage() {
  sed -n '2,49p' "$0" | sed 's/^# \{0,1\}//'
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
    --card-number) CARD_NUMBER="${2:-}"; shift 2 ;;
    --card-cvv) CARD_CVV="${2:-}"; shift 2 ;;
    --card-expiry) CARD_EXPIRY="${2:-}"; shift 2 ;;
    --card-type) CARD_TYPE="${2:-}"; shift 2 ;;
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
TICKETED=0
CLEANUP_ATTEMPTED=0

# Runs the CLI capturing stdout only; stderr goes to $TMP_ERR. On
# failure, the stderr is echoed back to the console. Using a single
# temp file across calls is fine because each call fully consumes it
# before the next.
run_cli() {
  : > "$TMP_ERR"
  "$@" 2>"$TMP_ERR"
}

# Cleanup contract: if a ticket was issued, void it before cancelling
# the PNR — voiding a same-day ticket is free, and cancel-booking on a
# ticketed PNR may not release the financial document. Both steps are
# best-effort and emit loud failure messages on stderr so that paid
# tickets do not silently leak.
cleanup() {
  [[ -z "$CONFIRMATION_ID" || "$CLEANUP_ATTEMPTED" == "1" ]] && return
  CLEANUP_ATTEMPTED=1
  echo "" >&2
  if [[ "$TICKETED" == "1" ]]; then
    echo "cleanup: attempting void-tickets for $CONFIRMATION_ID" >&2
    if $CLI void-tickets "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID" >/dev/null 2>&1; then
      echo "cleanup: void-tickets succeeded" >&2
    else
      echo "cleanup: void-tickets FAILED (a paid ticket may have leaked — investigate $CONFIRMATION_ID manually)" >&2
    fi
  fi
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

DEP_TIME_LOCAL="${DEP_TIME%%[+-]*}"
ARR_TIME_LOCAL="${ARR_TIME%%[+-]*}"
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
echo "isTicketed:   $(echo "$GET_OUT" | jq -r '.isTicketed // false')"
echo "isCancelable: $(echo "$GET_OUT" | jq -r '.isCancelable // false')"
echo "flights:      $(echo "$GET_OUT" | jq -r '.flights | length // 0')"

# ---------------------------------------------------------------------------
step 5 "check-tickets (pre-fulfillment QC)"
if ! CHECK_OUT=$(run_cli $CLI check-tickets "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "check-tickets"
fi
echo "tickets returned: $(echo "$CHECK_OUT" | jq -r '.tickets | length // 0')"
echo "errors:           $(echo "$CHECK_OUT" | jq -r '.errors | length // 0')"

# ---------------------------------------------------------------------------
step 6 "fulfill-tickets (PAYMENTCARD ${CARD_TYPE} ****$(printf '%s' "$CARD_NUMBER" | tail -c 4))"
FULFILL_BODY=$(jq -n \
  --arg cid "$CONFIRMATION_ID" \
  --arg cardType "$CARD_TYPE" \
  --arg cardNumber "$CARD_NUMBER" \
  --arg cardCvv "$CARD_CVV" \
  --arg cardExpiry "$CARD_EXPIRY" \
  '{
    confirmationId: $cid,
    fulfillments: [{}],
    formsOfPayment: [{
      type: "PAYMENTCARD",
      cardTypeCode: $cardType,
      cardNumber: $cardNumber,
      cardSecurityCode: $cardCvv,
      expiryDate: $cardExpiry
    }]
  }')

if ! FULFILL_OUT=$(run_cli $CLI fulfill-tickets "${BASE_URL_FLAG[@]}" --body "$FULFILL_BODY"); then
  cat "$TMP_ERR" >&2
  fail "fulfill-tickets"
fi
TICKET_COUNT=$(echo "$FULFILL_OUT" | jq -r '.tickets | length // 0')
echo "tickets issued: $TICKET_COUNT"
echo "errors:         $(echo "$FULFILL_OUT" | jq -r '.errors | length // 0')"
if [[ "$TICKET_COUNT" == "0" ]]; then
  echo "$FULFILL_OUT" | jq '.errors // []' >&2
  fail "fulfill-tickets (no tickets in response)"
fi
TICKETED=1
TICKET_NUMBERS=$(echo "$FULFILL_OUT" | jq -r '.tickets[].number')
echo "ticket numbers:"
printf '  %s\n' $TICKET_NUMBERS

# ---------------------------------------------------------------------------
step 7 "get-booking (verify ticketed)"
if ! VERIFY_TICKETED=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "get-booking (post-fulfill)"
fi
IS_TICKETED=$(echo "$VERIFY_TICKETED" | jq -r '.isTicketed // false')
echo "isTicketed: $IS_TICKETED"
if [[ "$IS_TICKETED" != "true" ]]; then
  echo "warning: PNR isTicketed=false despite fulfill-tickets returning $TICKET_COUNT ticket(s) — Sabre eventual consistency, or a real defect" >&2
fi

# ---------------------------------------------------------------------------
step 8 "void-tickets (release the financial document)"
if ! VOID_OUT=$(run_cli $CLI void-tickets "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "void-tickets"
fi
echo "voidedTickets: $(echo "$VOID_OUT" | jq -r '.voidedTickets | length // 0')"
echo "errors:        $(echo "$VOID_OUT" | jq -r '.errors | length // 0')"
TICKETED=0

# ---------------------------------------------------------------------------
step 9 "cancel-booking (cancelAll)"
if ! CANCEL_OUT=$(run_cli $CLI cancel-booking "${BASE_URL_FLAG[@]}" \
    --confirmation-id "$CONFIRMATION_ID" --cancel-all --retrieve-booking); then
  cat "$TMP_ERR" >&2
  fail "cancel-booking"
fi
CLEANUP_ATTEMPTED=1
echo "voidedTickets:   $(echo "$CANCEL_OUT" | jq -r '.voidedTickets | length // 0')"
echo "refundedTickets: $(echo "$CANCEL_OUT" | jq -r '.refundedTickets | length // 0')"

# ---------------------------------------------------------------------------
step 10 "get-booking (post-cancel)"
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
echo "booking-ticket-lifecycle: OK"
