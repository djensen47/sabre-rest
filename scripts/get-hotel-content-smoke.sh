#!/usr/bin/env bash
# get-hotel-content-smoke.sh — smoke test for the get-hotel-content CLI command.
#
# Get Hotel Content has no rate-key rerun mode — it only accepts a hotel
# code — so this script first runs `hotel-search` to discover a real
# property ID in CERT, then exercises `get-hotel-content` against it with
# descriptive-info-only, media-only, and combined requests.
#
# Prerequisites:
#   - SABRE_CLIENT_ID and SABRE_CLIENT_SECRET are set (or in .env)
#   - SABRE_BASE_URL defaults to https://api.cert.platform.sabre.com
#   - `jq` on PATH
#   - The project has been built: `npm run build`
#
# Usage:
#   scripts/get-hotel-content-smoke.sh
#   scripts/get-hotel-content-smoke.sh --hotel-code 100072188 --code-context GLOBAL

set -euo pipefail

CLI="node dist/cli.js"
PASS=0
FAIL=0
HOTEL_CODE=""
CODE_CONTEXT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hotel-code) HOTEL_CODE="${2:-}"; shift 2 ;;
    --code-context) CODE_CONTEXT="${2:-}"; shift 2 ;;
    -h|--help) echo "Usage: $0 [--hotel-code <code>] [--code-context SABRE|GLOBAL]"; exit 0 ;;
    *) echo "error: unknown argument '$1'" >&2; exit 2 ;;
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

run_test() {
  local label="$1"
  shift
  echo "─── $label ───"
  echo "  \$ $CLI $*"
  local output
  if output=$($CLI "$@" 2>&1); then
    echo "$output" | head -5 | sed 's/^/  /'
    echo "  ✓ OK"
    PASS=$((PASS + 1))
  else
    echo "  ✗ FAILED"
    echo "$output" | head -10 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
  fi
  echo
}

echo "Get Hotel Content v4 — smoke test"
echo "Base URL: ${SABRE_BASE_URL:-https://api.cert.platform.sabre.com}"
echo

# 0. Discover a real hotel code via hotel-search, unless one was supplied.
if [[ -z "$HOTEL_CODE" ]]; then
  echo "─── discovering a hotel code via hotel-search ───"
  SEARCH_OUTPUT=$($CLI hotel-search --ref-point 6:BWI:CODE --radius 5 --uom MI --max-results 1 --format json)
  HOTEL_CODE=$(echo "$SEARCH_OUTPUT" | jq -r '.hotels[0].code // empty')
  CODE_CONTEXT=$(echo "$SEARCH_OUTPUT" | jq -r '.hotels[0].codeContext // empty')
  if [[ -z "$HOTEL_CODE" ]]; then
    echo "  ✗ FAILED — hotel-search returned no properties" >&2
    exit 1
  fi
  echo "  hotel code: $HOTEL_CODE (codeContext=${CODE_CONTEXT:-none})"
  echo
fi

CODE_CONTEXT_FLAG=()
[[ -n "$CODE_CONTEXT" ]] && CODE_CONTEXT_FLAG=(--code-context "$CODE_CONTEXT")

# 1. Minimum request — hotel code only, no descriptive/media content.
run_test "minimum request (hotel code only)" \
  get-hotel-content --hotel-code "$HOTEL_CODE" "${CODE_CONTEXT_FLAG[@]}"

# 2. Descriptive info only.
run_test "descriptive info (property + location + amenities + security)" \
  get-hotel-content --hotel-code "$HOTEL_CODE" "${CODE_CONTEXT_FLAG[@]}" \
  --with-property-info --with-location --with-amenities --with-security

# 3. Media only.
run_test "media (images + panoramic + max 5)" \
  get-hotel-content --hotel-code "$HOTEL_CODE" "${CODE_CONTEXT_FLAG[@]}" \
  --with-media --media-images MEDIUM,LARGE --media-panoramic --media-max 5

# 4. Combined descriptive + media, table output.
echo "─── combined descriptive + media, table format ───"
echo "  \$ $CLI get-hotel-content --hotel-code $HOTEL_CODE ${CODE_CONTEXT_FLAG[*]} --with-property-info --with-amenities --with-media --media-images MEDIUM --format table"
if table_output=$($CLI get-hotel-content --hotel-code "$HOTEL_CODE" "${CODE_CONTEXT_FLAG[@]}" \
    --with-property-info --with-amenities --with-media --media-images MEDIUM --format table 2>&1); then
  echo "$table_output" | sed 's/^/  /'
  echo "  ✓ OK (table output above)"
  PASS=$((PASS + 1))
else
  echo "  ✗ FAILED"
  echo "$table_output" | head -5 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi
echo

# 5. Free-text descriptions filter.
run_test "descriptions filter (ShortDescription, Facilities)" \
  get-hotel-content --hotel-code "$HOTEL_CODE" "${CODE_CONTEXT_FLAG[@]}" \
  --with-descriptions ShortDescription,Facilities

# Summary
echo "═══════════════════════════════"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "═══════════════════════════════"

if (( FAIL > 0 )); then
  exit 1
fi
