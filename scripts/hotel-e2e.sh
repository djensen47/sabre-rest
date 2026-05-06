#!/usr/bin/env bash
# hotel-e2e.sh — hotel end-to-end smoke test.
#
# The full hotel flow Sabre supports is:
#
#   hotel-search → get-hotel-avail → get-hotel-rate-info → hotel-price-check
#     → create-booking (hotel) → get-booking → cancel-booking
#
# This library currently wraps:
#
#   * hotel-search        — property discovery (no rates)
#   * get-hotel-avail     — lead rates, produces rateKeys
#   * get-hotel-rate-info — per-property rate drill-down from a rateKey
#   * hotel-price-check   — revalidates a rateKey, produces bookingKey
#
# Missing (not yet wrapped):
#
#   * hotel create-booking   — consumes the bookingKey from price-check
#   * hotel get-booking      — unclear whether booking-management v1 handles
#                              hotel PNRs; verify when create-booking lands
#   * hotel cancel-booking   — same caveat
#
# ## What this script does today
#
#   Step 1: hotel-search      — runs against Sabre CERT, picks the first hotel
#   Step 2: get-hotel-avail   — runs against Sabre CERT, extracts a rateKey
#                               from the first hotel's ConvertedRateInfo
#                               (or falls back to RateInfo)
#   Step 3: get-hotel-rate-info — runs against Sabre CERT using the rateKey
#                                 from step 2, surfaces the hotel code
#   Step 4: hotel-price-check — runs against Sabre CERT using the rateKey
#                               from step 2 (or a --rate-key override)
#   Step 5-7:                   [TODO — not wrapped; see booking-e2e.sh for
#                               the cleanup pattern when hotel booking lands]
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
# ## Usage
#   scripts/hotel-e2e.sh --ref-point 6:DFW:CODE --start-date 2026-06-20 --end-date 2026-06-22
#   scripts/hotel-e2e.sh --ref-point 6:DFW:CODE --rate-key '...opaque...'
#   scripts/hotel-e2e.sh --geo-code 32.758,-97.08 --radius 2
#
# ## Flags
#   --ref-point <T:V:C>            Anchor (default: 6:DFW:CODE)
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
REF_POINT="6:DFW:CODE"
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
  sed -n '2,64p' "$0" | sed 's/^# \{0,1\}//'
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
RATE_INFO_FILE=$(mktemp)
PRICE_FILE=$(mktemp)
trap 'rm -f "$TMP_ERR" "$SEARCH_FILE" "$AVAIL_FILE" "$RATE_INFO_FILE" "$PRICE_FILE"' EXIT

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
# Step 3 — get-hotel-rate-info
# ---------------------------------------------------------------------------
step 3 "get-hotel-rate-info"

if ! run_cli $CLI get-hotel-rate-info "${BASE_URL_FLAG[@]}" "${PCC_FLAG[@]}" \
  --rate-key "$RATE_KEY" \
  --format json >"$RATE_INFO_FILE"; then
  cat "$TMP_ERR" >&2
  fail "get-hotel-rate-info"
fi

RATE_INFO_HOTEL=$(jq -r '.hotel.info.code // empty' "$RATE_INFO_FILE")
RATE_INFO_COUNT=$(jq -r '
  ((.hotel.rateInfos.convertedRateInfo // []) + (.hotel.rateInfos.rateInfo // []))
  | length
' "$RATE_INFO_FILE")
if [[ -n "$RATE_INFO_HOTEL" ]]; then
  echo "rate-info hotel:   $RATE_INFO_HOTEL"
  echo "rate-info entries: $RATE_INFO_COUNT"
else
  echo "no hotel returned (diagnostics-only envelope)"
  jq '.applicationResults // empty' "$RATE_INFO_FILE"
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
# Step 5 — hotel create-booking (TODO)
# ---------------------------------------------------------------------------
skip 5 "hotel create-booking" "hotel booking not yet wrapped"
# TODO: Wrap the hotel booking endpoint. When it's in, chain it here using
# the bookingKey from step 4, add a cleanup trap for cancel-booking the
# same way scripts/booking-e2e.sh does.

# ---------------------------------------------------------------------------
# Step 6 — get-booking (TODO)
# ---------------------------------------------------------------------------
skip 6 "get-booking (verify hotel)" "depends on step 5; also verify booking-management v1 handles hotel PNRs"

# ---------------------------------------------------------------------------
# Step 7 — cancel-booking (TODO)
# ---------------------------------------------------------------------------
skip 7 "cancel-booking" "depends on step 5"

echo ""
echo "hotel-e2e complete."
echo "Wrapped steps: 1 (hotel-search), 2 (get-hotel-avail), 3 (get-hotel-rate-info), 4 (hotel-price-check)."
echo "Missing steps: 5-7 (hotel booking flow)."
