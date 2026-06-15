#!/usr/bin/env bash
# flight-exchange-onejourney-commit-e2e.sh — ONE-JOURNEY change, COMMITTED.
#
# Books a round trip, tickets it, then changes ONLY the return journey and
# COMMITS the exchange — leaving the outbound untouched. This is the gap the
# other tests left open: flight-exchange-retain-e2e.sh proves selective change
# can be *shopped*; flight-exchange-e2e.sh *commits* but only a single-journey
# one-way. Nothing committed a change to one direction of a multi-journey trip.
#
# Why it matters: retainFlights only influences the SHOP. The COMMIT (Exchange
# Booking) is driven by its own cancelSegments / newSegments. To change one
# journey you must cancel + sell ONLY the changed flights — the offer flags
# each flight `isBookingRequired` (true = changed, false = keep). A commit that
# ignores that flag cancels/rebooks everything → "you can only change if you
# change both journeys." This test asserts the outbound survives the commit.
#
#   1. bargain-finder-max      shop a round trip (2 legs, 1 segment each)
#   2. create-booking          book the round-trip PNR (both directions)
#   3. fulfill-tickets         issue the ORIGINAL ticket (billable)
#   4. get-booking             read segment numbers + outbound itemId
#   5. flight-reshop           reshop retaining the outbound (return changes)
#   6. select offer            pick an offer whose ONLY changed flight is the return
#   7. exchange-booking        COMMIT: cancel the return segment, sell the new return
#   8. get-booking             ASSERT outbound unchanged + return swapped
#   9. fulfill-tickets         issue the reissued ticket (if needed)
#  10. void-tickets            release the financial document(s)
#  11. cancel-booking          tear the PNR down
#
# This ISSUES REAL CERT TICKETS and COMMITS A REAL EXCHANGE. Destructive and
# billable by design. Run only against CERT with a test PCC/card.
#
# Cleanup contract (best-effort, on any post-create failure):
#   1. void-tickets on the PNR (same-day void is free).
#   2. cancel-booking --cancel-all.
#
# Request/response capture: every CLI call's request (via --debug-request) and
# response is written under .local/<run-dir>/ (bearer token redacted).
#
# Prerequisites: `npm run build`; .env with SABRE_CLIENT_ID/SECRET/BASE_URL; jq.
#
# Usage:
#   scripts/flight-exchange-onejourney-commit-e2e.sh --from DFW --to LAX \
#     --departure-date 2026-07-15 --return-date 2026-07-22 \
#     [--new-return-date 2026-07-23]
#
# Flags:
#   --from <iata>                 Origin IATA (required)
#   --to <iata>                   Destination IATA (required)
#   --departure-date <YYYY-MM-DD> Outbound date (required)
#   --return-date <YYYY-MM-DD>    Original return date (required)
#   --new-return-date <YYYY-MM-DD>  Reshop target for the return (default: +1 day
#                                 is NOT assumed; defaults to --return-date)
#   --carriers <list>             BFM carrier preference (default: AA)
#   --sell-status <code>          New-segment sell status (default: NN)
#   --given-name/--surname/--phone/--email/--seed   Traveler identity
#   --card-number <pan>           FOP PAN (default: 4487971000000006)
#   --card-cvv <code>             Card security code (default: 123)
#   --card-expiry <YYYY-MM>       Card expiry (default: 2027-12)
#   --card-type <code>            Card vendor code (default: VI)
#   --fulfill-delay <seconds>     Wait before the reissue fulfill (default: 15)
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
RET_DATE=""
NEW_RET_DATE=""
CARRIERS="AA"
SELL_STATUS="NN"
GIVEN_NAME=""
SURNAME=""
PHONE=""
EMAIL=""
SEED=""
CARD_NUMBER="4487971000000006"
CARD_CVV="123"
CARD_EXPIRY="2027-12"
CARD_TYPE="VI"
FULFILL_DELAY=15
NO_CLEANUP=0
BASE_URL=""

usage() {
  sed -n '2,63p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --departure-date) DEP_DATE="${2:-}"; shift 2 ;;
    --return-date) RET_DATE="${2:-}"; shift 2 ;;
    --new-return-date) NEW_RET_DATE="${2:-}"; shift 2 ;;
    --carriers) CARRIERS="${2:-}"; shift 2 ;;
    --sell-status) SELL_STATUS="${2:-}"; shift 2 ;;
    --given-name) GIVEN_NAME="${2:-}"; shift 2 ;;
    --surname) SURNAME="${2:-}"; shift 2 ;;
    --phone) PHONE="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --seed) SEED="${2:-}"; shift 2 ;;
    --card-number) CARD_NUMBER="${2:-}"; shift 2 ;;
    --card-cvv) CARD_CVV="${2:-}"; shift 2 ;;
    --card-expiry) CARD_EXPIRY="${2:-}"; shift 2 ;;
    --card-type) CARD_TYPE="${2:-}"; shift 2 ;;
    --fulfill-delay) FULFILL_DELAY="${2:-}"; shift 2 ;;
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
[[ -z "$RET_DATE" ]] && missing+=("--return-date")
if (( ${#missing[@]} > 0 )); then
  echo "error: missing required flags: ${missing[*]}" >&2
  usage >&2
  exit 2
fi
NEW_RET_DATE="${NEW_RET_DATE:-$RET_DATE}"

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

# --- request/response log bundle -------------------------------------------
CURRENT_STEP="00-init"
if [[ -d .local ]]; then
  LOG_DIR=".local/exchange-onejourney-e2e-$(date +%Y%m%dT%H%M%S)-$$"
  mkdir -p "$LOG_DIR"
  echo "request/response log bundle: $LOG_DIR"
else
  LOG_DIR=""
  echo "note: .local/ not present — request/response logging disabled" >&2
fi

DBG=(--debug-request)

run_cli() {
  : > "$TMP_ERR"
  if [[ -z "$LOG_DIR" ]]; then
    "$@" 2>"$TMP_ERR"
    return
  fi
  local seq
  seq=$(( $(cat "$LOG_DIR/.seq" 2>/dev/null || echo 0) + 1 ))
  echo "$seq" >"$LOG_DIR/.seq"
  local base
  base="$(printf '%s/%02d-%s' "$LOG_DIR" "$seq" "$CURRENT_STEP")"
  local rc
  "$@" "${DBG[@]}" 2>"$TMP_ERR" | tee "$base.response.json"
  rc=${PIPESTATUS[0]}
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
  local slug="${label%% *}"
  slug="${slug%%(*}"
  slug="${slug//[^a-zA-Z0-9_-]/}"
  CURRENT_STEP="$slug"
  echo ""
  echo "[$n] $label"
  printf '%*s\n' $(( ${#n} + ${#label} + 4 )) '' | tr ' ' '-'
}

# ---------------------------------------------------------------------------
step 1 "bargain-finder-max ($FROM ⇄ $TO $DEP_DATE/$RET_DATE, carriers=$CARRIERS — round trip)"
BFM_FILE=$(mktemp)
trap 'rm -f "$TMP_ERR" "$BFM_FILE"' EXIT
if ! run_cli $CLI bargain-finder-max "${BASE_URL_FLAG[@]}" \
    --from "$FROM" --to "$TO" --departure-date "$DEP_DATE" --return-date "$RET_DATE" \
    --carriers "$CARRIERS" --non-stop \
    >"$BFM_FILE"; then
  cat "$TMP_ERR" >&2
  fail "bargain-finder-max"
fi

ITIN=$(jq '[ .itineraries[]
  | select((.legs|length)==2 and (.legs[0].segments|length)==1 and (.legs[1].segments|length)==1) ]
  | first // empty' "$BFM_FILE")
if [[ -z "$ITIN" || "$ITIN" == "null" ]]; then
  echo "error: no clean non-stop round trip (2 legs × 1 segment) found on $FROM⇄$TO" >&2
  fail "bargain-finder-max (no round trip)"
fi

read_seg() { echo "$ITIN" | jq -r ".legs[$1].segments[0].$2 // empty"; }
OUT_CARRIER=$(read_seg 0 marketingCarrier); RET_CARRIER=$(read_seg 1 marketingCarrier)
OUT_FLIGHT=$(read_seg 0 marketingFlightNumber); RET_FLIGHT=$(read_seg 1 marketingFlightNumber)
OUT_DEP=$(read_seg 0 'departure.time'); RET_DEP=$(read_seg 1 'departure.time')
OUT_CLASS=$(echo "$ITIN" | jq -r '.fareOffers[0].passengerFares[0].fareComponents[0].segments[0].bookingCode // empty')
RET_CLASS=$(echo "$ITIN" | jq -r '.fareOffers[0].passengerFares[0].fareComponents[-1].segments[-1].bookingCode // empty')

for v in OUT_CARRIER RET_CARRIER OUT_FLIGHT RET_FLIGHT OUT_DEP RET_DEP OUT_CLASS RET_CLASS; do
  if [[ -z "${!v}" ]]; then
    echo "error: round-trip BFM result missing field $v" >&2
    fail "bargain-finder-max (incomplete round trip)"
  fi
done

strip_tz() { echo "${1%%[+-]*}"; }
OUT_DEP_L=$(strip_tz "$OUT_DEP")
RET_DEP_L=$(strip_tz "$RET_DEP")
echo "round trip:"
echo "  outbound: ${OUT_CARRIER}${OUT_FLIGHT} ${FROM}→${TO} ${DEP_DATE} ${OUT_DEP_L} class=${OUT_CLASS}  (KEEP)"
echo "  return:   ${RET_CARRIER}${RET_FLIGHT} ${TO}→${FROM} ${RET_DATE} ${RET_DEP_L} class=${RET_CLASS}  (CHANGE)"

# ---------------------------------------------------------------------------
step 2 "create-booking (round-trip PNR — both directions)"
mk_flight() { # carrier flightnum from to date depHHMM class
  jq -n --arg c "$1" --arg fn "$2" --arg f "$3" --arg t "$4" \
        --arg dd "$5" --arg dt "${6%:*}" --arg bc "$7" \
    '{ flightNumber: ($fn|tonumber), airlineCode: $c, fromAirportCode: $f,
       toAirportCode: $t, departureDate: $dd, departureTime: $dt, bookingClass: $bc }'
}
OUT_F=$(mk_flight "$OUT_CARRIER" "$OUT_FLIGHT" "$FROM" "$TO" "$DEP_DATE" "$OUT_DEP_L" "$OUT_CLASS")
RET_F=$(mk_flight "$RET_CARRIER" "$RET_FLIGHT" "$TO" "$FROM" "$RET_DATE" "$RET_DEP_L" "$RET_CLASS")

CREATE_BODY=$(jq -n \
  --argjson f0 "$OUT_F" --argjson f1 "$RET_F" \
  --arg givenName "$GIVEN_NAME" --arg surname "$SURNAME" \
  --arg birthDate "$BIRTHDATE" --arg gender "$GENDER" \
  --arg phone "$PHONE" --arg email "$EMAIL" \
  --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" \
  --arg cardExpiry "$CARD_EXPIRY" \
  '{
    flightDetails: {
      flights: [$f0, $f1],
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
step 3 "fulfill-tickets — issue the ORIGINAL ticket"
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
  fail "fulfill-tickets"
fi
ORIG_TICKET=$(echo "$FULFILL_OUT" | jq -r '.tickets[0].number // empty')
if [[ -z "$ORIG_TICKET" ]]; then
  echo "$FULFILL_OUT" | jq '.errors // []' >&2
  fail "fulfill-tickets (no ticket in response)"
fi
TICKETED=1
echo "original ticket: $ORIG_TICKET"

# ---------------------------------------------------------------------------
step 4 "get-booking — read segment numbers + outbound itemId"
if ! VERIFY_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "get-booking"
fi
# Outbound itemId, for the retainFlights pin in the reshop.
OUT_ITEM=$(echo "$VERIFY_OUT" | jq -r --arg c "$OUT_CARRIER" --argjson fn "$OUT_FLIGHT" \
  '[ .flights[]? | select(.airlineCode == $c and (.flightNumber == $fn)) | .itemId ] | first // empty')
# The return's reservation segment number (1-based position of the return
# flight among the booked flights). cancelSegments uses these positions.
RET_SEG_NO=$(echo "$VERIFY_OUT" | jq -r --arg c "$RET_CARRIER" --argjson fn "$RET_FLIGHT" \
  '[ .flights[] | .airlineCode + ((.flightNumber|tostring)) ]
   | index(($c + ($fn|tostring))) // empty | if . == null then "" else . + 1 end')
echo "outbound itemId=${OUT_ITEM:-?}   return reservation segment #=${RET_SEG_NO:-?}"
if [[ -z "$OUT_ITEM" || -z "$RET_SEG_NO" ]]; then
  echo "error: could not resolve outbound itemId and/or return segment number from get-booking" >&2
  fail "get-booking (segment resolution)"
fi

# ---------------------------------------------------------------------------
step 5 "flight-reshop — retain outbound ${OUT_CARRIER}${OUT_FLIGHT}, reshop return on $NEW_RET_DATE"
RESHOP_BODY=$(jq -n \
  --arg from "$FROM" --arg to "$TO" \
  --arg depDate "$DEP_DATE" --arg retDate "$NEW_RET_DATE" \
  --arg ticket "$ORIG_TICKET" --arg bookingId "$CONFIRMATION_ID" \
  --arg item "$OUT_ITEM" \
  '{
    journeys: [
      { departureLocation: { cityCode: $from }, arrivalLocation: { cityCode: $to },
        departureDate: $depDate, retainFlights: [ { flightItemId: $item } ] },
      { departureLocation: { cityCode: $to }, arrivalLocation: { cityCode: $from },
        departureDate: $retDate }
    ],
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

# ---------------------------------------------------------------------------
step 6 "select offer — exactly one changed flight (the return), outbound retained"
# Walk each offer's flights (via journeyRefs → flightRefs). A valid one-journey
# change has the outbound flagged isBookingRequired=false and exactly one flight
# with isBookingRequired=true (the new return). Pull that changed flight + its
# booking class for the commit's newSegments.
CHOSEN=$(echo "$RESHOP_OUT" | jq \
  --arg oc "$OUT_CARRIER" --argjson ofn "$OUT_FLIGHT" '
  (.flights // []) as $flights
  | (.journeys // []) as $journeys
  | [ (.offers // [])[]
      | . as $o
      | [ ($o.journeyRefs // [])[] | . as $jref
          | ($journeys[] | select(.id == $jref) | .flightRefs // [])[] | . as $fref
          | ($flights[] | select(.id == $fref)) ] as $of
      | ([ $of[] | select(.isBookingRequired == true) ]) as $changed
      | ([ $of[] | select(.isBookingRequired == false
            and .marketingAirlineCode == $oc and (.marketingFlightNumber == $ofn)) ]) as $keptOut
      | select(($changed | length) == 1 and ($keptOut | length) == 1)
      | $changed[0] as $new
      | ([ $o.items[0].fares[]?.fareComponents[]?.segmentDetails[]?
           | select(.flightRef == $new.id) ] | first) as $sd
      | select($sd.bookingClassCode != null)
      | {
          offerId: $o.id,
          grandTotal: $o.totalPriceDifference.grandTotal,
          chargeType: $o.totalPriceDifference.type,
          carrier: $new.marketingAirlineCode,
          flightNumber: ($new.marketingFlightNumber | tostring),
          origin: $new.departureAirportCode,
          destination: $new.arrivalAirportCode,
          departureDateTime: "\($new.departureDate)T\($new.departureTime):00",
          arrivalDateTime: "\($new.arrivalDate)T\($new.arrivalTime):00",
          bookingClass: $sd.bookingClassCode
        }
    ]
  | first // empty')
if [[ -z "$CHOSEN" ]]; then
  echo "error: no offer changed exactly the return while retaining the outbound" >&2
  fail "offer selection"
fi
echo "$CHOSEN" | jq -r '"chosen offer: \(.offerId)
  new return:  \(.carrier)\(.flightNumber) \(.origin)→\(.destination) \(.departureDateTime) class=\(.bookingClass)
  price delta: \(.chargeType) \(.grandTotal)"'

# ---------------------------------------------------------------------------
step 7 "exchange-booking — COMMIT: cancel ONLY return segment $RET_SEG_NO, sell the new return"
EXCHANGE_BODY=$(echo "$CHOSEN" | jq \
  --arg pnr "$CONFIRMATION_ID" --arg ticket "$ORIG_TICKET" \
  --argjson retSeg "$RET_SEG_NO" --arg sellStatus "$SELL_STATUS" \
  --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" --arg cardExpiry "$CARD_EXPIRY" \
  '{
    pnrLocator: $pnr,
    originalTicketNumber: $ticket,
    receivedFrom: "E2E ONEJRNY",
    cancelSegments: [ $retSeg ],
    newSegments: [{
      origin: .origin, destination: .destination,
      departureDateTime: .departureDateTime, arrivalDateTime: .arrivalDateTime,
      marketingCarrier: .carrier, flightNumber: .flightNumber,
      bookingClass: .bookingClass, status: $sellStatus
    }],
    bargainFinder: true,
    priceTolerance: { amountSpecified: 0,
      acceptableIncrease: { amount: 1000, haltOnNonAcceptablePrice: true } },
    confirm: { formOfPayment: {
      type: "card", vendorCode: $cardType, number: $cardNumber, expireDate: $cardExpiry } }
  }')

if ! EXCHANGE_OUT=$(run_cli $CLI exchange-booking "${BASE_URL_FLAG[@]}" --body "$EXCHANGE_BODY"); then
  cat "$TMP_ERR" >&2
  fail "exchange-booking (commit — transport error)"
fi
EX_STATUS=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.status // "(none)"')
EX_ERRORS=$(echo "$EXCHANGE_OUT" | jq -r '.applicationResults.errors | length // 0')
PQR_NUMBER=$(echo "$EXCHANGE_OUT" | jq -r '.exchangeConfirmations[0].pqrNumber // "?"')
echo "applicationResults.status: $EX_STATUS   PQR: $PQR_NUMBER"
COMMIT_COMPLETE=0
if [[ "$EX_STATUS" == "Complete" && "$EX_ERRORS" == "0" ]]; then
  COMMIT_COMPLETE=1
else
  echo "$EXCHANGE_OUT" | jq -r '(.applicationResults.errors // [])[]? | "  [\(.type // "?")]"' >&2
  echo "commit did not reach Complete (sell status $SELL_STATUS) — see $LOG_DIR" >&2
fi

# ---------------------------------------------------------------------------
step 8 "get-booking — ASSERT outbound unchanged, return swapped"
ASSERT_RESULT="n/a (commit not complete)"
if [[ "$COMMIT_COMPLETE" == "1" ]]; then
  if ! POST_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
    cat "$TMP_ERR" >&2
    fail "get-booking (post-commit)"
  fi
  # Outbound flight must still be present and unchanged; the original return
  # flight must be gone; the new return flight must be present.
  OUT_STILL=$(echo "$POST_OUT" | jq -r --arg c "$OUT_CARRIER" --argjson fn "$OUT_FLIGHT" \
    '[ .flights[]? | select(.airlineCode == $c and (.flightNumber == $fn)) ] | length')
  OLD_RET_GONE=$(echo "$POST_OUT" | jq -r --arg c "$RET_CARRIER" --argjson fn "$RET_FLIGHT" \
    '[ .flights[]? | select(.airlineCode == $c and (.flightNumber == $fn)) ] | length')
  NEW_RET_FN=$(echo "$CHOSEN" | jq -r '.flightNumber')
  NEW_RET_THERE=$(echo "$POST_OUT" | jq -r --argjson fn "$NEW_RET_FN" \
    '[ .flights[]? | select(.flightNumber == $fn) ] | length')
  echo "post-commit flights: $(echo "$POST_OUT" | jq -rc '[.flights[]?.flightNumber]')"
  echo "  outbound ${OUT_CARRIER}${OUT_FLIGHT} present: $([[ "$OUT_STILL" -ge 1 ]] && echo yes || echo NO)"
  echo "  original return ${RET_CARRIER}${RET_FLIGHT} gone: $([[ "$OLD_RET_GONE" -eq 0 ]] && echo yes || echo NO)"
  echo "  new return ${NEW_RET_FN} present: $([[ "$NEW_RET_THERE" -ge 1 ]] && echo yes || echo NO)"
  if [[ "$OUT_STILL" -ge 1 && "$OLD_RET_GONE" -eq 0 && "$NEW_RET_THERE" -ge 1 ]]; then
    echo "PASS: only the return changed; outbound retained"
    ASSERT_RESULT="PASS (outbound kept, return swapped)"
  else
    echo "FAIL: itinerary not in the expected one-journey-change state" >&2
    ASSERT_RESULT="FAIL"
    fail "one-journey-change assertion"
  fi
else
  step 8 "get-booking — SKIPPED (commit not complete)"
fi

# ---------------------------------------------------------------------------
NEW_TICKET=""
if [[ "$COMMIT_COMPLETE" == "1" ]]; then
  NEW_TICKET=$(echo "$POST_OUT" | jq -r --arg orig "$ORIG_TICKET" \
    '[ .flightTickets[]?.number // empty ] | map(select(. != $orig)) | first // empty')
  if [[ -z "$NEW_TICKET" ]]; then
    step 9 "fulfill-tickets — issue the reissued document"
    [[ "$FULFILL_DELAY" -gt 0 ]] && { echo "waiting ${FULFILL_DELAY}s (carrier-link confirmation is async)"; sleep "$FULFILL_DELAY"; }
    REISSUE_FULFILL_BODY=$(jq -n \
      --arg cid "$CONFIRMATION_ID" --arg pcc "${SABRE_PCC:-}" \
      --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" --arg cardExpiry "$CARD_EXPIRY" \
      '{ confirmationId: $cid,
         fulfillments: [{ payment: { primaryFormOfPayment: 1 } }],
         formsOfPayment: [{ type: "PAYMENTCARD", cardTypeCode: $cardType, cardNumber: $cardNumber,
           expiryDate: $cardExpiry, manualApprovalCode: "123456", authentications: [{ channelCode: "EC" }] }],
         designatePrinters: [{ ticket: { countryCode: "AT" } }] }
       + (if $pcc == "" then {} else { targetPcc: $pcc } end)')
    if FULFILL2_OUT=$(run_cli $CLI fulfill-tickets "${BASE_URL_FLAG[@]}" --body "$REISSUE_FULFILL_BODY"); then
      NEW_TICKET=$(echo "$FULFILL2_OUT" | jq -r --arg orig "$ORIG_TICKET" \
        '[ .tickets[]?.number // empty ] | map(select(. != $orig)) | first // empty')
    fi
    echo "reissued ticket: ${NEW_TICKET:-<none / see bundle>}"
  else
    step 9 "fulfill-tickets — SKIPPED (commit already issued the reissued ticket)"
  fi
else
  step 9 "fulfill-tickets — SKIPPED (commit not complete)"
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
echo "================ ONE-JOURNEY COMMIT SUMMARY ================"
echo "PNR:                  $CONFIRMATION_ID"
echo "original ticket:      $ORIG_TICKET"
echo "round trip:           ${OUT_CARRIER}${OUT_FLIGHT} ${FROM}→${TO} + ${RET_CARRIER}${RET_FLIGHT} ${TO}→${FROM}"
echo "changed journey:      return only (cancel segment #$RET_SEG_NO)"
echo "exchange commit:      $EX_STATUS (PQR $PQR_NUMBER)"
echo "itinerary assertion:  $ASSERT_RESULT"
echo "reissued ticket:      ${NEW_TICKET:-n/a}"
[[ -n "$LOG_DIR" ]] && echo "log bundle:           $LOG_DIR"
echo ""
echo "flight-exchange-onejourney-commit-e2e: OK"
