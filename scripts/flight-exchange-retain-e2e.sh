#!/usr/bin/env bash
# flight-exchange-retain-e2e.sh — SELECTIVE (retainFlights) reshop smoke test.
#
# Exercises Flight Reshop's `journeys[].retainFlights` — keeping one journey of
# a round trip unchanged while reshopping the other. It books a ROUND TRIP,
# tickets it, then reshops with the OUTBOUND journey pinned via retainFlights
# (by flightItemId), and asserts every returned offer preserves the pinned
# outbound flight while still offering alternative return flights.
#
#   1. bargain-finder-max      shop a round trip (2 legs, 1 segment each)
#   2. create-booking          book the round-trip PNR (both directions)
#   3. fulfill-tickets         issue the ORIGINAL ticket (billable)
#   4. get-booking             read the outbound flight's itemId (retain key)
#   5. flight-reshop           reshop, retaining the outbound journey
#   6. assert                  every offer keeps the pinned outbound flight
#   7. void-tickets            release the financial document(s)
#   8. cancel-booking          tear the PNR down
#
# retainFlights retains an entire JOURNEY (one direction of the trip), not a
# single segment of a connection — this mirrors Sabre's canonical example
# ("retained outbound journey ... followed by a return journey"). Retention is
# keyed by `flightItemId` (read from get-booking), which the OAS RetainItem
# oneOf prefers and which requires `bookingId` in the reshop request.
#
# This ISSUES A REAL CERT TICKET. It is destructive and billable by design.
# Run it only against CERT with a test PCC/card. It does NOT commit an
# exchange — its job is to prove the retainFlights REQUEST is well-formed and
# the SHOP honours the pin. The commit/fulfill path is covered by
# flight-exchange-e2e.sh.
#
# Cleanup contract (best-effort, runs on any post-create failure):
#   1. void-tickets on the PNR (same-day void is free).
#   2. cancel-booking --cancel-all.
#
# Request/response capture: every CLI call's outbound request (via
# --debug-request) and response body is written under .local/<run-dir>/ so a
# failing run produces a complete, shareable log bundle for Sabre support.
#
# Prerequisites:
#   1. `npm run build`
#   2. .env with SABRE_CLIENT_ID / SABRE_CLIENT_SECRET / SABRE_BASE_URL
#   3. `jq` on PATH
#
# Usage:
#   scripts/flight-exchange-retain-e2e.sh --from DFW --to LAX \
#     --departure-date 2026-07-15 --return-date 2026-07-22 \
#     [--new-return-date 2026-07-23]
#
# Flags:
#   --from <iata>                 Origin IATA (required)
#   --to <iata>                   Destination IATA (required)
#   --departure-date <YYYY-MM-DD> Outbound date (required)
#   --return-date <YYYY-MM-DD>    Original return date (required)
#   --new-return-date <YYYY-MM-DD>  Reshop target for the return journey
#                                 (default: --return-date — same-day re-shop)
#   --carriers <list>             BFM carrier preference (default: AA)
#   --given-name/--surname/--phone/--email/--seed   Traveler identity
#   --card-number <pan>           FOP PAN (default: 4487971000000006)
#   --card-cvv <code>             Card security code (default: 123)
#   --card-expiry <YYYY-MM>       Card expiry (default: 2027-12)
#   --card-type <code>            Card vendor code (default: VI)
#   --retain-by <flightItemId|flightDetails>
#                                 How to identify the retained outbound flight
#                                 (default: flightItemId). `flightDetails` is
#                                 built from get-booking + booking-level
#                                 creationDate/creationTime and exercises the
#                                 OAS-optional-but-API-required field set.
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
GIVEN_NAME=""
SURNAME=""
PHONE=""
EMAIL=""
SEED=""
CARD_NUMBER="4487971000000006"
CARD_CVV="123"
CARD_EXPIRY="2027-12"
CARD_TYPE="VI"
RETAIN_BY="flightItemId"
NO_CLEANUP=0
BASE_URL=""

usage() {
  sed -n '2,70p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --departure-date) DEP_DATE="${2:-}"; shift 2 ;;
    --return-date) RET_DATE="${2:-}"; shift 2 ;;
    --new-return-date) NEW_RET_DATE="${2:-}"; shift 2 ;;
    --carriers) CARRIERS="${2:-}"; shift 2 ;;
    --given-name) GIVEN_NAME="${2:-}"; shift 2 ;;
    --surname) SURNAME="${2:-}"; shift 2 ;;
    --phone) PHONE="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --seed) SEED="${2:-}"; shift 2 ;;
    --card-number) CARD_NUMBER="${2:-}"; shift 2 ;;
    --card-cvv) CARD_CVV="${2:-}"; shift 2 ;;
    --card-expiry) CARD_EXPIRY="${2:-}"; shift 2 ;;
    --card-type) CARD_TYPE="${2:-}"; shift 2 ;;
    --retain-by) RETAIN_BY="${2:-}"; shift 2 ;;
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
if [[ "$RETAIN_BY" != "flightItemId" && "$RETAIN_BY" != "flightDetails" ]]; then
  echo "error: --retain-by must be 'flightItemId' or 'flightDetails' (got '$RETAIN_BY')" >&2
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
CURRENT_STEP="00-init"
if [[ -d .local ]]; then
  LOG_DIR=".local/exchange-retain-e2e-$(date +%Y%m%dT%H%M%S)-$$"
  mkdir -p "$LOG_DIR"
  echo "request/response log bundle: $LOG_DIR"
else
  LOG_DIR=""
  echo "note: .local/ not present — request/response logging disabled" >&2
fi

DBG=(--debug-request)

# run_cli <cli> <args...> — runs a CLI call, returns its stdout, and tees
# stdout→<step>.response and stderr→<step>.request into the log bundle. The
# Authorization header is redacted on the way to disk.
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

# Pick the first clean round trip: 2 legs (outbound + return), 1 segment each.
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
OUT_DEP=$(read_seg 0 'departure.time'); OUT_ARR=$(read_seg 0 'arrival.time')
RET_DEP=$(read_seg 1 'departure.time'); RET_ARR=$(read_seg 1 'arrival.time')
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
echo "  outbound: ${OUT_CARRIER}${OUT_FLIGHT} ${FROM}→${TO} ${DEP_DATE} ${OUT_DEP_L} class=${OUT_CLASS}  (PIN)"
echo "  return:   ${RET_CARRIER}${RET_FLIGHT} ${TO}→${FROM} ${RET_DATE} ${RET_DEP_L} class=${RET_CLASS}  (reshop)"

# ---------------------------------------------------------------------------
step 2 "create-booking (round-trip PNR — both directions)"
mk_flight() { # $1=carrier $2=flightnum $3=from $4=to $5=date $6=depTimeHHMM $7=class
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
step 4 "get-booking — read the outbound flight (retain key: $RETAIN_BY)"
if ! VERIFY_OUT=$(run_cli $CLI get-booking "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
  cat "$TMP_ERR" >&2
  fail "get-booking"
fi
# The full outbound flight object from the booking, matched by carrier+number.
OUT_FLT=$(echo "$VERIFY_OUT" | jq -c --arg c "$OUT_CARRIER" --argjson fn "$OUT_FLIGHT" \
  '[ .flights[]? | select(.airlineCode == $c and (.flightNumber == $fn)) ] | first // empty')
if [[ -z "$OUT_FLT" || "$OUT_FLT" == "null" ]]; then
  echo "error: could not find the outbound flight in get-booking" >&2
  fail "get-booking (outbound flight not found)"
fi
OUT_ITEM=$(echo "$OUT_FLT" | jq -r '.itemId // empty')
# Booking-level creation date/time — the only creation values get-booking
# exposes (there is no per-flight creation field). The flightDetails retain
# path requires creationDate/creationTime, so we probe whether the booking-
# level values satisfy the per-flight requirement.
CREATE_DATE=$(echo "$VERIFY_OUT" | jq -r '.creationDetails.creationDate // empty')
CREATE_TIME=$(echo "$VERIFY_OUT" | jq -r '.creationDetails.creationTime // empty')
echo "outbound: itemId=${OUT_ITEM:-?}  bookingCreated=${CREATE_DATE:-?} ${CREATE_TIME:-?}"

# Build the retain item per --retain-by.
if [[ "$RETAIN_BY" == "flightItemId" ]]; then
  if [[ -z "$OUT_ITEM" ]]; then
    echo "error: get-booking did not expose an itemId for the outbound flight" >&2
    fail "get-booking (missing outbound itemId)"
  fi
  RETAIN_ITEM=$(jq -n --arg item "$OUT_ITEM" '{ flightItemId: $item }')
else
  # flightDetails: assemble from the booked flight + booking-level creation.
  if [[ -z "$CREATE_DATE" || -z "$CREATE_TIME" ]]; then
    echo "error: booking-level creationDate/creationTime missing — cannot build flightDetails retain" >&2
    fail "get-booking (missing creation date/time)"
  fi
  RETAIN_ITEM=$(echo "$OUT_FLT" | jq \
    --arg cd "$CREATE_DATE" --arg ct "$CREATE_TIME" '{
      flightDetails: {
        marketingFlightNumber: .flightNumber,
        marketingAirlineCode: .airlineCode,
        operatingAirlineCode: (.operatingAirlineCode // .airlineCode),
        departureAirportCode: .fromAirportCode,
        arrivalAirportCode: .toAirportCode,
        departureDate: .departureDate,
        departureTime: (.departureTime | .[0:5]),
        arrivalDate: .arrivalDate,
        arrivalTime: (.arrivalTime | .[0:5]),
        bookingClassCode: .bookingClass,
        flightStatusCode: .flightStatusCode,
        creationDate: $cd,
        creationTime: $ct
      } }')
fi

# ---------------------------------------------------------------------------
step 5 "flight-reshop — retain outbound ${OUT_CARRIER}${OUT_FLIGHT} (by $RETAIN_BY), reshop return on $NEW_RET_DATE"
# Two journeys: journey[0] is the outbound, retained; journey[1] is the return,
# reshopped on the (possibly new) return date. Retaining requires bookingId.
RESHOP_BODY=$(jq -n \
  --arg from "$FROM" --arg to "$TO" \
  --arg depDate "$DEP_DATE" --arg retDate "$NEW_RET_DATE" \
  --arg ticket "$ORIG_TICKET" --arg bookingId "$CONFIRMATION_ID" \
  --argjson retain "$RETAIN_ITEM" \
  '{
    journeys: [
      {
        departureLocation: { cityCode: $from },
        arrivalLocation: { cityCode: $to },
        departureDate: $depDate,
        retainFlights: [ $retain ]
      },
      {
        departureLocation: { cityCode: $to },
        arrivalLocation: { cityCode: $from },
        departureDate: $retDate
      }
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
  fail "flight-reshop (no offers — cannot verify the pin)"
fi

# ---------------------------------------------------------------------------
step 6 "assert — every offer preserves the pinned outbound ${OUT_CARRIER}${OUT_FLIGHT}"
# For each offer, gather the flights across all its journeys; the pinned
# outbound flight must appear in every offer. If any offer dropped it,
# retainFlights was ignored.
ASSERT=$(echo "$RESHOP_OUT" | jq \
  --arg c "$OUT_CARRIER" --argjson fn "$OUT_FLIGHT" '
  (.flights // []) as $flights
  | (.journeys // []) as $journeys
  | [ (.offers // [])[]
      | . as $o
      | [ (.journeyRefs // [])[]
          | . as $jref
          | ($journeys[] | select(.id == $jref) | .flightRefs // [])[]
          | . as $fref
          | ($flights[] | select(.id == $fref)) ] as $offerFlights
      | {
          offerId: $o.id,
          keepsPin: ([ $offerFlights[]
            | select(.marketingAirlineCode == $c and (.marketingFlightNumber == $fn)) ] | length > 0)
        }
    ]
  | { total: length, keep: ([ .[] | select(.keepsPin) ] | length) }')
TOTAL=$(echo "$ASSERT" | jq -r '.total')
KEEP=$(echo "$ASSERT" | jq -r '.keep')
echo "offers inspected: $TOTAL   offers preserving the pin: $KEEP"
if [[ "$TOTAL" -gt 0 && "$KEEP" -eq "$TOTAL" ]]; then
  echo "PASS: all $TOTAL offers retained ${OUT_CARRIER}${OUT_FLIGHT}"
  RETAIN_RESULT="PASS ($KEEP/$TOTAL offers kept the pin)"
else
  echo "FAIL: only $KEEP of $TOTAL offers retained ${OUT_CARRIER}${OUT_FLIGHT}" >&2
  RETAIN_RESULT="FAIL ($KEEP/$TOTAL)"
  fail "retainFlights assertion (some offers dropped the pinned flight)"
fi

# ---------------------------------------------------------------------------
if [[ "$NO_CLEANUP" == "1" ]]; then
  step 7 "void-tickets — SKIPPED (--no-cleanup)"
  step 8 "cancel-booking — SKIPPED (--no-cleanup)"
  CLEANUP_ATTEMPTED=1
  echo "PNR $CONFIRMATION_ID and its ticket(s) are LIVE — void/cancel manually when done."
else
  step 7 "void-tickets (release the financial documents)"
  if ! VOID_OUT=$(run_cli $CLI void-tickets "${BASE_URL_FLAG[@]}" --confirmation-id "$CONFIRMATION_ID"); then
    cat "$TMP_ERR" >&2
    fail "void-tickets"
  fi
  echo "voidedTickets: $(echo "$VOID_OUT" | jq -r '.voidedTickets | length // 0')"
  TICKETED=0

  step 8 "cancel-booking (cancelAll)"
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
echo "================ RETAIN E2E SUMMARY ================"
echo "PNR:                  $CONFIRMATION_ID"
echo "original ticket:      $ORIG_TICKET"
echo "round trip:           ${OUT_CARRIER}${OUT_FLIGHT} ${FROM}→${TO} + ${RET_CARRIER}${RET_FLIGHT} ${TO}→${FROM}"
echo "pinned (retained):    ${OUT_CARRIER}${OUT_FLIGHT} outbound (by $RETAIN_BY)"
echo "reshopped journey:    ${TO}→${FROM} on $NEW_RET_DATE"
echo "reshop offers:        $OFFER_COUNT"
echo "retain assertion:     $RETAIN_RESULT"
[[ -n "$LOG_DIR" ]] && echo "log bundle:           $LOG_DIR"
echo ""
echo "flight-exchange-retain-e2e: OK"
