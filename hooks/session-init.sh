#!/usr/bin/env bash
# session-init.sh — SessionStart hook: reset review state on new session (D-2)
# Preserves total_rounds_session and strategic_reset_fired for strategic reset logic.
set -euo pipefail

STATE_FILE=".claude_review_state.json"
INPUT=$(cat)

# Require jq
if ! command -v jq &> /dev/null; then exit 0; fi

NEW_SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
if [[ -z "$NEW_SESSION_ID" ]]; then exit 0; fi

if [[ -f "$STATE_FILE" ]]; then
  OLD_SESSION_ID=$(jq -r '.session_id // empty' "$STATE_FILE" 2>/dev/null)
  if [[ "$OLD_SESSION_ID" != "$NEW_SESSION_ID" ]]; then
    # Different session (including empty→new) — reset review state, preserve cumulative fields
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    TMP=$(mktemp)
    jq --arg sid "$NEW_SESSION_ID" --arg now "$NOW" '
      .session_id = $sid | .updated_at = $now |
      .has_code_change = false | .has_doc_change = false |
      .code_review = {"executed":false,"passed":false} |
      .doc_review = {"executed":false,"passed":false} |
      .precommit = {"executed":false,"passed":false} |
      .aggregate_gate = {"executed":false} |
      .iteration_history.current_round = 0 |
      .iteration_history.findings_by_round = []
    ' "$STATE_FILE" > "$TMP" && mv "$TMP" "$STATE_FILE"
  fi
else
  # No state file — create minimal
  echo "{\"schema_version\":2,\"session_id\":\"$NEW_SESSION_ID\"}" > "$STATE_FILE"
fi
