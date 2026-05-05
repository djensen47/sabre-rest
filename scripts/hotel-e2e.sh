#!/usr/bin/env bash
# hotel-e2e.sh — hotel end-to-end smoke test (STUB).
#
# The full hotel flow Sabre supports is:
#
#   hotel-search → get-hotel-avail → get-hotel-rate-info → hotel-price-check
#     → create-booking (hotel) → get-booking → cancel-booking
#
# Of those, this library currently wraps only:
#
#   * hotel-search       — property discovery (no rates, no rateKeys)
#   * hotel-price-check  — revalidates a rateKey and returns a bookingKey
#
# The missing middle steps (get-hotel-avail, get-hotel-rate-info) are the
# ones that produce the `rateKey` hotel-price-check consumes. Until those
# are wrapped, a real search → price-check chain is not possible with the
# library alone, because hotel-search does NOT return a rateKey (per the
# spec: "Availability and rates are not part of this API").
#
# This script is therefore deliberately incomplete. It establishes the
# skeleton — flag parsing, CLI invocation, pretty-printed step output —
# and documents every missing step with a TODO marker so future work can
# fill them in one at a time.
#
# The hotel create-booking / cancel-booking path also hasn't been wrapped
# yet. When it is, cleanup logic similar to booking-e2e.sh should be
# added here.
#
# ## What this script does today
#
#   Step 1: hotel-search
#           (works — returns real Sabre CERT property content)
#
#   Step 2: get-hotel-avail                          [TODO — not wrapped]
#           Would take the hotel codes from step 1 + a date range and
#           return per-property availability with first-tier rateKeys.
#
#   Step 3: get-hotel-rate-info                      [TODO — not wrapped]
#           Would take a hotel code + date range and return detailed
#           rate plans with the rateKey format hotel-price-check expects.
#           ("Which API produces the rateKey" is still an open question
#           for the human — see the README/chat for context. Likely this
#           one, based on name, but confirm against the OAS spec.)
#
#   Step 4: hotel-price-check
#           Works TODAY only when a rateKey is supplied from outside
#           (recorded response, Sabre Dev Studio sandbox, another tool,
#           etc.). With --rate-key supplied, the script exercises the
#           call; with --rate-key omitted, it is skipped with a clear
#           message.
#
#   Step 5: hotel create-booking                     [TODO — not wrapped]
#           Would take the bookingKey from step 4 plus traveler / payment
#           details and create a reservation.
#
#   Step 6: get-booking                              [works for flight
#           bookings via booking-management v1; unclear whether hotel
#           bookings land in the same envelope. Verify when step 5 is
#           wrapped.]
#
#   Step 7: cancel-booking                           [same caveat as 6]
#
# ## Prerequisites
#   1. `npm run build`
#   2. A .env file with SABRE_CLIENT_ID, SABRE_CLIENT_SECRET,
#      SABRE_BASE_URL (loaded automatically by the CLI).
#   3. `jq` on PATH.
#
# ## Usage
#   scripts/hotel-e2e.sh --ref-point 6:DFW:CODE --radius 5
#   scripts/hotel-e2e.sh --ref-point 6:DFW:CODE --radius 5 --rate-key '...opaque...'
#
# ## Flags
#   --ref-point <T:V:C>            Hotel-search reference point (default: 6:DFW:CODE)
#   --geo-code <lat,lon>           Hotel-search geoCode anchor (alternative to --ref-point)
#   --address <fields>             Hotel-search address anchor (alternative)
#   --radius <n>                   Search radius (default: 5)
#   --uom <MI|KM>                  Unit of measure (default: MI)
#   --max-results <n>              Max properties to inspect (default: 3)
#   --rate-key <key>               If supplied, runs hotel-price-check.
#                                  When omitted, that step is skipped
#                                  with a message. See header for why a
#                                  rate-key can't be derived from search.
#   --start-date <YYYY-MM-DD>      Optional stay start (passed to price-check)
#   --end-date <YYYY-MM-DD>        Optional stay end (passed to price-check)
#   --base-url <url>               Override SABRE_BASE_URL
#   -h, --help                     Show this help

set -o pipefail

CLI="node dist/cli.js"
REF_POINT="6:DFW:CODE"
GEO_CODE=""
ADDRESS=""
RADIUS="5"
UOM="MI"
MAX_RESULTS="3"
RATE_KEY=""
START_DATE=""
END_DATE=""
BASE_URL=""

usage() {
  # Reproduces the header comment block. The range matches the comment
  # span above; update it when the header grows/shrinks.
  sed -n '2,85p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref-point) REF_POINT="${2:-}"; GEO_CODE=""; ADDRESS=""; shift 2 ;;
    --geo-code) GEO_CODE="${2:-}"; REF_POINT=""; ADDRESS=""; shift 2 ;;
    --address) ADDRESS="${2:-}"; REF_POINT=""; GEO_CODE=""; shift 2 ;;
    --radius) RADIUS="${2:-}"; shift 2 ;;
    --uom) UOM="${2:-}"; shift 2 ;;
    --max-results) MAX_RESULTS="${2:-}"; shift 2 ;;
    --rate-key) RATE_KEY="${2:-}"; shift 2 ;;
    --start-date) START_DATE="${2:-}"; shift 2 ;;
    --end-date) END_DATE="${2:-}"; shift 2 ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; usage >&2; exit 2 ;;
  esac
done

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

run_cli() {
  : > "$TMP_ERR"
  "$@" 2>"$TMP_ERR"
}

fail() {
  echo "" >&2
  echo "$1 FAILED" >&2
  exit 1
}

step() {
  local n="$1" label="$2"
  echo ""
  echo "[$n] $label"
  printf '%*s\n' $(( ${#n} + ${#label} + 4 )) '' | tr ' ' '-'
}

skip() {
  local n="$1" label="$2" reason="$3"
  echo ""
  echo "[$n] $label  (SKIPPED)"
  printf '%*s\n' $(( ${#n} + ${#label} + 14 )) '' | tr ' ' '-'
  echo "reason: $reason"
}

# ---------------------------------------------------------------------------
# Step 1 — hotel-search
# ---------------------------------------------------------------------------
step 1 "hotel-search"

ANCHOR_FLAGS=()
if [[ -n "$REF_POINT" ]]; then
  ANCHOR_FLAGS=(--ref-point "$REF_POINT")
elif [[ -n "$GEO_CODE" ]]; then
  ANCHOR_FLAGS=(--geo-code "$GEO_CODE")
elif [[ -n "$ADDRESS" ]]; then
  ANCHOR_FLAGS=(--address "$ADDRESS")
fi

SEARCH_FILE=$(mktemp)
trap 'rm -f "$TMP_ERR" "$SEARCH_FILE"' EXIT

if ! run_cli $CLI hotel-search "${BASE_URL_FLAG[@]}" \
  "${ANCHOR_FLAGS[@]}" \
  --radius "$RADIUS" \
  --uom "$UOM" \
  --max-results "$MAX_RESULTS" \
  --format json >"$SEARCH_FILE"; then
  cat "$TMP_ERR" >&2
  fail "hotel-search"
fi

HOTEL_COUNT=$(jq '.hotels | length' "$SEARCH_FILE")
echo "Found $HOTEL_COUNT hotel(s):"
jq -r '.hotels[] | "  - \(.code)  \(.name // "(no name)")"' "$SEARCH_FILE"

if (( HOTEL_COUNT == 0 )); then
  fail "hotel-search returned 0 properties"
fi

FIRST_HOTEL_CODE=$(jq -r '.hotels[0].code' "$SEARCH_FILE")

# ---------------------------------------------------------------------------
# Step 2 — get-hotel-avail (TODO)
# ---------------------------------------------------------------------------
skip 2 "get-hotel-avail" "service not yet wrapped — see docs/specifications/ for the spec to add"
# TODO: Once get-hotel-avail is wrapped:
#   1. Drop the OAS spec at docs/specifications/get-hotel-avail.yml
#   2. Run the add-api skill to scaffold src/services/get-hotel-avail-v<n>/
#   3. Add a `get-hotel-avail` CLI subcommand
#   4. Replace this skip block with a real call that takes FIRST_HOTEL_CODE
#      plus START_DATE / END_DATE and extracts the first rateKey
#
# Open question: does get-hotel-avail or get-hotel-rate-info produce the
# rateKey format that hotel-price-check's `RateInfoRef.RateKey` expects?
# Verify against the OAS specs before committing to which is step 2 vs 3.

# ---------------------------------------------------------------------------
# Step 3 — get-hotel-rate-info (TODO)
# ---------------------------------------------------------------------------
skip 3 "get-hotel-rate-info" "service not yet wrapped"
# TODO: Same pattern as step 2. Likely candidate for producing the
# rateKey that feeds step 4. Confirm with the OAS spec.

# ---------------------------------------------------------------------------
# Step 4 — hotel-price-check
# ---------------------------------------------------------------------------
if [[ -z "$RATE_KEY" ]]; then
  skip 4 "hotel-price-check" \
    "no --rate-key supplied. Pass --rate-key from a recorded response, sandbox, or once steps 2/3 are wrapped."
else
  step 4 "hotel-price-check"

  STAY_FLAGS=()
  if [[ -n "$START_DATE" && -n "$END_DATE" ]]; then
    STAY_FLAGS=(--start-date "$START_DATE" --end-date "$END_DATE")
  elif [[ -n "$START_DATE" || -n "$END_DATE" ]]; then
    fail "hotel-price-check: --start-date and --end-date must be supplied together"
  fi

  PRICE_FILE=$(mktemp)
  trap 'rm -f "$TMP_ERR" "$SEARCH_FILE" "$PRICE_FILE"' EXIT

  if ! run_cli $CLI hotel-price-check "${BASE_URL_FLAG[@]}" \
    --rate-key "$RATE_KEY" \
    "${STAY_FLAGS[@]}" \
    --format json >"$PRICE_FILE"; then
    cat "$TMP_ERR" >&2
    fail "hotel-price-check"
  fi

  BOOKING_KEY=$(jq -r '.bookingKey // empty' "$PRICE_FILE")
  PRICE_CHANGE=$(jq -r '.priceChange // empty' "$PRICE_FILE")
  WARNINGS=$(jq -r '.applicationResults.warnings // [] | length' "$PRICE_FILE")
  ERRORS=$(jq -r '.applicationResults.errors // [] | length' "$PRICE_FILE")

  if [[ -n "$BOOKING_KEY" ]]; then
    echo "bookingKey:   $BOOKING_KEY"
    echo "priceChange:  $PRICE_CHANGE"
    echo "warnings:     $WARNINGS"
    echo "errors:       $ERRORS"
  else
    echo "no bookingKey returned (diagnostics-only envelope)"
    echo "warnings:     $WARNINGS"
    echo "errors:       $ERRORS"
    jq '.applicationResults' "$PRICE_FILE"
  fi
fi

# ---------------------------------------------------------------------------
# Step 5 — hotel create-booking (TODO)
# ---------------------------------------------------------------------------
skip 5 "hotel create-booking" "hotel booking not yet wrapped"
# TODO: Wrap the hotel booking endpoint and chain it here, consuming the
# bookingKey from step 4. Add cleanup (cancel-booking) via a trap once
# wrapped — see scripts/booking-e2e.sh for the pattern.

# ---------------------------------------------------------------------------
# Step 6 — get-booking (TODO)
# ---------------------------------------------------------------------------
skip 6 "get-booking (verify hotel)" "depends on step 5; also verify booking-management v1 handles hotel PNRs"

# ---------------------------------------------------------------------------
# Step 7 — cancel-booking (TODO)
# ---------------------------------------------------------------------------
skip 7 "cancel-booking" "depends on step 5"

echo ""
echo "hotel-e2e (partial) complete."
echo "Wrapped steps: 1 (hotel-search)$([[ -n "$RATE_KEY" ]] && echo ", 4 (hotel-price-check)")."
echo "Missing steps: 2 (get-hotel-avail), 3 (get-hotel-rate-info), 5-7 (hotel booking flow)."
