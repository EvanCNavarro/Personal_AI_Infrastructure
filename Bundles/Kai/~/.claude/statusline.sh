#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  KAI STATUS LINE - Personal AI Infrastructure                     ║
# ║  Real-time session stats in your Claude Code terminal             ║
# ╚═══════════════════════════════════════════════════════════════════╝

INPUT=$(cat)
parse() { echo "$INPUT" | jq -r "$1" 2>/dev/null || echo ""; }

# ─────────────────────────────────────────────────────────────────────
# DATA EXTRACTION
# ─────────────────────────────────────────────────────────────────────

MODEL=$(parse '.model.display_name')
MODEL_ID=$(parse '.model.id')
[ -z "$MODEL" ] || [ "$MODEL" = "null" ] && MODEL="Claude"
# Only add version if display_name doesn't already contain it
if [ -n "$MODEL_ID" ] && [ "$MODEL_ID" != "null" ]; then
  VER=$(echo "$MODEL_ID" | grep -oE '[0-9]+-[0-9]+' | head -1 | tr '-' '.')
  if [ -n "$VER" ] && ! echo "$MODEL" | grep -qE '[0-9]+\.[0-9]+'; then
    MODEL="$MODEL $VER"
  fi
fi

COST_RAW=$(parse '.cost.total_cost_usd')
[ -n "$COST_RAW" ] && [ "$COST_RAW" != "null" ] && COST=$(printf '%.2f' "$COST_RAW") || COST="0.00"

CTX_SIZE=$(parse '.context_window.context_window_size')
CTX_INPUT=$(parse '.context_window.current_usage.input_tokens')
CTX_CACHE_C=$(parse '.context_window.current_usage.cache_creation_input_tokens')
CTX_CACHE_R=$(parse '.context_window.current_usage.cache_read_input_tokens')
CTX="0"
if [ -n "$CTX_SIZE" ] && [ "$CTX_SIZE" != "null" ] && [ "$CTX_SIZE" -gt 0 ] 2>/dev/null; then
  TOK=0
  [ -n "$CTX_INPUT" ] && [ "$CTX_INPUT" != "null" ] && TOK=$((TOK + CTX_INPUT))
  [ -n "$CTX_CACHE_C" ] && [ "$CTX_CACHE_C" != "null" ] && TOK=$((TOK + CTX_CACHE_C))
  [ -n "$CTX_CACHE_R" ] && [ "$CTX_CACHE_R" != "null" ] && TOK=$((TOK + CTX_CACHE_R))
  CTX=$((TOK * 100 / CTX_SIZE))
fi

DUR_MS=$(parse '.cost.total_duration_ms')
DUR="0s"
if [ -n "$DUR_MS" ] && [ "$DUR_MS" != "null" ] && [ "$DUR_MS" -gt 0 ] 2>/dev/null; then
  S=$((DUR_MS / 1000))
  if [ "$S" -lt 60 ]; then DUR="${S}s"
  elif [ "$S" -lt 3600 ]; then
    M=$((S / 60)); R=$((S % 60))
    [ "$R" -gt 0 ] && DUR="${M}m${R}s" || DUR="${M}m"
  else
    H=$((S / 3600)); M=$(((S % 3600) / 60))
    DUR="${H}h${M}m"
  fi
fi

ADD=$(parse '.cost.total_lines_added')
REM=$(parse '.cost.total_lines_removed')
LINES=""
[ -n "$ADD" ] && [ "$ADD" != "null" ] && [ "$ADD" -gt 0 ] 2>/dev/null && LINES="+$ADD"
[ -n "$REM" ] && [ "$REM" != "null" ] && [ "$REM" -gt 0 ] 2>/dev/null && LINES="$LINES-$REM"
[ -z "$LINES" ] && LINES="--"

PROJECT_DIR=$(parse '.workspace.current_dir')
[ -n "$PROJECT_DIR" ] && [ "$PROJECT_DIR" != "null" ] && WORK_DIR="$PROJECT_DIR" || WORK_DIR="$PWD"
PROJECT=$(basename "$WORK_DIR")

# Git
BRANCH="" DIRTY="" SYNC=""
if cd "$WORK_DIR" 2>/dev/null && git rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  [ -z "$BRANCH" ] && BRANCH=$(git rev-parse --short HEAD 2>/dev/null)
  [ -n "$(git status --porcelain 2>/dev/null)" ] && DIRTY="*"
  UP=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
  if [ -n "$UP" ]; then
    A=$(git rev-list --count @{u}..HEAD 2>/dev/null)
    B=$(git rev-list --count HEAD..@{u} 2>/dev/null)
    [ "$A" -gt 0 ] 2>/dev/null && SYNC="↑$A"
    [ "$B" -gt 0 ] 2>/dev/null && SYNC="$SYNC↓$B"
  fi
fi

# Battery (macOS)
BATT=""
if [ "$(uname)" = "Darwin" ]; then
  B=$(pmset -g batt 2>/dev/null | grep -o '[0-9]*%' | head -1 | tr -d '%')
  [ -n "$B" ] && BATT="$B%"
fi

# Env warning
ENV=""
EV="${NODE_ENV:-${RAILS_ENV:-${APP_ENV:-}}}"
[ "$EV" = "production" ] || [ "$EV" = "prod" ] && ENV="PROD"
[ "$EV" = "staging" ] && ENV="STAGE"
if [ -z "$ENV" ] && [ -n "$BRANCH" ]; then
  case "$BRANCH" in
    prod|production|release/*|hotfix/*) ENV="PROD" ;;
    staging|stage) ENV="STAGE" ;;
  esac
fi

# ─────────────────────────────────────────────────────────────────────
# BUILD OUTPUT
# Format: icon Header: value │ icon Header: value │ ...
# ─────────────────────────────────────────────────────────────────────

OUT=""

# Environment warning first (high visibility)
[ "$ENV" = "PROD" ] && OUT="🔴 PROD │ "
[ "$ENV" = "STAGE" ] && OUT="🟡 STAGE │ "

# White/bright for values only
W=$'\e[97m'  # bright white
R=$'\e[0m'   # reset

# Model section (brackets for clean look)
OUT="$OUT[${W}$MODEL${R}]"

# Project section
OUT="$OUT │ 📁 Project: ${W}$PROJECT${R}"

# Git section
if [ -n "$BRANCH" ]; then
  G="$BRANCH$DIRTY"
  [ -n "$SYNC" ] && G="$G $SYNC"
  OUT="$OUT │ 🌿 Branch: ${W}$G${R}"
fi

# Battery (if available)
[ -n "$BATT" ] && OUT="$OUT │ 🔋 Battery: ${W}$BATT${R}"

# Stats - each with separator and header
OUT="$OUT │ 💰 Cost: ${W}\$$COST${R} │ 📋 Context: ${W}$CTX%${R} │ ⏰ Session: ${W}$DUR${R} │ ✏️  Changes: ${W}$LINES${R}"

echo "$OUT"
