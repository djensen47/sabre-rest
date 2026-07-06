#!/usr/bin/env bash
# flight-exchange-onejourney-commit-e2e.sh — ONE-JOURNEY change, COMMITTED.
#
# Books a round trip, tickets it, then changes one (or both) journeys and
# COMMITS the exchange, asserting the kept journey survives. `--change`
# selects which journey moves:
#   return   — keep outbound, change return  (chronologically safe; default)
#   outbound — keep return,   change outbound (exposes the out-of-order case —
#              the new outbound is appended AFTER the retained return, so the
#              PNR can fail ticketing with "CHK DATE/TIME CONTINUITY OF FLTS"
#              unless the PCC's Automatic Segment Arrange TJR flag is enabled)
#   both     — change both journeys (no retainFlights)
#
# This is the gap the other tests left: flight-exchange-retain-e2e.sh shops a
# selective change; flight-exchange-e2e.sh commits but only a single-journey
# one-way. Neither committed a change to one direction of a round trip — and
# neither covered the outbound-only ordering hazard.
#
# Why it matters: retainFlights only influences the SHOP. The COMMIT (Exchange
# Booking) is driven by its own cancelSegments / newSegments. To change one
# journey you must cancel + sell ONLY the changed flights — the offer flags
# each flight `isBookingRequired` (true = changed, false = keep). A commit that
# ignores that flag cancels/rebooks everything → "you can only change if you
# change both journeys." This test asserts the kept journey survives the commit.
#
#   1. bargain-finder-max      shop a round trip (2 legs, 1 segment each)
#   2. create-booking          book the round-trip PNR (both directions)
#   3. fulfill-tickets         issue the ORIGINAL ticket (billable)
#   4. get-booking             read segment numbers + the kept flight's itemId
#   5. flight-reshop           reshop retaining the kept journey
#   6. select offer            pick an offer that changes only the chosen journey
#   7. exchange-booking        COMMIT: cancel the changed segment(s), sell the new flight(s)
#   8. get-booking             ASSERT kept journey unchanged + changed journey swapped
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
#   --change <return|outbound|both>  Which journey to change (default: return)
#   --new-departure-date <YYYY-MM-DD>  Reshop target for the outbound
#                                 (default: --departure-date). Used when
#                                 --change is outbound or both.
#   --new-return-date <YYYY-MM-DD>  Reshop target for the return
#                                 (default: --return-date). Used when --change
#                                 is return or both.
#   --commit-strategy <full|minimal>  How to build the exchange commit
#                                 (default: full).
#                                 full    = cancel ALL segments + re-sell the
#                                           whole itinerary in chronological
#                                           order (works today, no entitlement).
#                                 minimal = cancel only the changed segment(s) +
#                                           sell only the new flight(s); leaner,
#                                           but appends out of order and fails
#                                           ticketing (CHK DATE/TIME CONTINUITY)
#                                           unless the PCC has the Automatic
#                                           Segment Arrange TJR flag enabled.
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
NEW_DEP_DATE=""
NEW_RET_DATE=""
CHANGE="return"
COMMIT_STRATEGY="full"
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
  sed -n '2,88p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --departure-date) DEP_DATE="${2:-}"; shift 2 ;;
    --return-date) RET_DATE="${2:-}"; shift 2 ;;
    --new-departure-date) NEW_DEP_DATE="${2:-}"; shift 2 ;;
    --new-return-date) NEW_RET_DATE="${2:-}"; shift 2 ;;
    --change) CHANGE="${2:-}"; shift 2 ;;
    --commit-strategy) COMMIT_STRATEGY="${2:-}"; shift 2 ;;
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
NEW_DEP_DATE="${NEW_DEP_DATE:-$DEP_DATE}"
NEW_RET_DATE="${NEW_RET_DATE:-$RET_DATE}"
case "$CHANGE" in
  outbound|return|both) ;;
  *) echo "error: --change must be 'outbound', 'return', or 'both' (got '$CHANGE')" >&2; exit 2 ;;
esac
case "$COMMIT_STRATEGY" in
  full|minimal) ;;
  *) echo "error: --commit-strategy must be 'full' or 'minimal' (got '$COMMIT_STRATEGY')" >&2; exit 2 ;;
esac

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
# Map --change to which journey is KEPT (retained in reshop) vs CHANGED. The
# retained journey is pinned by flightItemId; the changed journey is reshopped
# on its (possibly new) date and committed.
#   change=return   → keep outbound, change return   (chronological-safe)
#   change=outbound → keep return,   change outbound  (the out-of-order case)
#   change=both     → change both journeys (no retainFlights)
if [[ "$CHANGE" == "return" ]]; then
  KEEP_C="$OUT_CARRIER"; KEEP_FN="$OUT_FLIGHT"
  CHG_C="$RET_CARRIER";  CHG_FN="$RET_FLIGHT"
elif [[ "$CHANGE" == "outbound" ]]; then
  KEEP_C="$RET_CARRIER"; KEEP_FN="$RET_FLIGHT"
  CHG_C="$OUT_CARRIER";  CHG_FN="$OUT_FLIGHT"
fi

step 4 "get-booking — read segment numbers + retained-flight itemId"
if ! VERIFY_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "get-booking"
fi
# Reservation segment number = 1-based position of a flight among .flights[].
seg_no() { echo "$VERIFY_OUT" | jq -r --arg c "$1" --argjson fn "$2" \
  '[ .flights[] | .airlineCode + ((.flightNumber|tostring)) ]
   | index(($c + ($fn|tostring))) // empty | if . == null then "" else . + 1 end'; }
item_id() { echo "$VERIFY_OUT" | jq -r --arg c "$1" --argjson fn "$2" \
  '[ .flights[]? | select(.airlineCode == $c and (.flightNumber == $fn)) | .itemId ] | first // empty'; }

if [[ "$CHANGE" == "both" ]]; then
  OUT_SEG_NO=$(seg_no "$OUT_CARRIER" "$OUT_FLIGHT")
  RET_SEG_NO=$(seg_no "$RET_CARRIER" "$RET_FLIGHT")
  echo "segment numbers: outbound=#${OUT_SEG_NO:-?}  return=#${RET_SEG_NO:-?}  (changing BOTH)"
  if [[ -z "$OUT_SEG_NO" || -z "$RET_SEG_NO" ]]; then
    echo "error: could not resolve both segment numbers" >&2; fail "get-booking (segment resolution)"; fi
else
  KEEP_ITEM=$(item_id "$KEEP_C" "$KEEP_FN")
  CHG_SEG_NO=$(seg_no "$CHG_C" "$CHG_FN")
  echo "retain ${KEEP_C}${KEEP_FN} (itemId ${KEEP_ITEM:-?})   change ${CHG_C}${CHG_FN} (segment #${CHG_SEG_NO:-?})"
  if [[ -z "$KEEP_ITEM" || -z "$CHG_SEG_NO" ]]; then
    echo "error: could not resolve retained itemId and/or changed segment number" >&2
    fail "get-booking (segment resolution)"; fi
fi

# ---------------------------------------------------------------------------
step 5 "flight-reshop — change=$CHANGE"
# Build the two journeys. The kept journey carries retainFlights (by itemId);
# the changed journey is reshopped on its new date. For change=both, neither is
# retained. Outbound journey is FROM→TO; return journey is TO→FROM.
RESHOP_BODY=$(jq -n \
  --arg from "$FROM" --arg to "$TO" \
  --arg depDate "$NEW_DEP_DATE" --arg retDate "$NEW_RET_DATE" \
  --arg ticket "$ORIG_TICKET" --arg bookingId "$CONFIRMATION_ID" \
  --arg change "$CHANGE" --arg keepItem "${KEEP_ITEM:-}" \
  --arg origDep "$DEP_DATE" --arg origRet "$RET_DATE" \
  '
  ({ departureLocation: { airportCode: $from }, arrivalLocation: { airportCode: $to } }
    + (if $change == "outbound" then { departureDate: $depDate }
       else { departureDate: $origDep, retainFlights: [ { flightItemId: $keepItem } ] } end)) as $outJ
  | ({ departureLocation: { airportCode: $to }, arrivalLocation: { airportCode: $from } }
    + (if $change == "return" then { departureDate: $retDate }
       else { departureDate: $origRet, retainFlights: [ { flightItemId: $keepItem } ] } end)) as $retJ
  | ({ departureLocation: { airportCode: $from }, arrivalLocation: { airportCode: $to }, departureDate: $depDate }) as $outJBoth
  | ({ departureLocation: { airportCode: $to }, arrivalLocation: { airportCode: $from }, departureDate: $retDate }) as $retJBoth
  | {
      journeys: (if $change == "both" then [ $outJBoth, $retJBoth ] else [ $outJ, $retJ ] end),
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
step 6 "select offer — change=$CHANGE (capture the FULL itinerary, kept + changed)"
# Per Sabre's canonical exchangeBooking example, the commit cancels ALL existing
# segments and re-sells the WHOLE itinerary in order — including retained flights.
# retainFlights only shapes the shop; it does NOT mean "omit that flight from the
# sell". So we capture every flight in the offer (regardless of isBookingRequired),
# with its booking class, and validate it changed the journey we asked for.
EXPECT_CHANGED=2; [[ "$CHANGE" == "both" ]] && EXPECT_CHANGED=2 || EXPECT_CHANGED=1
# Flight numbers of the ORIGINAL flights being replaced — the chosen offer's
# new flight(s) must differ from these, otherwise the swap is a no-op and the
# itinerary assertion can't tell old from new.
if [[ "$CHANGE" == "both" ]]; then
  ORIG_CHANGED_FNS="[$OUT_FLIGHT,$RET_FLIGHT]"
else
  ORIG_CHANGED_FNS="[$CHG_FN]"
fi
CHOSEN=$(echo "$RESHOP_OUT" | jq \
  --argjson expectChanged "$EXPECT_CHANGED" \
  --argjson origChangedFns "$ORIG_CHANGED_FNS" \
  --arg from "$FROM" --arg to "$TO" '
  (.flights // []) as $flights | (.journeys // []) as $journeys
  | [ (.offers // [])[] | . as $o
      | [ ($o.journeyRefs // [])[] | . as $jref
          | ($journeys[] | select(.id == $jref) | .flightRefs // [])[] | . as $fref
          | ($flights[] | select(.id == $fref)) ] as $of
      # A reissue is bound to the originally ticketed board/off points. Reject
      # any offer with a flight on a city-pair other than FROM↔TO — reshop by
      # city code can return multi-airport-city siblings (e.g. ONT for LAX),
      # and committing one yields AirTicketRQ error 114 (FLIGHT NUMBER DOES NOT
      # MATCH ITINERARY IN AIRLINE SYSTEM). (Reshop is also queried by
      # airportCode now; this guard stands even if an alternate airport slips in.)
      | select([ $of[]
          | select(([.departureAirportCode, .arrivalAirportCode] | sort) != ([$from, $to] | sort)) ] | length == 0)
      | ([ $of[] | select(.isBookingRequired == true) ]) as $changed
      | select(($changed | length) == $expectChanged)
      # Every changed flight must be a DIFFERENT flight number than the original
      # it replaces — reject offers that "change" to the same flight.
      | select([ $changed[] | select(.marketingFlightNumber as $fn | $origChangedFns | index($fn)) ] | length == 0)
      # Build a sell entry for EVERY flight in the offer; resolve booking class
      # from the fare segmentDetails (guard against a null class below).
      | [ $of[] | . as $fl
          | ([ $o.items[0].fares[]?.fareComponents[]?.segmentDetails[]?
               | select(.flightRef == $fl.id) ] | first) as $sd
          | { carrier: $fl.marketingAirlineCode, flightNumber: ($fl.marketingFlightNumber|tostring),
              origin: $fl.departureAirportCode, destination: $fl.arrivalAirportCode,
              departureDateTime: "\($fl.departureDate)T\($fl.departureTime):00",
              arrivalDateTime: "\($fl.arrivalDate)T\($fl.arrivalTime):00",
              bookingClass: $sd.bookingClassCode,
              isBookingRequired: $fl.isBookingRequired } ] as $segs
      | select([ $segs[] | select(.bookingClass == null) ] | length == 0)
      | { offerId: $o.id, grandTotal: $o.totalPriceDifference.grandTotal,
          chargeType: $o.totalPriceDifference.type,
          # All flights, sorted chronologically by departure — the order the
          # commit must sell them in to avoid CHK DATE/TIME CONTINUITY.
          segments: ($segs | sort_by(.departureDateTime)) }
    ] | first // empty')
if [[ -z "$CHOSEN" ]]; then
  echo "error: no offer matched the change=$CHANGE selection criteria" >&2
  fail "offer selection"
fi
echo "$CHOSEN" | jq -r '"chosen offer: \(.offerId)  (\(.chargeType) \(.grandTotal))",
  (.segments[] | "  sell: \(.carrier)\(.flightNumber) \(.origin)→\(.destination) \(.departureDateTime) class=\(.bookingClass) \(if .isBookingRequired then "(new)" else "(retained)" end)")'

# ---------------------------------------------------------------------------
# Two commit strategies (--commit-strategy):
#   full    — cancel ALL booked segments, re-sell the WHOLE offer itinerary in
#             chronological order (retained + changed). Matches Sabre's canonical
#             example; works today with no extra entitlement. DEFAULT.
#   minimal — cancel ONLY the changed segment(s), sell ONLY the new flight(s).
#             Leaner, but the new segment is appended (not inserted), so the PNR
#             can go out of chronological order → ticketing fails CHK DATE/TIME
#             CONTINUITY unless the PCC's Automatic Segment Arrange TJR flag is
#             enabled. Kept here to demonstrate the entitlement gap.
if [[ "$COMMIT_STRATEGY" == "full" ]]; then
  CANCEL_JSON=$(echo "$VERIFY_OUT" | jq -c '[ range(1; (.flights | length) + 1) ]')
  SELL_FILTER='.segments'   # all flights, already chronologically sorted
else
  if [[ "$CHANGE" == "both" ]]; then
    CANCEL_JSON="[$OUT_SEG_NO,$RET_SEG_NO]"
  else
    CANCEL_JSON="[$CHG_SEG_NO]"
  fi
  SELL_FILTER='[ .segments[] | select(.isBookingRequired) ]'   # changed flights only
fi

step 7 "exchange-booking — COMMIT [$COMMIT_STRATEGY]: cancel $CANCEL_JSON, sell $([ "$COMMIT_STRATEGY" = full ] && echo 'full itinerary' || echo 'changed only')"
EXCHANGE_BODY=$(echo "$CHOSEN" | jq \
  --arg pnr "$CONFIRMATION_ID" --arg ticket "$ORIG_TICKET" \
  --argjson cancel "$CANCEL_JSON" --arg sellStatus "$SELL_STATUS" \
  --arg cardType "$CARD_TYPE" --arg cardNumber "$CARD_NUMBER" --arg cardExpiry "$CARD_EXPIRY" \
  "{
    pnrLocator: \$pnr,
    originalTicketNumber: \$ticket,
    receivedFrom: \"E2E ONEJRNY\",
    cancelSegments: \$cancel,
    newSegments: [ ($SELL_FILTER)[] | {
      origin: .origin, destination: .destination,
      departureDateTime: .departureDateTime, arrivalDateTime: .arrivalDateTime,
      marketingCarrier: .carrier, flightNumber: .flightNumber,
      bookingClass: .bookingClass, status: \$sellStatus
    } ],
    bargainFinder: true,
    priceTolerance: { amountSpecified: 0,
      acceptableIncrease: { amount: 1000, haltOnNonAcceptablePrice: true } },
    confirm: { formOfPayment: {
      type: \"card\", vendorCode: \$cardType, number: \$cardNumber, expireDate: \$cardExpiry } }
  }")

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
  echo "$EXCHANGE_OUT" | jq -r '(.applicationResults.errors // [])[]?.systemSpecificResults[]?.messages[]? | "  \(.code // "?"): \(.value // "")"' >&2
  echo "commit did not reach Complete (change=$CHANGE, sell status $SELL_STATUS) — see $LOG_DIR" >&2
fi

# ---------------------------------------------------------------------------
step 8 "get-booking — ASSERT only the changed journey moved"
ASSERT_RESULT="n/a (commit not complete)"
if [[ "$COMMIT_COMPLETE" == "1" ]]; then
  if ! POST_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
    cat "$TMP_ERR" >&2
    fail "get-booking (post-commit)"
  fi
  echo "post-commit flights: $(echo "$POST_OUT" | jq -rc '[.flights[]?.flightNumber]')"
  present() { echo "$POST_OUT" | jq -r --arg c "$1" --argjson fn "$2" \
    '[ .flights[]? | select(.airlineCode == $c and (.flightNumber == $fn)) ] | length'; }
  ASSERT_OK=1
  if [[ "$CHANGE" == "both" ]]; then
    # Both originals gone; both new (isBookingRequired) flights present.
    [[ "$(present "$OUT_CARRIER" "$OUT_FLIGHT")" -eq 0 ]] || ASSERT_OK=0
    [[ "$(present "$RET_CARRIER" "$RET_FLIGHT")" -eq 0 ]] || ASSERT_OK=0
    for fn in $(echo "$CHOSEN" | jq -r '.segments[] | select(.isBookingRequired) | .flightNumber'); do
      [[ "$(echo "$POST_OUT" | jq -r --argjson fn "$fn" '[.flights[]?|select(.flightNumber==$fn)]|length')" -ge 1 ]] || ASSERT_OK=0
    done
    [[ "$ASSERT_OK" == "1" ]] && ASSERT_RESULT="PASS (both journeys changed)"
  else
    # Kept flight still present; changed original gone; new changed flight present.
    KEPT_THERE=$(present "$KEEP_C" "$KEEP_FN")
    CHG_GONE=$(present "$CHG_C" "$CHG_FN")
    NEW_FN=$(echo "$CHOSEN" | jq -r '.segments[] | select(.isBookingRequired) | .flightNumber' | head -1)
    NEW_THERE=$(echo "$POST_OUT" | jq -r --argjson fn "$NEW_FN" '[.flights[]?|select(.flightNumber==$fn)]|length')
    echo "  kept ${KEEP_C}${KEEP_FN} present: $([[ "$KEPT_THERE" -ge 1 ]] && echo yes || echo NO)"
    echo "  changed ${CHG_C}${CHG_FN} gone:   $([[ "$CHG_GONE" -eq 0 ]] && echo yes || echo NO)"
    echo "  new ${NEW_FN} present:            $([[ "$NEW_THERE" -ge 1 ]] && echo yes || echo NO)"
    [[ "$KEPT_THERE" -ge 1 && "$CHG_GONE" -eq 0 && "$NEW_THERE" -ge 1 ]] || ASSERT_OK=0
    [[ "$ASSERT_OK" == "1" ]] && ASSERT_RESULT="PASS (kept ${KEEP_C}${KEEP_FN}, changed $CHANGE)"
  fi
  if [[ "$ASSERT_OK" == "1" ]]; then
    echo "PASS: itinerary in the expected change=$CHANGE state"
  else
    echo "FAIL: itinerary not in the expected change=$CHANGE state" >&2
    ASSERT_RESULT="FAIL"
    fail "change=$CHANGE assertion"
  fi
else
  step 8 "get-booking — SKIPPED (commit not complete)"
fi

# ---------------------------------------------------------------------------
NEW_TICKET=""
FULFILL_RESULT="skipped (commit not complete)"
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
      FULFILL2_ERRORS=$(echo "$FULFILL2_OUT" | jq -r '[.errors[]?.description] | join(" | ")')
    else
      NEW_TICKET=""
      FULFILL2_ERRORS=$(cat "$TMP_ERR")
    fi
    if [[ -n "$NEW_TICKET" ]]; then
      FULFILL_RESULT="issued $NEW_TICKET"
      echo "reissued ticket: $NEW_TICKET"
    elif [[ "$FULFILL2_ERRORS" == *"NEED AIRLINE PNR LOCATOR"* ]]; then
      # Only reachable with a passive (GK) sell override: the segment commits
      # but never gets an airline record locator, so AirTicketRQ refuses to
      # issue against it. In production the carrier link confirms segments
      # (KK/HK) and assigns the locator CERT omits. Tolerated, mirroring
      # flight-exchange-e2e.sh.
      FULFILL_RESULT="blocked by CERT (passive/GK segment has no airline locator)"
      echo "fulfill blocked: NEED AIRLINE PNR LOCATOR — CERT cannot confirm a"
      echo "passively-sold (GK) segment, so the reissued document cannot be"
      echo "issued here. (Only reachable when --sell-status GK is forced.)"
    else
      # Any other ticketing failure (e.g. AirTicketLLSRQ 114, FLIGHT NUMBER
      # DOES NOT MATCH ITINERARY IN AIRLINE SYSTEM) is a genuine failure: the
      # exchange committed but the reissued document cannot be issued. Do not
      # report OK. Cleanup voids the original ticket and cancels the PNR.
      echo "fulfill errors: ${FULFILL2_ERRORS:-<none reported>}" >&2
      fail "fulfill-tickets (reissue failed for an unexpected reason)"
    fi
  else
    FULFILL_RESULT="issued $NEW_TICKET (by commit)"
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
echo "changed journey:      $CHANGE"
echo "commit strategy:      $COMMIT_STRATEGY"
echo "exchange commit:      $EX_STATUS (PQR $PQR_NUMBER)"
echo "itinerary assertion:  $ASSERT_RESULT"
echo "reissued ticket:      $FULFILL_RESULT"
[[ -n "$LOG_DIR" ]] && echo "log bundle:           $LOG_DIR"
echo ""
echo "flight-exchange-onejourney-commit-e2e: OK"
