#!/usr/bin/env bash
#
# statusline.sh — project status line for Claude Code sessions.
#
# Reads the session JSON on stdin (model, workspace, cost, transcript path,
# pr) and prints a single line:
#
#   ⌂ dir · ⎇ branch ⋔ · ◇ model[1M] · Ctx: 12% · $0.34 · PR #433
#
# The ⋔ marks a worktree checkout; PR # is a clickable OSC 8 link when the
# branch has an open PR and the terminal supports hyperlinks.
#
# Configured via .claude/settings.json → statusLine. Dependencies: jq, git,
# awk — all present in the dev image and on a typical host.

set -euo pipefail

input=$(cat)

# --- model + 1M-context flag ----------------------------------------------
model_id=$(jq -r '.model.id // ""' <<<"$input")
model_name=$(jq -r '.model.display_name // .model.id // "?"' <<<"$input")
# Drop any trailing " (…)" parenthetical (e.g. "Opus 4.8 (1M context)") — the
# compact [1M] flag below carries the same info in less space.
model_name=${model_name%% (*}
onem=""
ctx_window=200000
if [[ "$model_id" == *"[1m]"* ]]; then
  onem="[1M]"
  ctx_window=1000000
fi

# --- git branch + worktree -------------------------------------------------
cwd=$(jq -r '.workspace.current_dir // .cwd // ""' <<<"$input")
# Very short pwd: just the basename of the current directory.
dir=""
[[ -n "$cwd" ]] && dir=${cwd##*/}
branch=""
worktree=""
if [[ -n "$cwd" ]] && git -C "$cwd" rev-parse --is-inside-work-tree &>/dev/null; then
  branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  # Inside .claude/worktrees/<name>/… → surface the worktree name.
  if [[ "$cwd" == *"/.claude/worktrees/"* ]]; then
    worktree=${cwd##*/.claude/worktrees/}
    worktree=${worktree%%/*}
  fi
fi

# --- context/token usage (last usage entry in the transcript) -------------
# A transcript line's message.usage carries the running context for that turn:
# input + both cache buckets. We read the last one that has usage.
transcript=$(jq -r '.transcript_path // ""' <<<"$input")
ctx_used=0
if [[ -n "$transcript" && -f "$transcript" ]]; then
  ctx_used=$(jq -s '
    [ .[] | .message.usage
      | select(. != null)
      | ((.input_tokens // 0)
         + (.cache_read_input_tokens // 0)
         + (.cache_creation_input_tokens // 0)) ]
    | last // 0
  ' "$transcript" 2>/dev/null || echo 0)
fi

# --- cost ------------------------------------------------------------------
cost=$(jq -r '.cost.total_cost_usd // 0' <<<"$input")

# --- open PR for this branch ----------------------------------------------
# Claude Code passes the current branch's open PR in the input JSON (mirrors
# the native PR badge): pr.number / pr.url, absent until a PR exists and gone
# once it merges. No `gh` call or caching needed — it's already here.
pr_num=$(jq -r '.pr.number // ""' <<<"$input")
pr_url=$(jq -r '.pr.url // ""' <<<"$input")

# --- format ----------------------------------------------------------------
# Colors use the terminal's 16-color ANSI palette (SGR codes), NOT truecolor,
# so the user's terminal theme decides the actual hues. 2=dim, 1=red.
esc=$'\033'
C_DIR="${esc}[36m"      # cyan
C_BRANCH="${esc}[35m"   # magenta (the ⋔ worktree marker rides this color)
C_MODEL="${esc}[32m"    # green
C_CTX="${esc}[33m"      # yellow
C_COST="${esc}[34m"     # blue
C_PR="${esc}[35m"       # magenta
DIM="${esc}[2m"
RESET="${esc}[0m"

pct=$(awk -v u="$ctx_used" -v w="$ctx_window" 'BEGIN { printf "%d", (w>0 ? u*100/w : 0) }')
# Context turns red past 80% so it stands out as it fills.
C_CTX_NOW="$C_CTX"
(( pct >= 80 )) && C_CTX_NOW="${esc}[31m"

parts=()
[[ -n "$dir" ]] && parts+=("${C_DIR}⌂ ${dir}${RESET}")
if [[ -n "$branch" ]]; then
  # Branch, with a trailing ⋔ marker when this checkout is a worktree:
  #   ⎇ main        (normal checkout)
  #   ⎇ feat/x ⋔    (worktree)
  wt_marker=""
  [[ -n "$worktree" ]] && wt_marker=" ⋔"
  parts+=("${C_BRANCH}⎇ ${branch}${wt_marker}${RESET}")
fi
parts+=("${C_MODEL}◇ ${model_name}${onem}${RESET}")
parts+=("${C_CTX_NOW}Ctx: ${pct}%${RESET}")
parts+=("${C_COST}$(awk -v c="$cost" 'BEGIN { printf "$%.2f", c }')${RESET}")
# Open PR for this branch, when one exists (from the input JSON above). When we
# have the URL, wrap the label in an OSC 8 hyperlink so it's clickable in
# terminals that support it (iTerm2, Kitty, WezTerm; SSH/tmux may strip it —
# FORCE_HYPERLINK=1 overrides). Terminals without OSC 8 just show "PR #N".
# OSC 8 form per the Claude Code docs: \e]8;;URL\a TEXT \e]8;;\a (BEL-terminated).
if [[ -n "$pr_num" ]]; then
  pr_label="PR #${pr_num}"
  if [[ -n "$pr_url" ]]; then
    bel=$'\a'
    pr_label="${esc}]8;;${pr_url}${bel}PR #${pr_num}${esc}]8;;${bel}"
  fi
  parts+=("${C_PR}${pr_label}${RESET}")
fi

# Join with a dimmed " · " separator.
sep="${DIM} · ${RESET}"
out=""
for p in "${parts[@]}"; do
  out+="${out:+$sep}$p"
done
printf '%s' "$out"
