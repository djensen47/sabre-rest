#!/usr/bin/env bash
# check-env.sh — show which sabre-rest env vars are set, with values masked.
#
# Reads from a .env file in the current directory (if present) merged with the
# current shell environment. Shows each known variable as set/unset and prints
# masked values so you can confirm what the CLI will see without leaking
# secrets to a terminal scrollback.
#
# Masking: the first 2 and last 2 characters are shown, the middle is replaced
# with "*"s. Strings of 4 or fewer characters are fully masked.
#
# Usage:
#   scripts/check-env.sh

set -u

VARS=(
  SABRE_CLIENT_ID
  SABRE_CLIENT_SECRET
  SABRE_BASE_URL
  SABRE_COMPANY_CODE
  SABRE_PCC
  SABRE_TEST_CARD_NUMBER
  SABRE_TEST_CARD_CODE
  SABRE_TEST_CARD_EXPIRY_MONTH
  SABRE_TEST_CARD_EXPIRY_YEAR
  SABRE_TEST_CARD_CVC
)

# Load .env from CWD if it exists, but do not leak its values to the
# environment of any subsequent commands — we only want them in this
# script's scope.
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  . .env
  set +a
fi

mask() {
  local val="$1"
  local len=${#val}
  if (( len == 0 )); then
    echo ""
    return
  fi
  if (( len <= 4 )); then
    printf '%*s' "$len" '' | tr ' ' '*'
    return
  fi
  local head="${val:0:2}"
  local tail="${val: -2}"
  local middle_len=$(( len - 4 ))
  local stars
  stars=$(printf '%*s' "$middle_len" '' | tr ' ' '*')
  echo "${head}${stars}${tail}"
}

# Variables we don't mask — these aren't secrets.
is_public() {
  case "$1" in
    SABRE_BASE_URL|SABRE_COMPANY_CODE|SABRE_PCC) return 0 ;;
    *) return 1 ;;
  esac
}

printf '%-32s  %-7s  %s\n' "VAR" "STATUS" "VALUE"
printf '%-32s  %-7s  %s\n' "--------------------------------" "-------" "-----"
for var in "${VARS[@]}"; do
  value="${!var:-}"
  if [[ -z "$value" ]]; then
    printf '%-32s  %-7s  %s\n' "$var" "unset" "(none)"
    continue
  fi
  if is_public "$var"; then
    display="$value"
  else
    display="$(mask "$value")"
  fi
  printf '%-32s  %-7s  %s  (len=%d)\n' "$var" "set" "$display" "${#value}"
done
