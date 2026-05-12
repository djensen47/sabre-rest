#!/usr/bin/env bash
# random-person.sh — sourceable helper that generates a random traveler
# identity for smoke tests.
#
# Usage:
#   source scripts/lib/random-person.sh
#   generate_person          # fills PERSON_* vars with fresh random data
#   generate_person 42       # seeded (reproducible) — pass any integer
#
# Vars set on success:
#   PERSON_GIVEN_NAME   e.g. JANE           (uppercase, alpha-only, PNR-safe)
#   PERSON_SURNAME      e.g. MARTINEZ
#   PERSON_BIRTHDATE    e.g. 1987-03-14     (ISO, adult age 18–75)
#   PERSON_GENDER       MALE or FEMALE      (Sabre BookGender subset)
#   PERSON_EMAIL        e.g. jane.martinez+a1b2c3@example.com
#   PERSON_PHONE        e.g. 14155550123    (11 digits, US-shaped)
#   PERSON_SEED         the seed used (echoed so failed runs can be rerun)

# Small curated lists — alpha-only, no hyphens or apostrophes, all <= 15 chars
# so they fit PNR name limits without truncation surprises.
_RP_FIRST=(
  JAMES MARY JOHN PATRICIA ROBERT JENNIFER MICHAEL LINDA WILLIAM ELIZABETH
  DAVID BARBARA RICHARD SUSAN JOSEPH JESSICA THOMAS SARAH CHARLES KAREN
  CHRISTOPHER NANCY DANIEL LISA MATTHEW BETTY ANTHONY MARGARET MARK SANDRA
  DONALD ASHLEY STEVEN KIMBERLY PAUL EMILY ANDREW DONNA JOSHUA MICHELLE
)
_RP_LAST=(
  SMITH JOHNSON WILLIAMS BROWN JONES GARCIA MILLER DAVIS RODRIGUEZ MARTINEZ
  HERNANDEZ LOPEZ GONZALEZ WILSON ANDERSON THOMAS TAYLOR MOORE JACKSON MARTIN
  LEE PEREZ THOMPSON WHITE HARRIS SANCHEZ CLARK RAMIREZ LEWIS ROBINSON
  WALKER YOUNG ALLEN KING WRIGHT SCOTT TORRES NGUYEN HILL FLORES
)

# Seeded PRNG via awk — deterministic when given a seed, otherwise seeded
# from $RANDOM + epoch nanoseconds.
_rp_rand() {
  # $1 = upper bound (exclusive), $2 = seed
  awk -v n="$1" -v s="$2" 'BEGIN { srand(s); printf("%d", int(rand() * n)) }'
}

generate_person() {
  local seed="${1:-}"
  if [[ -z "$seed" ]]; then
    # Mix $RANDOM with nanoseconds for a fresh-each-call seed. Python is
    # always available on macOS/Linux and avoids `date +%N` portability.
    seed=$(python3 -c 'import time, random; print(random.randint(0, 2**31-1) ^ (time.time_ns() & 0x7fffffff))')
  fi
  PERSON_SEED="$seed"

  local n_first=${#_RP_FIRST[@]}
  local n_last=${#_RP_LAST[@]}

  # Derive each field from an offset of the seed so they vary independently.
  local fi=$(_rp_rand "$n_first" "$seed")
  local li=$(_rp_rand "$n_last"  "$((seed + 1))")
  PERSON_GIVEN_NAME="${_RP_FIRST[$fi]}"
  PERSON_SURNAME="${_RP_LAST[$li]}"

  # Birthdate: pick age 18–75, month 1–12, day 1–28 (avoids month-length edge cases).
  local age=$((18 + $(_rp_rand 58 "$((seed + 2))")))
  local month=$((1 + $(_rp_rand 12 "$((seed + 3))")))
  local day=$((1 + $(_rp_rand 28 "$((seed + 4))")))
  local this_year
  this_year=$(date +%Y)
  local birth_year=$((this_year - age))
  PERSON_BIRTHDATE=$(printf '%04d-%02d-%02d' "$birth_year" "$month" "$day")

  # Email tag: 6 random lowercase alphanumerics so repeats don't collide
  # against carrier dedupe heuristics.
  local tag
  tag=$(awk -v s="$((seed + 5))" 'BEGIN {
    srand(s)
    chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    out = ""
    for (i = 0; i < 6; i++) out = out substr(chars, int(rand() * 36) + 1, 1)
    print out
  }')
  local gn_lower
  gn_lower=$(printf '%s' "$PERSON_GIVEN_NAME" | tr '[:upper:]' '[:lower:]')
  local sn_lower
  sn_lower=$(printf '%s' "$PERSON_SURNAME" | tr '[:upper:]' '[:lower:]')
  # No `+tag` addressing: Sabre's PNR email entry format rejects `+`
  # with ".EMAIL ENTRY REQUIRES TWO $ CHARACTERS".
  PERSON_EMAIL="${gn_lower}.${sn_lower}.${tag}@example.com"

  # Phone: 1 + 10 digits. Use 555-prefixed exchange to stay in reserved test
  # range (NANP assigns 555-0100 through 555-0199 to fictitious numbers).
  local area=$((200 + $(_rp_rand 800 "$((seed + 6))")))
  local line=$((100 + $(_rp_rand 100 "$((seed + 7))")))
  PERSON_PHONE=$(printf '1%03d555%04d' "$area" "$line")

  # Gender: MALE or FEMALE (Sabre BookGender also supports INFANT_* and
  # UNDISCLOSED, but SFPD for adult fare classes expects a binary value).
  if (( $(_rp_rand 2 "$((seed + 8))") == 0 )); then
    PERSON_GENDER="MALE"
  else
    PERSON_GENDER="FEMALE"
  fi
}
