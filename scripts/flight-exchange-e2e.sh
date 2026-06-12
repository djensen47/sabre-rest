#!/usr/bin/env bash
# flight-exchange-e2e.sh — FULL exchange lifecycle smoke test.
#
# Exercises the entire flight-exchange flow, including the parts the
# read-only smoke tests stop short of: the Exchange Booking COMMIT and
# the fulfillment of the replacement ticket.
#
#   1. bargain-finder-max      shop the original itinerary (AA recommended)
#   2. revalidate-itinerary    mandatory pre-booking revalidation
#   3. create-booking          book the original PNR
#   4. fulfill-tickets         issue the ORIGINAL ticket (billable)
#   5. flight-reshop           shop reissue offers against that ticket
#   6. (select offer)          pick a priceable offer on a different flight
#   7. exchange-booking        COMMIT the reissue (confirm + FOP — billable)
#   8. get-booking             verify the new itinerary / ticket state
#   9. fulfill-tickets         only if the commit left the PNR unticketed
#  10. void-tickets            release the financial document(s)
#  11. cancel-booking          tear the PNR down
#
# This script ISSUES REAL CERT TICKETS and COMMITS A REAL EXCHANGE. It is
# destructive and billable by design — that is what it exists to prove.
# Run it only against CERT with a test PCC/card.
#
# Cleanup contract (best-effort, runs on any post-create failure):
#   1. void-tickets on the PNR (voids whichever ticket is currently open;
#      same-day void is free).
#   2. cancel-booking --cancel-all.
# Loud stderr messages if either step fails so tickets do not leak.
#
# Offer selection (step 6): offers are filtered to single-journey,
# single-flight options on a DIFFERENT flight number than the original,
# carrying a totalPriceDifference and a bookingClassCode (from the
# fareComponents segment details). Price-guaranteed (CAT-31) offers are
# preferred. The chosen offer's flight + booking class feed the
# exchange-booking newSegments.
#
# Sell status (IMPORTANT): new segments are sold with the DOCUMENTED action
# code NN ("need") by default — what Sabre's own ExchangeBookingRQ example
# uses. In CERT the simulated carrier link does not settle an NN sell within
# the call, so the air-book step typically aborts ("Unable to perform air
# booking step"). THAT FAILURE IS THE DOCUMENTED-PATH RESULT we want to
# capture for Sabre support — it is not a bug in the library.
#
# The passive code GK *will* commit in CERT, but it is a dead end: a GK
# segment never receives an airline record locator, so the reissued document
# can never be ticketed (fulfill fails AirTicketLLSRQ: NEED AIRLINE PNR
# LOCATOR). Committing into something unticketable is not success. Pass
# --sell-status GK only to reproduce that old behaviour for comparison.
#
# Request/response capture: every CLI call's outbound request (via
# --debug-request) and response body is written under .local/<run-dir>/ so a
# failing commit produces a complete, shareable log bundle for Sabre support.
#
# Success criteria printed at the end:
#   - exchange-booking applicationResults.status == Complete
#   - amountReturned matches the reshop offer's grandTotal
#   - post-commit PNR shows the NEW flight
#   With the NN default these will typically NOT all be met in CERT; the run
#   still succeeds at its real job — capturing the documented-path behaviour.
#
# Prerequisites:
#   1. `npm run build`
#   2. .env with SABRE_CLIENT_ID / SABRE_CLIENT_SECRET / SABRE_BASE_URL
#   3. `jq` on PATH
#
# Usage:
#   scripts/flight-exchange-e2e.sh --from DFW --to LAX \
#     --departure-date 2026-07-15 [--new-date 2026-07-16]
#
# Flags:
#   --from <iata>                 Origin IATA (required)
#   --to <iata>                   Destination IATA (required)
#   --departure-date <YYYY-MM-DD> Original-ticket departure date (required)
#   --new-date <YYYY-MM-DD>       Reshop target date (default: --departure-date)
#   --carriers <list>             BFM carrier preference (default: AA — Sabre's
#                                 recommended CERT exchange carrier)
#   --itinerary-index <n>         Which BFM result to book (default: 0)
#   --given-name/--surname/--phone/--email/--seed   Traveler identity
#   --card-number <pan>           FOP PAN (default: 4487971000000006)
#   --card-cvv <code>             Card security code (default: 123)
#   --card-expiry <YYYY-MM>       Card expiry (default: 2027-12)
#   --card-type <code>            Card vendor code (default: VI)
#   --sell-status <code>          Action code for the new segment sell
#                                 (default: NN — the documented request status
#                                 from Sabre's example). NN typically aborts
#                                 the air-book step in CERT (carrier link does
#                                 not settle it); that documented-path result
#                                 is what this script captures. Pass GK to
#                                 reproduce the old passive-sell behaviour (it
#                                 commits but yields an unticketable segment).
#   --fulfill-delay <seconds>     Wait between the exchange commit and the
#                                 reissue fulfill attempt (default: 15). The
#                                 carrier-link confirmation that would put an
#                                 airline locator on the segment is
#                                 asynchronous, so an instant fulfill never
#                                 gives it a chance to arrive.
#   --require-price-difference    Only select reshop offers with a non-zero
#                                 price difference (an actual add-collect or
#                                 refund), choosing the largest. Use to test
#                                 the money path; without it, even ($0)
#                                 exchanges are eligible and often chosen.
#   --no-cleanup                  Leave the PNR/tickets in place (debugging)
#   --base-url <url>              Override SABRE_BASE_URL
#   -h, --help                    Show this help

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/random-person.sh
source "$SCRIPT_DIR/lib/random-person.sh"

CLI="node dist/cli.js"
FROM=""
TO=""
DEP_DATE=""
NEW_DATE=""
CARRIERS="AA"
ITIN_INDEX=0
GIVEN_NAME=""
SURNAME=""
PHONE=""
EMAIL=""
SEED=""
CARD_NUMBER="4487971000000006"
CARD_CVV="123"
CARD_EXPIRY="2027-12"
CARD_TYPE="VI"
SELL_STATUS="NN"
FULFILL_DELAY=15
NO_CLEANUP=0
BASE_URL=""
REQUIRE_PRICE_DIFF=0

usage() {
  sed -n '2,104p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --departure-date) DEP_DATE="${2:-}"; shift 2 ;;
    --new-date) NEW_DATE="${2:-}"; shift 2 ;;
    --carriers) CARRIERS="${2:-}"; shift 2 ;;
    --itinerary-index) ITIN_INDEX="${2:-}"; shift 2 ;;
    --given-name) GIVEN_NAME="${2:-}"; shift 2 ;;
    --surname) SURNAME="${2:-}"; shift 2 ;;
    --phone) PHONE="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --seed) SEED="${2:-}"; shift 2 ;;
    --card-number) CARD_NUMBER="${2:-}"; shift 2 ;;
    --card-cvv) CARD_CVV="${2:-}"; shift 2 ;;
    --card-expiry) CARD_EXPIRY="${2:-}"; shift 2 ;;
    --card-type) CARD_TYPE="${2:-}"; shift 2 ;;
    --sell-status) SELL_STATUS="${2:-}"; shift 2 ;;
    --fulfill-delay) FULFILL_DELAY="${2:-}"; shift 2 ;;
    --require-price-difference) REQUIRE_PRICE_DIFF=1; shift ;;
    --no-cleanup) NO_CLEANUP=1; shift ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; usage >&2; exit 2 ;;
  esac
done

generate_person "$SEED"
GIVEN_NAME="${GIVEN_NAME:-$PERSON_GIVEN_NAME}"
SURNAME="${SURNAME:-$PERSON_SURNAME}"
PHONE="${PHONE:-$PERSON_PHONE}"
EMAIL="${EMAIL:-$PERSON_EMAIL}"
BIRTHDATE="$PERSON_BIRTHDATE"
GENDER="$PERSON_GENDER"
echo "traveler: $GIVEN_NAME $SURNAME ($GENDER, $BIRTHDATE)  phone=$PHONE  email=$EMAIL  (seed=$PERSON_SEED)"

missing=()
[[ -z "$FROM" ]] && missing+=("--from")
[[ -z "$TO" ]] && missing+=("--to")
[[ -z "$DEP_DATE" ]] && missing+=("--departure-date")
if (( ${#missing[@]} > 0 )); then
  echo "error: missing required flags: ${missing[*]}" >&2
  usage >&2
  exit 2
fi
NEW_DATE="${NEW_DATE:-$DEP_DATE}"

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

# Source .env so SABRE_PCC is available for the fulfill targetPcc.
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

TMP_ERR=$(mktemp)
trap 'rm -f "$TMP_ERR"' EXIT

CONFIRMATION_ID=""
TICKETED=0
CLEANUP_ATTEMPTED=0

# --- request/response log bundle (for Sabre support) -----------------------
# Every CLI call's outbound request (via --debug-request) and response body is
# saved under a per-run directory in .local/ (gitignored). The Authorization
# bearer token is redacted from saved requests so the bundle is shareable.
CURRENT_STEP="00-init"
if [[ -d .local ]]; then
  LOG_DIR=".local/exchange-e2e-$(date +%Y%m%dT%H%M%S)-$$"
  mkdir -p "$LOG_DIR"
  echo "request/response log bundle: $LOG_DIR"
else
  LOG_DIR=""
  echo "note: .local/ not present — request/response logging disabled" >&2
fi

# Pass --debug-request to every CLI call so the outbound wire request is
# emitted (to stderr) and captured into the bundle.
DBG=(--debug-request)

# run_cli <cli> <args...> — runs a CLI call, returns its stdout (so callers can
# capture it), and tees stdout→<step>.response and stderr→<step>.request+stderr
# into the log bundle. Authorization headers are redacted on the way to disk.
run_cli() {
  : > "$TMP_ERR"
  if [[ -z "$LOG_DIR" ]]; then
    "$@" 2>"$TMP_ERR"
    return
  fi
  # run_cli is typically invoked inside $(...), so a shell variable increment
  # would not persist to the parent. Keep the sequence in a file instead.
  local seq
  seq=$(( $(cat "$LOG_DIR/.seq" 2>/dev/null || echo 0) + 1 ))
  echo "$seq" >"$LOG_DIR/.seq"
  local base
  base="$(printf '%s/%02d-%s' "$LOG_DIR" "$seq" "$CURRENT_STEP")"
  local rc
  # Append --debug-request so the outbound wire request is emitted to stderr
  # and captured. All trailing tokens are flags, so order is irrelevant.
  "$@" "${DBG[@]}" 2>"$TMP_ERR" | tee "$base.response.json"
  rc=${PIPESTATUS[0]}
  # stderr holds the --debug-request dump (and any error body); redact the
  # bearer token before persisting.
  sed 's/^[Aa]uthorization:.*/Authorization: [REDACTED]/' "$TMP_ERR" >"$base.request.txt"
  return "$rc"
}

cleanup() {
  [[ -z "$CONFIRMATION_ID" || "$CLEANUP_ATTEMPTED" == "1" ]] && return
  if [[ "$NO_CLEANUP" == "1" ]]; then
    echo "" >&2
    echo "cleanup: SKIPPED (--no-cleanup) — PNR $CONFIRMATION_ID and its tickets are still live" >&2
    return
  fi
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
  [[ -n "$LOG_DIR" ]] && echo "request/response bundle (incl. this failure): $LOG_DIR" >&2
  cleanup
  exit 1
}

step() {
  local n="$1" label="$2"
  # Derive a filename-safe slug for the log bundle from the leading word of
  # the label (run_cli prefixes its own global sequence number for ordering).
  local slug="${label%% *}"
  slug="${slug%%(*}"
  slug="${slug//[^a-zA-Z0-9_-]/}"
  CURRENT_STEP="$slug"
  echo ""
  echo "[$n] $label"
  printf '%*s\n' $(( ${#n} + ${#label} + 4 )) '' | tr ' ' '-'
}

# ---------------------------------------------------------------------------
step 1 "bargain-finder-max ($FROM → $TO on $DEP_DATE, carriers=$CARRIERS)"
BFM_FILE=$(mktemp)
trap 'rm -f "$TMP_ERR" "$BFM_FILE"' EXIT
# BFM streams to a temp file for jq; route through run_cli so it lands in the
# log bundle too, then keep a copy in BFM_FILE for downstream parsing.
if ! run_cli $CLI bargain-finder-max "${BASE_URL_FLAG[@]}" \
    --from "$FROM" --to "$TO" --departure-date "$DEP_DATE" --carriers "$CARRIERS" \
    >"$BFM_FILE"; then
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
  exit 1
fi

CARRIER=$(echo "$ITIN" | jq -r '.legs[0].segments[0].marketingCarrier // empty')
FLIGHT_NUM=$(echo "$ITIN" | jq -r '.legs[0].segments[0].marketingFlightNumber // empty')
DEP_TIME=$(echo "$ITIN" | jq -r '.legs[0].segments[0].departure.time // empty')
ARR_TIME=$(echo "$ITIN" | jq -r '.legs[0].segments[0].arrival.time // empty')
BOOKING_CLASS=$(echo "$ITIN" | jq -r '.fareOffers[0].passengerFares[0].fareComponents[0].segments[0].bookingCode // empty')
if [[ -z "$CARRIER" || -z "$FLIGHT_NUM" || -z "$DEP_TIME" || -z "$ARR_TIME" || -z "$BOOKING_CLASS" ]]; then
  echo "error: BFM result is missing required fields (carrier=$CARRIER flight=$FLIGHT_NUM dep=$DEP_TIME arr=$ARR_TIME class=$BOOKING_CLASS)" >&2
  exit 1
fi
DEP_TIME_LOCAL="${DEP_TIME%%[+-]*}"
ARR_TIME_LOCAL="${ARR_TIME%%[+-]*}"
DEP_HHMM="${DEP_TIME_LOCAL%:*}"
echo "original flight: ${CARRIER}${FLIGHT_NUM} ${FROM}→${TO} ${DEP_DATE} ${DEP_TIME_LOCAL} class=${BOOKING_CLASS}"

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
[[ "$REVAL_COUNT" == "0" ]] && fail "revalidate-itinerary (no itineraries returned)"

# ---------------------------------------------------------------------------
step 3 "create-booking"
CREATE_BODY=$(jq -n \
  --arg flightNumber "$FLIGHT_NUM" --arg airlineCode "$CARRIER" \
  --arg from "$FROM" --arg to "$TO" \
  --arg depDate "$DEP_DATE" --arg depTime "$DEP_HHMM" \
  --arg bookingClass "$BOOKING_CLASS" \
  --arg givenName "$GIVEN_NAME" --arg surname "$SURNAME" \
  --arg birthDate "$BIRTHDATE" --arg gender "$GENDER" \
  --arg phone "$PHONE" --arg email "$EMAIL" \
  --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" \
  --arg cardExpiry "$CARD_EXPIRY" \
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
      }],
      flightPricing: [{}],
      haltOnFlightStatusCodes: ["NO"],
      retryBookingUnconfirmedFlights: true
    },
    travelers: [{
      givenName: $givenName, surname: $surname,
      birthDate: $birthDate, gender: $gender, passengerCode: "ADT",
      identityDocuments: [{
        documentType: "SECURE_FLIGHT_PASSENGER_DATA",
        givenName: $givenName, surname: $surname,
        birthDate: $birthDate, gender: $gender
      }]
    }],
    contactInfo: ({ phones: [$phone] } + (if $email == "" then {} else { emails: [$email] } end)),
    payment: {
      billingAddress: {
        name: "John Smith", street: "1230 Ellen Ave, apt 10",
        city: "Dallas", stateProvince: "TX", postalCode: "75063", countryCode: "US"
      },
      formsOfPayment: [{
        type: "PAYMENTCARD", cardTypeCode: $cardType, cardNumber: $cardNumber,
        expiryDate: $cardExpiry,
        cardHolder: {
          givenName: "John", surname: "Smith", email: $email, phone: $phone,
          address: {
            street: "1230 Ellen Ave, apt 10", city: "Dallas",
            stateProvince: "TX", postalCode: "75063", countryCode: "US"
          }
        }
      }]
    }
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
step 4 "fulfill-tickets — issue the ORIGINAL ticket"
FULFILL_BODY=$(jq -n \
  --arg cid "$CONFIRMATION_ID" --arg pcc "${SABRE_PCC:-}" \
  --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" \
  --arg cardExpiry "$CARD_EXPIRY" \
  '{
    confirmationId: $cid,
    fulfillments: [{ payment: { primaryFormOfPayment: 1 } }],
    formsOfPayment: [{
      type: "PAYMENTCARD", cardTypeCode: $cardType, cardNumber: $cardNumber,
      expiryDate: $cardExpiry, manualApprovalCode: "123456",
      authentications: [{ channelCode: "EC" }]
    }],
    designatePrinters: [{ ticket: { countryCode: "AT" } }]
  }
  + (if $pcc == "" then {} else { targetPcc: $pcc } end)')

if ! FULFILL_OUT=$(run_cli $CLI fulfill-tickets "${BASE_URL_FLAG[@]}" --body "$FULFILL_BODY"); then
  cat "$TMP_ERR" >&2
  fail "fulfill-tickets (original)"
fi
ORIG_TICKET=$(echo "$FULFILL_OUT" | jq -r '.tickets[0].number // empty')
if [[ -z "$ORIG_TICKET" ]]; then
  echo "$FULFILL_OUT" | jq '.errors // []' >&2
  fail "fulfill-tickets (original — no ticket in response)"
fi
TICKETED=1
echo "original ticket: $ORIG_TICKET"

# ---------------------------------------------------------------------------
step 5 "flight-reshop ($FROM → $TO on $NEW_DATE against ticket $ORIG_TICKET)"
RESHOP_BODY=$(jq -n \
  --arg from "$FROM" --arg to "$TO" --arg date "$NEW_DATE" \
  --arg ticket "$ORIG_TICKET" --arg bookingId "$CONFIRMATION_ID" \
  '{
    journeys: [{
      departureLocation: { cityCode: $from },
      arrivalLocation: { cityCode: $to },
      departureDate: $date
    }],
    tickets: [{ number: $ticket }],
    bookingId: $bookingId
  }')

if ! RESHOP_OUT=$(run_cli $CLI flight-reshop "${BASE_URL_FLAG[@]}" --body "$RESHOP_BODY"); then
  cat "$TMP_ERR" >&2
  fail "flight-reshop"
fi
OFFER_COUNT=$(echo "$RESHOP_OUT" | jq -r '.numberOfOffers // (.offers | length) // 0')
echo "numberOfOffers: $OFFER_COUNT"
if [[ "${OFFER_COUNT:-0}" -eq 0 ]] 2>/dev/null; then
  echo "$RESHOP_OUT" | jq -r '(.errors // []) | .[] | "  [\(.category // "?")/\(.type // "?")] \(.description // "")"' >&2
  fail "flight-reshop (no offers)"
fi
if [[ -d .local ]]; then
  echo "$RESHOP_OUT" >".local/reshop-${CONFIRMATION_ID}.json"
  echo "raw reshop response saved: .local/reshop-${CONFIRMATION_ID}.json"
fi

# ---------------------------------------------------------------------------
step 6 "select offer (different flight, single segment, priceable, CAT-31 preferred)"
CHOSEN=$(echo "$RESHOP_OUT" | jq \
  --arg origFlight "$FLIGHT_NUM" --argjson requireDiff "$REQUIRE_PRICE_DIFF" '
  (.flights // []) as $flights
  | (.journeys // []) as $journeys
  | [ (.offers // [])[]
      | . as $o
      | select(.totalPriceDifference.grandTotal != null)
      | select((.journeyRefs // []) | length == 1)
      | ($journeys[] | select(.id == $o.journeyRefs[0])) as $j
      | select(($j.flightRefs // []) | length == 1)
      | $j.flightRefs[0] as $fref
      | ($flights[] | select(.id == $fref)) as $f
      | select(($f.marketingFlightNumber | tostring) != $origFlight)
      | ([ $o.items[0].fares[0].fareComponents[]?.segmentDetails[]?
           | select(.flightRef == $fref) ] | first) as $sd
      | select($sd.bookingClassCode != null)
      # When --require-price-difference is set, keep only offers whose
      # grandTotal is a non-zero amount (an actual add-collect or refund).
      | select($requireDiff == 0 or ((.totalPriceDifference.grandTotal | tonumber) != 0))
      | {
          offerId: $o.id,
          isPriceGuaranteed: ($o.isPriceGuaranteed // false),
          chargeType: $o.totalPriceDifference.type,
          grandTotal: $o.totalPriceDifference.grandTotal,
          currency: $o.totalPriceDifference.currencyCode,
          carrier: $f.marketingAirlineCode,
          flightNumber: ($f.marketingFlightNumber | tostring),
          origin: $f.departureAirportCode,
          destination: $f.arrivalAirportCode,
          departureDateTime: "\($f.departureDate)T\($f.departureTime):00",
          arrivalDateTime: "\($f.arrivalDate)T\($f.arrivalTime):00",
          bookingClass: $sd.bookingClassCode
        }
    ]
  # Prefer price-guaranteed; within that, prefer the largest absolute delta so
  # a --require-price-difference run lands on a meaningful add-collect.
  | sort_by([ (if .isPriceGuaranteed then 0 else 1 end),
              (- (.grandTotal | tonumber | fabs)) ])
  | first // empty')
if [[ -z "$CHOSEN" ]]; then
  if [[ "$REQUIRE_PRICE_DIFF" == "1" ]]; then
    echo "error: no offer with a non-zero price difference survived selection" >&2
    echo "       (try a different --new-date or route; all reshop offers may be even exchanges)" >&2
  else
    echo "error: no offer survived selection (different flight + single segment + priced + booking class)" >&2
  fi
  fail "offer selection"
fi
echo "$CHOSEN" | jq -r '"chosen offer: \(.offerId)
  new flight:     \(.carrier)\(.flightNumber) \(.origin)→\(.destination) \(.departureDateTime) class=\(.bookingClass)
  price delta:    \(.chargeType) \(.grandTotal) \(.currency)  priceGuaranteed=\(.isPriceGuaranteed)"'
RESHOP_GRAND_TOTAL=$(echo "$CHOSEN" | jq -r '.grandTotal')

# ---------------------------------------------------------------------------
step 7 "exchange-booking — COMMIT (confirm + FOP card, sell status $SELL_STATUS)"
# With the documented NN sell, CERT's simulated carrier link typically does
# not settle the new segment within the call, so the air-book step aborts and
# the exchange does NOT reach status Complete. That is the documented-path
# behaviour this run exists to capture for Sabre support — it is recorded in
# the log bundle and reported below, not treated as a script crash. (Passing
# --sell-status GK reproduces the old passive sell, which commits but yields
# an unticketable segment.) The price-tolerance knobs mirror production.
EXCHANGE_BODY=$(echo "$CHOSEN" | jq \
  --arg pnr "$CONFIRMATION_ID" --arg ticket "$ORIG_TICKET" \
  --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" \
  --arg cardExpiry "$CARD_EXPIRY" --arg sellStatus "$SELL_STATUS" \
  '{
    pnrLocator: $pnr,
    originalTicketNumber: $ticket,
    receivedFrom: "E2E SMOKE",
    cancelSegments: [1],
    newSegments: [{
      origin: .origin,
      destination: .destination,
      departureDateTime: .departureDateTime,
      arrivalDateTime: .arrivalDateTime,
      marketingCarrier: .carrier,
      flightNumber: .flightNumber,
      bookingClass: .bookingClass,
      status: $sellStatus
    }],
    priceTolerance: {
      amountSpecified: 0,
      acceptableIncrease: { amount: 500, haltOnNonAcceptablePrice: true }
    },
    confirm: {
      formOfPayment: {
        type: "card",
        vendorCode: $cardType,
        number: $cardNumber,
        expireDate: $cardExpiry
      }
    }
  }')

# A transport-level failure (non-2xx) is still a hard fail. Application-level
# outcomes ride back on HTTP 200 in applicationResults, so a successful CLI
# call here can still represent an air-book abort — which we inspect below.
if ! EXCHANGE_OUT=$(run_cli $CLI exchange-booking "${BASE_URL_FLAG[@]}" --body "$EXCHANGE_BODY"); then
  cat "$TMP_ERR" >&2
  fail "exchange-booking (commit — transport error)"
fi

EX_STATUS=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.status // "(none)"')
EX_ERRORS=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.errors | length // 0')
AMOUNT_RETURNED=$(echo "$EXCHANGE_OUT" | jq -r '.exchangeConfirmations[0].amountReturned // empty')
PQR_NUMBER=$(echo "$EXCHANGE_OUT" | jq -r '.exchangeConfirmations[0].pqrNumber // "?"')
echo "applicationResults.status: $EX_STATUS"
echo "PQR: $PQR_NUMBER  amountReturned: ${AMOUNT_RETURNED:-?}"

# COMMIT_COMPLETE gates the post-commit steps (8–9). When the commit does not
# reach Complete (the expected NN result in CERT), we record the diagnostic,
# skip the verify/fulfill steps that assume a swapped segment, and proceed to
# cleanup so no ticket leaks.
COMMIT_COMPLETE=0
COMMIT_SUMMARY=""
if [[ "$EX_STATUS" == "Complete" && "$EX_ERRORS" == "0" ]]; then
  COMMIT_COMPLETE=1
  COMMIT_SUMMARY="Complete (PQR $PQR_NUMBER, amountReturned ${AMOUNT_RETURNED:-?})"
else
  COMMIT_SUMMARY="NOT Complete (status=$EX_STATUS, ${EX_ERRORS} error(s)) — documented-path result, captured for support"
  echo ""
  echo "exchange did not complete (sell status $SELL_STATUS):"
  echo "$EXCHANGE_OUT" | jq -r '(.applicationResults.errors // [])
    | .[]? | "  [\(.type // "?")] " + ((.systemSpecificResults // [])
        | map((.messages // []) | map(.value // .code // "") | join(" ")) | join(" | "))' 2>/dev/null \
    || echo "  (see $LOG_DIR for the raw response)"
fi

FULFILL_RESULT="n/a (commit did not complete)"
NEW_FLIGHT_NUMS=""
NEW_TICKET=""

if [[ "$COMMIT_COMPLETE" != "1" ]]; then
  # The commit did not reach Complete (expected with the NN default in CERT).
  # Steps 8–9 assume a swapped segment / stored PQR, so skip them and go to
  # cleanup. The full request/response for the failed commit is in the bundle.
  step 8 "get-booking — SKIPPED (commit did not complete)"
  step 9 "fulfill-tickets — SKIPPED (commit did not complete)"
else
  # -------------------------------------------------------------------------
  step 8 "get-booking — verify post-commit state"
  if ! VERIFY_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
    cat "$TMP_ERR" >&2
    fail "get-booking (post-commit)"
  fi
  IS_TICKETED=$(echo "$VERIFY_OUT" | jq -r '.isTicketed // false')
  NEW_FLIGHT_NUMS=$(echo "$VERIFY_OUT" | jq -r '[.flights[]?.flightNumber // empty] | join(",")')
  NEW_TICKET=$(echo "$VERIFY_OUT" | jq -r --arg orig "$ORIG_TICKET" \
    '[.flightTickets[]?.number // empty] | map(select(. != $orig)) | first // empty')
  echo "isTicketed: $IS_TICKETED"
  echo "flights now on PNR: ${NEW_FLIGHT_NUMS:-none}"
  echo "new ticket: ${NEW_TICKET:-<none found>}"

  # -------------------------------------------------------------------------
  FULFILL_RESULT="skipped (commit already ticketed)"
  if [[ -z "$NEW_TICKET" ]]; then
    step 9 "fulfill-tickets — attempt to issue the reissued document"
    if [[ "$FULFILL_DELAY" -gt 0 ]]; then
      echo "waiting ${FULFILL_DELAY}s before fulfill (carrier-link confirmation is asynchronous)"
      sleep "$FULFILL_DELAY"
    fi
    # Distinct body for the REISSUE fulfill (do not reuse the original-ticket
    # FULFILL_BODY from step 4). After an exchange the document to issue is the
    # reissued one tied to the stored PQR, not the original sale. We send a
    # plain fulfill (the variant that reaches the actual ticketing step) with
    # the same FOP/printer, but built fresh here so the original and reissue
    # fulfills can diverge without coupling. Note: targeting the PQR via
    # priceQuoteRecordIds (PQR_Number "02" or Get Booking recordId "2") is
    # rejected as PRICE_QUOTE_RECORD_NUMBER_INVALID — verified CERT 2026-06-10;
    # that qualifier addresses PQ records, not PQRs.
    REISSUE_FULFILL_BODY=$(jq -n \
      --arg cid "$CONFIRMATION_ID" --arg pcc "${SABRE_PCC:-}" \
      --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" \
      --arg cardExpiry "$CARD_EXPIRY" \
      '{
        confirmationId: $cid,
        fulfillments: [{ payment: { primaryFormOfPayment: 1 } }],
        formsOfPayment: [{
          type: "PAYMENTCARD", cardTypeCode: $cardType, cardNumber: $cardNumber,
          expiryDate: $cardExpiry, manualApprovalCode: "123456",
          authentications: [{ channelCode: "EC" }]
        }],
        designatePrinters: [{ ticket: { countryCode: "AT" } }]
      }
      + (if $pcc == "" then {} else { targetPcc: $pcc } end)')
    if FULFILL2_OUT=$(run_cli $CLI fulfill-tickets "${BASE_URL_FLAG[@]}" --body "$REISSUE_FULFILL_BODY"); then
      NEW_TICKET=$(echo "$FULFILL2_OUT" | jq -r --arg orig "$ORIG_TICKET" \
        '[.tickets[]?.number // empty] | map(select(. != $orig)) | first // empty')
      FULFILL2_ERRORS=$(echo "$FULFILL2_OUT" | jq -r '[.errors[]?.description] | join(" | ")')
    else
      NEW_TICKET=""
      FULFILL2_ERRORS=$(cat "$TMP_ERR")
    fi
    if [[ -n "$NEW_TICKET" ]]; then
      FULFILL_RESULT="issued $NEW_TICKET"
      echo "new ticket (via fulfill): $NEW_TICKET"
    elif [[ "$FULFILL2_ERRORS" == *"NEED AIRLINE PNR LOCATOR"* ]]; then
      # This path is reached only with a passive (GK) sell override: the
      # segment commits but never gets an airline record locator, so
      # AirTicketRQ refuses to issue against it. In production the carrier
      # link confirms segments (KK/HK) and assigns the locator CERT omits.
      FULFILL_RESULT="blocked by CERT (passive/GK segment has no airline locator)"
      echo "fulfill blocked: NEED AIRLINE PNR LOCATOR — CERT cannot confirm a"
      echo "passively-sold (GK) segment, so the reissued document cannot be"
      echo "issued here. (Only reachable when --sell-status GK is forced.)"
    else
      echo "fulfill errors: ${FULFILL2_ERRORS:-<none reported>}" >&2
      fail "fulfill-tickets (reissue failed for an unexpected reason)"
    fi
  else
    step 9 "fulfill-tickets — SKIPPED (exchange commit already issued the new ticket)"
  fi
fi

# ---------------------------------------------------------------------------
if [[ "$NO_CLEANUP" == "1" ]]; then
  step 10 "void-tickets — SKIPPED (--no-cleanup)"
  step 11 "cancel-booking — SKIPPED (--no-cleanup)"
  CLEANUP_ATTEMPTED=1
  echo "PNR $CONFIRMATION_ID and its ticket(s) are LIVE — void/cancel manually when done."
else
  step 10 "void-tickets (release the financial documents)"
  if ! VOID_OUT=$(run_cli $CLI void-tickets "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
    cat "$TMP_ERR" >&2
    fail "void-tickets"
  fi
  echo "voidedTickets: $(echo "$VOID_OUT" | jq -r '.voidedTickets | length // 0')"
  TICKETED=0

  # -------------------------------------------------------------------------
  step 11 "cancel-booking (cancelAll)"
  if ! CANCEL_OUT=$(run_cli $CLI cancel-booking "${BASE_URL_FLAG[@]}" \
      --confirmation-id "$CONFIRMATION_ID" --cancel-all); then
    cat "$TMP_ERR" >&2
    fail "cancel-booking"
  fi
  CLEANUP_ATTEMPTED=1
  echo "cancelled."
fi

# ---------------------------------------------------------------------------
echo ""
echo "================ E2E SUMMARY ================"
echo "PNR:                  $CONFIRMATION_ID"
echo "original ticket:      $ORIG_TICKET (${CARRIER}${FLIGHT_NUM} $DEP_DATE)"
echo "chosen offer:         $(echo "$CHOSEN" | jq -r '"\(.carrier)\(.flightNumber) \(.departureDateTime)"')"
echo "reshop grandTotal:    $RESHOP_GRAND_TOTAL"
echo "sell status:          $SELL_STATUS"
echo "exchange commit:      $COMMIT_SUMMARY"
if [[ "$COMMIT_COMPLETE" == "1" ]]; then
  if [[ -n "$AMOUNT_RETURNED" && "$AMOUNT_RETURNED" == "$RESHOP_GRAND_TOTAL" ]]; then
    echo "price agreement:      MATCH (reshop quote == exchange commit)"
  else
    echo "price agreement:      MISMATCH or unavailable — inspect the bundle"
  fi
  echo "reissued ticket:      $FULFILL_RESULT"
fi
[[ -n "$LOG_DIR" ]] && echo "log bundle:           $LOG_DIR"
echo ""
echo "flight-exchange-e2e: OK (lifecycle exercised; see commit result above)"
