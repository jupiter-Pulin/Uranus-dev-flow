#!/usr/bin/env bash
# Stop Guard Hook - Check for missing required steps + review status
# Exit 0 = allow stop, Exit 2 = block stop and require action
#
# Modes:
# - Default (warn): Log missing steps but allow stop
# - Strict (block): Block stop until all steps complete
#
# Set STOP_GUARD_MODE=strict to enable blocking (opt-in)

set -euo pipefail

# === Plugin-defers-to-local arbitration ===
# When running as a plugin hook, detect if identical local hook is installed
# and registered in project settings — if so, exit 0 to avoid double-fire.
# Dev-mode bypass: hooks/hooks.json at project root = plugin source repo (skip arbitration).
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

# === Configuration ===
# Mode priority: env STOP_GUARD_MODE > settings.local env.STOP_GUARD_MODE (or legacy hooks_config)
#                > settings.json env.STOP_GUARD_MODE (or legacy hooks_config) > default "warn"
# HOOK_BYPASS=1  - Skip all checks (emergency escape hatch)
# HOOK_DEBUG=1   - Output debug info

# === Mode resolution (env > legacy settings hooks_config > default) ===
_resolve_guard_mode() {
  # Priority 1: Environment variable
  if [[ -n "${STOP_GUARD_MODE:-}" ]]; then echo "$STOP_GUARD_MODE"; return; fi
  # Priority 2-3: Settings files (jq required)
  if command -v jq &>/dev/null; then
    local _m
    for _sf in "${CLAUDE_PROJECT_DIR:-.}/.claude/settings.local.json" \
               "${CLAUDE_PROJECT_DIR:-.}/.claude/settings.json"; do
      # Try env.STOP_GUARD_MODE first (canonical), then legacy hooks_config
      _m=$(jq -r '.env.STOP_GUARD_MODE // .hooks_config.stop_guard_mode // empty' "$_sf" 2>/dev/null) || true
      if [[ -n "$_m" ]]; then echo "$_m"; return; fi
    done
  fi
  # Priority 4: default
  echo "warn"
}
GUARD_MODE=$(_resolve_guard_mode)
# Validate mode value
if [[ "$GUARD_MODE" != "strict" && "$GUARD_MODE" != "warn" ]]; then
  echo "[Stop Guard] Invalid GUARD_MODE='$GUARD_MODE', falling back to warn" >&2
  GUARD_MODE="warn"
fi

if [[ "${HOOK_BYPASS:-}" == "1" ]]; then
  echo "[Stop Guard] BYPASS mode, skipping checks" >&2
  echo '{"ok":true,"reason":"BYPASS mode"}'
  exit 0
fi

# Read JSON input from stdin
INPUT=$(cat)

# Recursion guard: prevent infinite loop in strict mode (D-1)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then exit 0; fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "[Stop Guard] jq not installed, allowing stop" >&2
  echo '{"ok":true,"reason":"jq not installed"}'
  exit 0
fi

# Extract transcript_path
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

if [[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]]; then
  echo "[Stop Guard] Cannot read transcript, allowing stop" >&2
  echo '{"ok":true,"reason":"no transcript"}'
  exit 0
fi

# === Prefer reading state file ===
STATE_FILE=".claude_review_state.json"
USE_STATE_FILE=false

if [[ -f "$STATE_FILE" ]]; then
  USE_STATE_FILE=true
  STATE=$(cat "$STATE_FILE" 2>/dev/null || echo "{}")

  CODE_REVIEW_PASSED=$(echo "$STATE" | jq -r '.code_review.passed // false')
  DOC_REVIEW_PASSED=$(echo "$STATE" | jq -r '.doc_review.passed // false')
  PRECOMMIT_PASSED=$(echo "$STATE" | jq -r '.precommit.passed // false')
  HAS_CODE_CHANGE=$(echo "$STATE" | jq -r '.has_code_change // false')
  HAS_DOC_CHANGE=$(echo "$STATE" | jq -r '.has_doc_change // false')

  # === Sidecar fail-closed marker (race-safe lock-failure signal) ===
  if [[ -f "${STATE_FILE}.blocked" ]]; then
    GUARD_MODE="strict"
    SIDECAR_REASON=$(cat "${STATE_FILE}.blocked" 2>/dev/null || echo "unknown")
    echo "[Stop Guard] Sidecar blocked marker found (reason: $SIDECAR_REASON)" >&2
    # Force aggregate gate to BLOCKED regardless of JSON state
    DUAL_GATE_PASSED="false"
  fi

  # === Dual mode: prefer aggregate_gate + force strict blocking ===
  # Skip recompute if sidecar already set DUAL_GATE_PASSED (sidecar is authoritative)
  REVIEW_MODE=$(echo "$STATE" | jq -r '.review_mode // "single"')
  if [[ "$REVIEW_MODE" == "dual" && "${DUAL_GATE_PASSED:-}" != "false" ]]; then
    GUARD_MODE="strict"  # dual mode forces strict blocking
    AGG_EXECUTED=$(echo "$STATE" | jq -r '.aggregate_gate.executed // false')
    AGG_GATE=$(echo "$STATE" | jq -r '.aggregate_gate.gate // empty')
    if [[ "$AGG_EXECUTED" == "true" ]]; then
      DUAL_GATE_PASSED=$([[ "$AGG_GATE" == "READY" ]] && echo "true" || echo "false")
    else
      DUAL_GATE_PASSED="false"  # fail-closed: aggregation incomplete
    fi
    # In dual mode, aggregate_gate overrides individual code_review
    CODE_REVIEW_PASSED="$DUAL_GATE_PASSED"
    if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
      echo "[Debug] Dual mode: AGG_EXECUTED=$AGG_EXECUTED, AGG_GATE=$AGG_GATE, DUAL_GATE_PASSED=$DUAL_GATE_PASSED" >&2
    fi
  elif [[ "${DUAL_GATE_PASSED:-}" == "false" ]]; then
    # Sidecar-forced BLOCKED: propagate to CODE_REVIEW_PASSED
    GUARD_MODE="strict"
    CODE_REVIEW_PASSED="false"
    if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
      echo "[Debug] Sidecar override: DUAL_GATE_PASSED=false (sidecar authoritative)" >&2
    fi
  fi

  if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
    echo "[Debug] Using state file mode" >&2
    echo "[Debug] REVIEW_MODE=$REVIEW_MODE" >&2
    echo "[Debug] CODE_REVIEW_PASSED=$CODE_REVIEW_PASSED" >&2
    echo "[Debug] PRECOMMIT_PASSED=$PRECOMMIT_PASSED" >&2
  fi

  # === Stale-state git check (with cross-platform timeout) ===
  if command -v timeout &>/dev/null; then
    GIT_PORCELAIN=$(timeout 5 git status --porcelain -uno 2>/dev/null || echo "__GIT_UNAVAILABLE__")
  elif command -v gtimeout &>/dev/null; then
    GIT_PORCELAIN=$(gtimeout 5 git status --porcelain -uno 2>/dev/null || echo "__GIT_UNAVAILABLE__")
  else
    GIT_PORCELAIN=$(git status --porcelain -uno 2>/dev/null || echo "__GIT_UNAVAILABLE__")
  fi
  if [[ "$GIT_PORCELAIN" != "__GIT_UNAVAILABLE__" ]]; then
    # Strip porcelain quoting (git quotes filenames with spaces/unicode)
    GIT_PORCELAIN_CLEAN=$(echo "$GIT_PORCELAIN" | sed 's/^.. "//; s/"$//')
    # Stale-state reconciliation is ONE-WAY: only true→false.
    # We can safely override has_*_change from true to false when git status
    # shows no matching files — the state file was set in a prior edit that
    # has since been reverted or committed.
    # The reverse (false→true) is NOT done because it would cause false
    # positives: a file might exist in the worktree but was never edited by
    # the current session (e.g., pre-existing untracked files). The state
    # file's false→true transition is handled by post-tool-review-state.sh
    # at edit time, which has the correct session context.
    if [[ "$HAS_CODE_CHANGE" == "true" ]]; then
      if ! echo "$GIT_PORCELAIN_CLEAN" | grep -qE '\.(ts|tsx|js|jsx|mjs|cjs|py|pyw|go|rs|java|kt|kts|rb|php|swift|c|cpp|cc|h|hpp|cs|scala|ex|exs)($|\s|")'; then
        HAS_CODE_CHANGE="false"
        if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
          echo "[Debug] Stale has_code_change overridden to false (no code in git status)" >&2
        fi
      fi
    fi
    # Override stale has_doc_change if no doc files in worktree
    if [[ "$HAS_DOC_CHANGE" == "true" ]]; then
      if ! echo "$GIT_PORCELAIN_CLEAN" | grep -qE '\.(md|mdx)($|\s|")'; then
        HAS_DOC_CHANGE="false"
        if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
          echo "[Debug] Stale has_doc_change overridden to false (no docs in git status)" >&2
        fi
      fi
    fi
  fi
  # If git unavailable → fail-open, trust state file
fi

# === Fallback: Read transcript content (limited scan range) ===
if [[ "$USE_STATE_FILE" == "false" ]]; then
  # Only read last 500 lines to avoid performance issues
  CONVERSATION=$(tail -500 "$TRANSCRIPT" 2>/dev/null || echo "")

  # Check change types
  HAS_CODE_CHANGE=$(echo "$CONVERSATION" | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|py|pyw|go|rs|java|kt|kts|rb|php|swift|c|cpp|cc|h|hpp|cs|scala|ex|exs)"' | grep -E '"(Edit|Write)"' | head -1 || true)
  HAS_DOC_CHANGE=$(echo "$CONVERSATION" | grep -E '\.(md|mdx)"' | grep -E '"(Edit|Write)"' | head -1 || true)

  # Check if required commands were executed
  HAS_CODEX_REVIEW=$(echo "$CONVERSATION" | grep -oE '/(sd0x-dev-flow:)?codex-review(-fast|-branch)?($|[[:space:]])' | tail -1 || true)
  HAS_PRECOMMIT=$(echo "$CONVERSATION" | grep -oE '/(sd0x-dev-flow:)?precommit(-fast)?($|[[:space:]])' | tail -1 || true)
  HAS_REVIEW_DOC=$(echo "$CONVERSATION" | grep -oE '/(sd0x-dev-flow:)?codex-review-doc($|[[:space:]])|/(sd0x-dev-flow:)?review-spec($|[[:space:]])' | tail -1 || true)

  # Check review results (standard sentinel — includes doc review sentinels ✅ Mergeable / ✅ Ready)
  REVIEW_PASSED=$(echo "$CONVERSATION" | grep -E '## Gate: ✅|✅ All Pass|✅ Mergeable|✅ Ready|Gate.*PASS' | tail -1 || true)
  REVIEW_BLOCKED=$(echo "$CONVERSATION" | grep -E '## Gate: ⛔|⛔.*Block|⛔ Needs revision|⛔ Must fix|Gate.*FAIL' | tail -1 || true)

  if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
    echo "[Debug] Using transcript parsing mode" >&2
    echo "[Debug] HAS_CODE_CHANGE=${HAS_CODE_CHANGE:0:50}" >&2
    echo "[Debug] HAS_CODEX_REVIEW=$HAS_CODEX_REVIEW" >&2
    echo "[Debug] REVIEW_PASSED=${REVIEW_PASSED:0:50}" >&2
  fi
fi

# === Logic evaluation ===
MISSING="${MISSING:-}"
BLOCKED_REASON="${BLOCKED_REASON:-}"

if [[ "$USE_STATE_FILE" == "true" ]]; then
  # State file mode
  if [[ "$HAS_CODE_CHANGE" == "true" ]]; then
    # Dual mode: aggregate_gate overrides individual code_review
    if [[ "${DUAL_GATE_PASSED:-}" == "false" ]]; then
      MISSING="$MISSING /codex-review-fast"
    elif [[ -z "${DUAL_GATE_PASSED:-}" && "$CODE_REVIEW_PASSED" != "true" ]]; then
      MISSING="$MISSING /codex-review-fast"
    fi
    if [[ "$PRECOMMIT_PASSED" != "true" ]]; then
      MISSING="$MISSING /precommit"
    fi
  fi
  if [[ "$HAS_DOC_CHANGE" == "true" && "$DOC_REVIEW_PASSED" != "true" ]]; then
    MISSING="$MISSING /codex-review-doc"
  fi
else
  # Transcript parsing mode
  if [[ -n "$HAS_CODE_CHANGE" ]]; then
    if [[ -z "$HAS_CODEX_REVIEW" ]]; then
      MISSING="$MISSING /codex-review-fast"
    fi
    if [[ -z "$HAS_PRECOMMIT" ]]; then
      MISSING="$MISSING /precommit"
    fi
  fi
  if [[ -n "$HAS_DOC_CHANGE" && -z "$HAS_REVIEW_DOC" ]]; then
    MISSING="$MISSING /codex-review-doc"
  fi

  # Check if review passed — use last verdict for recency-correct detection
  # (handles fail→pass→fail re-runs: the LAST verdict wins)
  if [[ -n "$HAS_CODEX_REVIEW" || -n "$HAS_REVIEW_DOC" ]]; then
    LAST_REVIEW=$(echo "$CONVERSATION" | grep -E '## Gate: (✅|⛔)|✅ (All Pass|Mergeable|Ready)|⛔.*(Block|Needs revision|Must fix)|Gate.*(PASS|FAIL)' | tail -1 || true)
    if [[ -n "$LAST_REVIEW" ]] && echo "$LAST_REVIEW" | grep -qE '⛔|FAIL'; then
      BLOCKED_REASON="Review not passed (Blocked)"
    fi
  fi

  # D2: Check precommit result (not just execution) — scan for last ## Overall sentinel
  # Use the LAST ## Overall line to determine pass/fail (handles PASS→FAIL re-runs correctly)
  if [[ -n "$HAS_PRECOMMIT" && -z "$BLOCKED_REASON" ]]; then
    LAST_PRECOMMIT=$(echo "$CONVERSATION" | grep -E '## Overall: (✅ PASS|⛔ FAIL|❌ FAIL)' | tail -1 || true)
    if [[ -n "$LAST_PRECOMMIT" ]] && echo "$LAST_PRECOMMIT" | grep -qE '(⛔|❌) FAIL'; then
      BLOCKED_REASON="Precommit not passed (FAIL)"
    fi
  fi
fi

# === Iteration hard cap check (schema v2) — takes priority over MISSING ===
if [[ "$USE_STATE_FILE" == "true" && -f "$STATE_FILE" ]]; then
  ITER_ROUND=$(echo "$STATE" | jq -r '.iteration_history.current_round // 0' 2>/dev/null || echo 0)
  ITER_MAX=$(echo "$STATE" | jq -r '.iteration_history.max_rounds // 10' 2>/dev/null || echo 10)
  if [[ "$ITER_ROUND" -ge "$ITER_MAX" ]] 2>/dev/null; then
    # Hard cap: override MISSING — human intervention needed, not more review cycles
    MISSING=""
    BLOCKED_REASON="Max review rounds exceeded ($ITER_ROUND/$ITER_MAX) — needs human intervention"
    if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
      echo "[Debug] Iteration hard cap: round=$ITER_ROUND, max=$ITER_MAX" >&2
    fi
  fi
fi

# === Output result ===
if [[ -n "${MISSING:-}" ]]; then
  if [[ "$GUARD_MODE" == "strict" ]]; then
    echo "[Stop Guard] STRICT: Missing steps:${MISSING}" >&2
    printf '{"ok":false,"reason":"Missing required steps","description":"Execute immediately:%s, do not ask user"}\n' "${MISSING}"
    exit 2
  else
    echo "[Stop Guard] WARN: Missing steps:${MISSING} (set STOP_GUARD_MODE=strict to block)" >&2
    printf '{"ok":true,"reason":"Missing steps (warn mode):%s"}\n' "${MISSING}"
    exit 0
  fi
elif [[ -n "${BLOCKED_REASON:-}" ]]; then
  # Use cap-specific description when max rounds exceeded
  BLOCK_DESC="Fix issues and re-run review immediately, do not stop"
  if echo "${BLOCKED_REASON}" | grep -q "Max review rounds"; then
    BLOCK_DESC="Max rounds reached; escalate to human, do not auto-retry"
  fi
  if [[ "$GUARD_MODE" == "strict" ]]; then
    echo "[Stop Guard] STRICT: ${BLOCKED_REASON}" >&2
    printf '{"ok":false,"reason":"%s","description":"%s"}\n' "${BLOCKED_REASON}" "${BLOCK_DESC}"
    exit 2
  else
    echo "[Stop Guard] WARN: ${BLOCKED_REASON} (set STOP_GUARD_MODE=strict to block)" >&2
    printf '{"ok":true,"reason":"%s (warn mode)"}\n' "${BLOCKED_REASON}"
    exit 0
  fi
else
  echo "[Stop Guard] Check passed" >&2
  echo '{"ok":true,"reason":"All steps completed"}'
  exit 0
fi
