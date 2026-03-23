#!/usr/bin/env bash
# PostToolUse (Skill) Hook: Inject auto-loop directive after Skill completion
# When a skill like /deep-analyze creates docs, this hook reads the state file
# and outputs a directive to stdout (presented to model via PostToolUse output).
# This prevents the model from asking "要執行嗎？" after doc-producing skills.
#
# Defense-in-depth: Primary fixes are behavioral (SKILL.md + auto-loop rule).
# This hook reinforces the directive via hook infrastructure.
#
# Only outputs when there are pending review steps. Silent otherwise.

set -euo pipefail

# === Plugin-defers-to-local arbitration ===
_SELF_NAME="$(basename "$0")"
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]] \
   && [[ ! -f "${CLAUDE_PROJECT_DIR}/hooks/hooks.json" ]] \
   && [[ -x "${CLAUDE_PROJECT_DIR}/.claude/hooks/${_SELF_NAME}" ]]; then
  _SETTINGS_MATCH=false
  for _sf in "${CLAUDE_PROJECT_DIR}/.claude/settings.json" \
             "${CLAUDE_PROJECT_DIR}/.claude/settings.local.json"; do
    if [[ -f "$_sf" ]]; then
      if command -v jq &>/dev/null; then
        jq -e '.hooks // {} | .. | strings | select(contains(".claude/hooks/'"${_SELF_NAME}"'"))' "$_sf" >/dev/null 2>&1 \
          && _SETTINGS_MATCH=true && break
      else
        grep -q "\.claude/hooks/${_SELF_NAME}" "$_sf" 2>/dev/null \
          && _SETTINGS_MATCH=true && break
      fi
    fi
  done
  if [[ "$_SETTINGS_MATCH" == "true" ]]; then
    exit 0  # Defer to local hook
  fi
fi

STATE_FILE=".claude_review_state.json"

# Consume stdin (required by hook protocol)
cat > /dev/null

# Graceful degradation
if ! command -v jq &>/dev/null; then exit 0; fi
if [[ ! -f "$STATE_FILE" ]]; then exit 0; fi

# Read state
HAS_CODE=$(jq -r '.has_code_change // false' "$STATE_FILE" 2>/dev/null || echo "false")
HAS_DOC=$(jq -r '.has_doc_change // false' "$STATE_FILE" 2>/dev/null || echo "false")
CODE_PASSED=$(jq -r '.code_review.passed // false' "$STATE_FILE" 2>/dev/null || echo "false")
DOC_PASSED=$(jq -r '.doc_review.passed // false' "$STATE_FILE" 2>/dev/null || echo "false")
PRE_PASSED=$(jq -r '.precommit.passed // false' "$STATE_FILE" 2>/dev/null || echo "false")

# Stale-state reconciliation (one-way: true→false only, same as stop-guard/post-compact)
GIT_PORCELAIN=$(git status --porcelain -uno 2>/dev/null || echo "__GIT_UNAVAILABLE__")
if [[ "$GIT_PORCELAIN" != "__GIT_UNAVAILABLE__" ]]; then
  if [[ "$HAS_CODE" == "true" ]]; then
    if ! echo "$GIT_PORCELAIN" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs|py|pyw|go|rs|java|kt|kts|rb|php|swift|c|cpp|cc|h|hpp|cs|scala|ex|exs)($|\s|")'; then
      HAS_CODE="false"
    fi
  fi
  if [[ "$HAS_DOC" == "true" ]]; then
    if ! echo "$GIT_PORCELAIN" | grep -qE '\.(md|mdx)($|\s|")'; then
      HAS_DOC="false"
    fi
  fi
fi

# Determine next required step
NEXT=""
if [[ "$HAS_CODE" == "true" && "$CODE_PASSED" != "true" ]]; then
  NEXT="/codex-review-fast"
elif [[ "$HAS_CODE" == "true" && "$CODE_PASSED" == "true" && "$PRE_PASSED" != "true" ]]; then
  NEXT="/precommit-fast"
elif [[ "$HAS_DOC" == "true" && "$DOC_PASSED" != "true" ]]; then
  NEXT="/codex-review-doc"
fi

# Only output when there is a pending step
if [[ -n "$NEXT" ]]; then
  cat <<EOF
[AUTO_LOOP] Review state has pending step after skill completion.
Required: ${NEXT}
Do not ask "要執行嗎？" — execute ${NEXT} now per auto-loop rules.
EOF
fi

exit 0
