#!/usr/bin/env bash
# hotel-e2e.sh — hotel end-to-end smoke test.
#
# The CSL orchestrated hotel flow is:
#
#   hotel-search → get-hotel-avail → get-hotel-details → hotel-price-check
#     → create-booking (hotel) → get-booking → cancel-booking
#
# This library currently wraps:
#
#   * hotel-search      — property discovery (no rates)
#   * get-hotel-avail   — lead rates, produces rateKeys
#   * get-hotel-details — per-property rate grid + descriptive content
#                         (canonical "Refine" step between Avail and Price Check)
#   * hotel-price-check — revalidates a rateKey, produces bookingKey
#
# The `get-hotel-rate-info` service is also wrapped but intentionally not
# exercised here — it's off the orchestrated booking path and currently
# returns empty-`Complete` envelopes from CERT (see PR #83 for the
# precise reproducer). Test it directly via the CLI when needed.
#
#   * book-hotel              — CreatePassengerNameRecord v2.5.0, hotel
#                               path. Consumes the bookingKey from
#                               price-check, produces a Sabre PNR locator.
#
# Missing (not yet wrapped):
#
#   * hotel get-booking       — unclear whether booking-management v1
#                               handles hotel PNRs; verify after first
#                               successful book-hotel run in CERT.
#   * hotel cancel-booking    — same caveat. Until wired, PNRs created
#                               by this script must be cancelled manually
#                               in CERT (the script prints the locator
#                               loudly at the end).
#
# ## What this script does today
#
#   Step 1: hotel-search      — runs against Sabre CERT, picks the first hotel
#   Step 2: get-hotel-avail   — runs against Sabre CERT, extracts a rateKey
#                               from the first hotel's ConvertedRateInfo
#                               (or falls back to RateInfo)
#   Step 3: get-hotel-details — runs against Sabre CERT using the rateKey
#                               from step 2, surfaces room count + rate-plan
#                               count so the rate grid is visible
#   Step 4: hotel-price-check — runs against Sabre CERT using the rateKey
#                               from step 2 (or a --rate-key override)
#   Step 5: book-hotel        — runs against Sabre CERT using the bookingKey
#                               from step 4; requires SABRE_TEST_CARD_* env
#                               vars for PCI-sensitive card fields. Prints
#                               the PNR locator loudly for manual cancel.
#   Step 6-7:                   [TODO — hotel get-booking / cancel-booking
#                               not yet verified against booking-management
#                               v1; manual cleanup required until they are]
#
# ## Prerequisites
#   1. `npm run build`
#   2. A .env file with SABRE_CLIENT_ID, SABRE_CLIENT_SECRET,
#      SABRE_BASE_URL (loaded automatically by the CLI). SABRE_PCC is
#      sourced explicitly by this script and forwarded to every step via
#      --pcc, because the CLI does not fall back to env.pcc on hotel
#      commands. Without a PCC, Sabre CSL routes rate-info requests
#      through a default that commonly returns empty envelopes.
#   3. `jq` on PATH.
#
# Step 5 uses Sabre's published CERT test card (4444333322221111) with
# a future expiry — not a real PAN. Hardcoded in the script because
# CERT test data does not need PCI treatment.
#
# ## Usage
#   scripts/hotel-e2e.sh --ref-point 6:BWI:CODE --start-date 2026-06-20 --end-date 2026-06-22
#   scripts/hotel-e2e.sh --ref-point 6:BWI:CODE --rate-key '...opaque...'
#   scripts/hotel-e2e.sh --geo-code 32.758,-97.08 --radius 2
#
# ## Flags
#   --ref-point <T:V:C>            Anchor (default: 6:BWI:CODE)
#   --geo-code <lat,lon>           Alternative anchor
#   --address <fields>             Alternative anchor
#   --radius <n>                   Search radius (default: 5)
#   --uom <MI|KM>                  Unit of measure (default: MI)
#   --max-results <n>              Properties per page (default: 3)
#   --currency-code <ISO>          Currency for get-hotel-avail (default: USD)
#   --start-date <YYYY-MM-DD>      Stay start (default: 30 days out)
#   --end-date <YYYY-MM-DD>        Stay end   (default: start + 2 days)
#   --best-only <1-4>              get-hotel-avail BestOnly (default: 1)
#   --rate-key <key>               Skip step 2's key extraction and supply
#                                  a key directly to step 4.
#   --base-url <url>               Override SABRE_BASE_URL
#   -h, --help                     Show this help

set -o pipefail

CLI="node dist/cli.js"
REF_POINT="6:BWI:CODE"
GEO_CODE=""
ADDRESS=""
RADIUS="5"
UOM="MI"
MAX_RESULTS="3"
CURRENCY_CODE="USD"
START_DATE=""
END_DATE=""
BEST_ONLY="1"
RATE_KEY_OVERRIDE=""
BASE_URL=""

usage() {
  # Reproduces the header comment block. Update the line range when the
  # header grows or shrinks.
  sed -n '2,88p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref-point) REF_POINT="${2:-}"; GEO_CODE=""; ADDRESS=""; shift 2 ;;
    --geo-code) GEO_CODE="${2:-}"; REF_POINT=""; ADDRESS=""; shift 2 ;;
    --address) ADDRESS="${2:-}"; REF_POINT=""; GEO_CODE=""; shift 2 ;;
    --radius) RADIUS="${2:-}"; shift 2 ;;
    --uom) UOM="${2:-}"; shift 2 ;;
    --max-results) MAX_RESULTS="${2:-}"; shift 2 ;;
    --currency-code) CURRENCY_CODE="${2:-}"; shift 2 ;;
    --start-date) START_DATE="${2:-}"; shift 2 ;;
    --end-date) END_DATE="${2:-}"; shift 2 ;;
    --best-only) BEST_ONLY="${2:-}"; shift 2 ;;
    --rate-key) RATE_KEY_OVERRIDE="${2:-}"; shift 2 ;;
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

# Source .env so we can read SABRE_PCC. The CLI already reads
# SABRE_CLIENT_ID / SABRE_CLIENT_SECRET / SABRE_BASE_URL itself, but the
# hotel commands do not fall back to env.pcc, so the script forwards PCC
# on every call that accepts it.
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PCC_FLAG=()
if [[ -n "${SABRE_PCC:-}" ]]; then
  PCC_FLAG=(--pcc "$SABRE_PCC")
else
  echo "warning: SABRE_PCC not set — hotel steps will run without --pcc." >&2
  echo "         Sabre CSL typically returns empty envelopes without a PCC." >&2
fi

# Default stay window: 30 days from today, 2-night stay. macOS and GNU date
# differ on `-d` / `-v`; probe once at startup.
if [[ -z "$START_DATE" ]]; then
  if date -v+30d +%Y-%m-%d >/dev/null 2>&1; then
    START_DATE=$(date -v+30d +%Y-%m-%d)
    END_DATE=${END_DATE:-$(date -v+32d +%Y-%m-%d)}
  else
    START_DATE=$(date -d '+30 days' +%Y-%m-%d)
    END_DATE=${END_DATE:-$(date -d '+32 days' +%Y-%m-%d)}
  fi
fi
if [[ -z "$END_DATE" ]]; then
  echo "error: --end-date required when --start-date is supplied" >&2
  exit 2
fi

BASE_URL_FLAG=()
[[ -n "$BASE_URL" ]] && BASE_URL_FLAG=(--base-url "$BASE_URL")

TMP_ERR=$(mktemp)
SEARCH_FILE=$(mktemp)
AVAIL_FILE=$(mktemp)
DETAILS_FILE=$(mktemp)
PRICE_FILE=$(mktemp)
trap 'rm -f "$TMP_ERR" "$SEARCH_FILE" "$AVAIL_FILE" "$DETAILS_FILE" "$PRICE_FILE"' EXIT

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

ANCHOR_FLAGS=()
if [[ -n "$REF_POINT" ]]; then
  ANCHOR_FLAGS=(--ref-point "$REF_POINT")
elif [[ -n "$GEO_CODE" ]]; then
  ANCHOR_FLAGS=(--geo-code "$GEO_CODE")
elif [[ -n "$ADDRESS" ]]; then
  ANCHOR_FLAGS=(--address "$ADDRESS")
fi

# ---------------------------------------------------------------------------
# Step 1 — hotel-search
# ---------------------------------------------------------------------------
step 1 "hotel-search"

if ! run_cli $CLI hotel-search "${BASE_URL_FLAG[@]}" "${PCC_FLAG[@]}" \
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
(( HOTEL_COUNT == 0 )) && fail "hotel-search returned 0 properties"

# ---------------------------------------------------------------------------
# Step 2 — get-hotel-avail
# ---------------------------------------------------------------------------
RATE_KEY="$RATE_KEY_OVERRIDE"

if [[ -n "$RATE_KEY" ]]; then
  skip 2 "get-hotel-avail" "using --rate-key override from the command line"
else
  step 2 "get-hotel-avail ($START_DATE → $END_DATE in $CURRENCY_CODE)"

  if ! run_cli $CLI get-hotel-avail "${BASE_URL_FLAG[@]}" "${PCC_FLAG[@]}" \
    "${ANCHOR_FLAGS[@]}" \
    --radius "$RADIUS" \
    --uom "$UOM" \
    --currency-code "$CURRENCY_CODE" \
    --start-date "$START_DATE" \
    --end-date "$END_DATE" \
    --best-only "$BEST_ONLY" \
    --max-results "$MAX_RESULTS" \
    --format json >"$AVAIL_FILE"; then
    cat "$TMP_ERR" >&2
    fail "get-hotel-avail"
  fi

  AVAIL_HOTEL_COUNT=$(jq '.hotels | length' "$AVAIL_FILE")
  echo "Avail returned $AVAIL_HOTEL_COUNT hotel(s)."

  # Pull the first rateKey we can find, preferring ConvertedRateInfo (which
  # the OAS marks rateKey required). Fall back to RateInfo. Also scan rate
  # plans inside rooms in case the top-level rate lists were empty.
  RATE_KEY=$(jq -r '
    (.hotels[]? | (
      .rateInfo.convertedRateInfo[]?.rateKey,
      .rateInfo.rateInfo[]?.rateKey,
      .rateInfo.rooms[]?.ratePlans[]?.rateKey
    )) // empty
    | select(. != null and . != "")
  ' "$AVAIL_FILE" | head -n 1)

  if [[ -z "$RATE_KEY" ]]; then
    # Still useful to surface any diagnostics Sabre returned.
    jq '.applicationResults // empty' "$AVAIL_FILE"
    fail "get-hotel-avail returned no rateKey"
  fi
  echo "rateKey (first):  ${RATE_KEY:0:64}..."
fi

# ---------------------------------------------------------------------------
# Step 3 — get-hotel-details
# ---------------------------------------------------------------------------
step 3 "get-hotel-details"

if ! run_cli $CLI get-hotel-details "${BASE_URL_FLAG[@]}" "${PCC_FLAG[@]}" \
  --rate-key "$RATE_KEY" \
  --with-property-info \
  --with-location \
  --with-amenities \
  --format json >"$DETAILS_FILE"; then
  cat "$TMP_ERR" >&2
  fail "get-hotel-details"
fi

DETAILS_HOTEL=$(jq -r '.hotel.info.code // empty' "$DETAILS_FILE")
DETAILS_ROOM_COUNT=$(jq -r '(.hotel.rooms // []) | length' "$DETAILS_FILE")
DETAILS_RATE_PLAN_COUNT=$(jq -r '
  [(.hotel.rooms // [])[]?.ratePlans | length] | add // 0
' "$DETAILS_FILE")
DETAILS_HAS_DESCRIPTIVE=$(jq -r '
  if .hotel.descriptiveInfo != null then "yes" else "no" end
' "$DETAILS_FILE")
if [[ -n "$DETAILS_HOTEL" ]]; then
  echo "details hotel:        $DETAILS_HOTEL"
  echo "details room count:   $DETAILS_ROOM_COUNT"
  echo "details rate plans:   $DETAILS_RATE_PLAN_COUNT"
  echo "details descriptive:  $DETAILS_HAS_DESCRIPTIVE"
else
  echo "no hotel returned (diagnostics-only envelope)"
  jq '.applicationResults // empty' "$DETAILS_FILE"
fi

# ---------------------------------------------------------------------------
# Step 4 — hotel-price-check
# ---------------------------------------------------------------------------
step 4 "hotel-price-check"

if ! run_cli $CLI hotel-price-check "${BASE_URL_FLAG[@]}" "${PCC_FLAG[@]}" \
  --rate-key "$RATE_KEY" \
  --start-date "$START_DATE" \
  --end-date "$END_DATE" \
  --format json >"$PRICE_FILE"; then
  cat "$TMP_ERR" >&2
  fail "hotel-price-check"
fi

BOOKING_KEY=$(jq -r '.bookingKey // empty' "$PRICE_FILE")
PRICE_CHANGE=$(jq -r '.priceChange // empty' "$PRICE_FILE")
WARNINGS=$(jq -r '.applicationResults.warnings // [] | length' "$PRICE_FILE")
ERRORS=$(jq -r '.applicationResults.errors // [] | length' "$PRICE_FILE")

if [[ -n "$BOOKING_KEY" ]]; then
  echo "bookingKey:   ${BOOKING_KEY:0:64}..."
  echo "priceChange:  $PRICE_CHANGE"
  echo "warnings:     $WARNINGS"
  echo "errors:       $ERRORS"
else
  echo "no bookingKey returned (diagnostics-only envelope)"
  echo "warnings:     $WARNINGS"
  echo "errors:       $ERRORS"
  jq '.applicationResults' "$PRICE_FILE"
fi

# ---------------------------------------------------------------------------
# Step 5 — book-hotel
# ---------------------------------------------------------------------------
PNR_LOCATOR=""

if [[ -z "$BOOKING_KEY" ]]; then
  skip 5 "book-hotel" "price-check did not return a bookingKey"
else
  step 5 "book-hotel"

  BOOK_FILE=$(mktemp)
  trap 'rm -f "$TMP_ERR" "$SEARCH_FILE" "$AVAIL_FILE" "$DETAILS_FILE" "$PRICE_FILE" "$BOOK_FILE"' EXIT

  # Sabre's published CERT test card (see docs/specifications/create-pnr/
  # sample-request-hotel-gds.json). Not a real PAN. Expiry must be in the
  # future so Sabre doesn't reject on date validation — the Postman
  # sample ships with 3/2022 which has since expired.
  TEST_CARD_NUMBER="4444333322221111"
  TEST_CARD_CODE="VI"
  TEST_CARD_EXPIRY_MONTH="12"
  TEST_CARD_EXPIRY_YEAR="2030"
  TEST_CARD_CVC="123"

  # Agency / billing addresses are derived from Sabre's published
  # sample bodies (docs/specifications/create-pnr/sample-request-hotel-gds.json).
  if ! run_cli $CLI book-hotel "${BASE_URL_FLAG[@]}" \
    --booking-key "$BOOKING_KEY" \
    --first-name Test --last-name Booking --phone 817-555-1212 \
    --email test@sabre.com \
    --card-number "$TEST_CARD_NUMBER" \
    --card-code "$TEST_CARD_CODE" \
    --card-expiry-month "$TEST_CARD_EXPIRY_MONTH" \
    --card-expiry-year "$TEST_CARD_EXPIRY_YEAR" \
    --card-cvc "$TEST_CARD_CVC" \
    --agency-name 'Really Trustworthy Agency' \
    --agency-iata 12345678 \
    --pcc "${SABRE_PCC:-TM61}" \
    --agency-street-number '3150 SABRE DRIVE' \
    --agency-address-line 'SABRE TRAVEL' \
    --agency-city SOUTHLAKE --agency-state TX --agency-country US \
    --agency-postal-code 76092 \
    --billing-address-line 'Wadowicka 6' \
    --billing-city Krakow --billing-country PL --billing-postal-code 30-415 \
    --format json >"$BOOK_FILE"; then
    cat "$TMP_ERR" >&2
    fail "book-hotel"
  fi

  PNR_LOCATOR=$(jq -r '.pnrLocator // empty' "$BOOK_FILE")
  AR_STATUS=$(jq -r '.applicationResults.status // empty' "$BOOK_FILE")
  AR_ERRORS=$(jq -r '.applicationResults.errors // [] | length' "$BOOK_FILE")
  AR_WARNINGS=$(jq -r '.applicationResults.warnings // [] | length' "$BOOK_FILE")

  if [[ -n "$PNR_LOCATOR" ]]; then
    echo "pnrLocator:     $PNR_LOCATOR"
    echo "status:         $AR_STATUS"
    echo "errors:         $AR_ERRORS"
    echo "warnings:       $AR_WARNINGS"
  else
    echo "no PNR locator returned (diagnostics-only envelope)"
    echo "status:         $AR_STATUS"
    jq '.applicationResults // empty' "$BOOK_FILE"
  fi
fi

# ---------------------------------------------------------------------------
# Step 6 — get-booking (TODO)
# ---------------------------------------------------------------------------
skip 6 "get-booking (verify hotel)" "booking-management v1 hotel-PNR support not yet verified"

# ---------------------------------------------------------------------------
# Step 7 — cancel-booking (TODO)
# ---------------------------------------------------------------------------
skip 7 "cancel-booking" "hotel PNR cancel path not yet wrapped"

echo ""
echo "hotel-e2e complete."
echo "Wrapped steps: 1 (hotel-search), 2 (get-hotel-avail), 3 (get-hotel-details),"
echo "               4 (hotel-price-check), 5 (book-hotel)."
echo "Missing steps: 6 (get-booking), 7 (cancel-booking)."
if [[ -n "$PNR_LOCATOR" ]]; then
  echo ""
  echo "============================================================"
  echo "  LIVE PNR IN CERT — cancel manually: $PNR_LOCATOR"
  echo "============================================================"
fi
