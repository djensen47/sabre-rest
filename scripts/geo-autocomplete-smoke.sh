#!/usr/bin/env bash
# geo-autocomplete-smoke.sh — smoke test for Geo Autocomplete v2.
#
# Runs a handful of queries against the real Sabre CERT API and verifies
# that the response is well-formed.
#
# ## Prerequisites
#   1. `npm run build`
#   2. A .env file with SABRE_CLIENT_ID, SABRE_CLIENT_SECRET,
#      SABRE_BASE_URL (loaded automatically by the CLI).
#   3. `jq` on PATH.
#
# ## Usage
#   scripts/geo-autocomplete-smoke.sh
#   scripts/geo-autocomplete-smoke.sh --query Paris
#   scripts/geo-autocomplete-smoke.sh --base-url https://api.cert.platform.sabre.com
#
# ## Flags
#   --query <text>            Search text (default: Dallas)
#   --base-url <url>          Override SABRE_BASE_URL
#   -h, --help                Show this help

set -o pipefail

CLI="node dist/cli.js"
QUERY="Dallas"
CLIENT_ID="devstudio"
BASE_URL=""

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --query) QUERY="${2:-}"; shift 2 ;;
    --client-id) CLIENT_ID="${2:-}"; shift 2 ;;
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

CLIENT_ID_FLAG=()
[[ -n "$CLIENT_ID" ]] && CLIENT_ID_FLAG=(--client-id "$CLIENT_ID")

TMP_ERR=$(mktemp)
trap 'rm -f "$TMP_ERR"' EXIT

PASS=0
FAIL=0

run_test() {
  local label="$1"
  shift
  echo "" >&2
  echo "[$label]" >&2
  printf '%*s\n' $(( ${#label} + 2 )) '' | tr ' ' '-' >&2
  echo "  cmd: sabre-rest $*" >&2
  : > "$TMP_ERR"
  local OUT
  if ! OUT=$($CLI "$@" "${BASE_URL_FLAG[@]}" "${CLIENT_ID_FLAG[@]}" --format json 2>"$TMP_ERR"); then
    echo "  FAIL: command exited non-zero" >&2
    cat "$TMP_ERR" >&2
    FAIL=$((FAIL + 1))
    return 1
  fi
  echo "$OUT"
  return 0
}

assert_groups() {
  local json="$1" min_groups="$2"
  local count
  count=$(echo "$json" | jq '.groups | length')
  if (( count < min_groups )); then
    echo "  FAIL: expected at least $min_groups group(s), got $count"
    FAIL=$((FAIL + 1))
    return 1
  fi
  echo "  OK: $count category group(s)"
  PASS=$((PASS + 1))
}

assert_places() {
  local json="$1" min_places="$2"
  local count
  count=$(echo "$json" | jq '[.groups[].places[]] | length')
  if (( count < min_places )); then
    echo "  FAIL: expected at least $min_places place(s), got $count"
    FAIL=$((FAIL + 1))
    return 1
  fi
  echo "  OK: $count place(s) total"
  PASS=$((PASS + 1))
}

assert_category_filter() {
  local json="$1" expected_cat="$2"
  local non_match
  non_match=$(echo "$json" | jq "[.groups[].places[] | select(.category != \"$expected_cat\" and .category != null)] | length")
  if (( non_match > 0 )); then
    echo "  FAIL: found $non_match non-$expected_cat places when filtering by $expected_cat"
    FAIL=$((FAIL + 1))
    return 1
  fi
  echo "  OK: all places are $expected_cat category"
  PASS=$((PASS + 1))
}

# ---------------------------------------------------------------------------
# Test 1 — basic query (all categories)
# ---------------------------------------------------------------------------
OUT=""
if OUT=$(run_test "basic query: $QUERY" geo-autocomplete --query "$QUERY"); then
  assert_groups "$OUT" 1
  assert_places "$OUT" 1
fi

# ---------------------------------------------------------------------------
# Test 2 — filter by category AIR
# ---------------------------------------------------------------------------
OUT=""
if OUT=$(run_test "category filter: AIR" geo-autocomplete --query "$QUERY" --category AIR); then
  assert_groups "$OUT" 1
  assert_category_filter "$OUT" "AIR"
fi

# ---------------------------------------------------------------------------
# Test 3 — limit parameter
# ---------------------------------------------------------------------------
OUT=""
if OUT=$(run_test "limit: 2" geo-autocomplete --query "$QUERY" --category AIR --limit 2); then
  PLACE_COUNT=$(echo "$OUT" | jq '[.groups[].places[]] | length')
  if (( PLACE_COUNT > 2 )); then
    echo "  FAIL: expected at most 2 places, got $PLACE_COUNT"
    FAIL=$((FAIL + 1))
  else
    echo "  OK: $PLACE_COUNT place(s) (within limit)"
    PASS=$((PASS + 1))
  fi
fi

# ---------------------------------------------------------------------------
# Test 4 — table format (verify it doesn't crash)
# ---------------------------------------------------------------------------
echo ""
echo "[table format]"
echo "---------------"
echo "  cmd: sabre-rest geo-autocomplete --query $QUERY --format table"
: > "$TMP_ERR"
if TABLE_OUT=$($CLI geo-autocomplete --query "$QUERY" "${BASE_URL_FLAG[@]}" "${CLIENT_ID_FLAG[@]}" --format table 2>"$TMP_ERR"); then
  if [[ -n "$TABLE_OUT" ]]; then
    echo "  OK: table output rendered"
    echo "$TABLE_OUT" | head -5
    PASS=$((PASS + 1))
  else
    echo "  FAIL: table output was empty"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  FAIL: command exited non-zero"
  cat "$TMP_ERR" >&2
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=============================="
echo "  geo-autocomplete smoke test"
echo "  PASS: $PASS  FAIL: $FAIL"
echo "=============================="

if (( FAIL > 0 )); then
  exit 1
fi
