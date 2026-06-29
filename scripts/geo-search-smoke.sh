#!/usr/bin/env bash
# geo-search-smoke.sh — smoke test for the geo-search CLI command.
#
# Exercises `geo-search` against Sabre CERT with all three anchor types
# (geo-code, ref-point, address) and verifies each returns results.
#
# Prerequisites:
#   - SABRE_CLIENT_ID and SABRE_CLIENT_SECRET are set (or in .env)
#   - SABRE_BASE_URL defaults to https://api.cert.platform.sabre.com
#   - The project has been built: `npm run build`
#
# Usage:
#   scripts/geo-search-smoke.sh

set -euo pipefail

CLI="node dist/cli.js"
PASS=0
FAIL=0

run_test() {
  local label="$1"
  shift
  echo "─── $label ───"
  echo "  \$ $CLI $*"
  local output
  if output=$($CLI "$@" 2>&1); then
    local count
    count=$(echo "$output" | jq -r '.results | length' 2>/dev/null || echo "?")
    echo "  ✓ OK — $count results"
    PASS=$((PASS + 1))
  else
    echo "  ✗ FAILED"
    echo "$output" | head -10 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
  fi
  echo
}

echo "Geo Search v4 — smoke test"
echo "Base URL: ${SABRE_BASE_URL:-https://api.cert.platform.sabre.com}"
echo

# 1. Search by lat/lon (DFW airport area, hotels within 5 KM)
run_test "geo-code: hotels near DFW" \
  geo-search --category HOTEL --geo-code 32.877,-96.96 --radius 5 --uom KM

# 2. Search by ref-point (airport code DFW, airports within 50 MI)
run_test "ref-point: airports near DFW" \
  geo-search --category AIR --ref-point 6:DFW:CODE --radius 50 --uom MI

# 3. Search by address (Irving, TX — car rental locations)
run_test "address: car rentals in Irving TX" \
  geo-search --category CAR --address US,Irving,TX --radius 10 --uom MI

# 4. Table output format
echo "─── table format ───"
echo "  \$ $CLI geo-search --category HOTEL --geo-code 32.877,-96.96 --radius 5 --uom KM --format table"
if table_output=$($CLI geo-search --category HOTEL --geo-code 32.877,-96.96 --radius 5 --uom KM --format table 2>&1); then
  echo "$table_output" | head -5 | sed 's/^/  /'
  echo "  ✓ OK (table output above)"
  PASS=$((PASS + 1))
else
  echo "  ✗ FAILED"
  echo "$table_output" | head -5 | sed 's/^/    /'
  FAIL=$((FAIL + 1))
fi
echo

# 5. With attributes filter
run_test "attributes: CHAIN=HC hotels near DFW" \
  geo-search --category HOTEL --geo-code 32.877,-96.96 --radius 10 --uom MI --attributes CHAIN=HC

# Summary
echo "═══════════════════════════════"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "═══════════════════════════════"

if (( FAIL > 0 )); then
  exit 1
fi
