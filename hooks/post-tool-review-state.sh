#!/usr/bin/env bash
# PostToolUse Hook: Parse review command output, update state file
# Trigger condition: Bash tool executes review/precommit commands

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

STATE_FILE=".claude_review_state.json"

# === Portable mkdir locking (macOS has no flock) ===
LOCKDIR="${STATE_FILE}.lockdir"
LOCK_TIMEOUT=5
LOCK_TTL=30
HAVE_LOCK=0

_lock() {
  local start end
  start=$(date +%s)
  while ! mkdir "$LOCKDIR" 2>/dev/null; do
    end=$(date +%s)
    if [ $((end - start)) -ge $LOCK_TIMEOUT ]; then
      local lock_pid lock_ts now
      lock_pid=$(cat "$LOCKDIR/pid" 2>/dev/null || echo 0)
      lock_ts=$(cat "$LOCKDIR/ts" 2>/dev/null || echo 0)
      now=$(date +%s)
      # Stale recovery: TTL expired OR owner PID dead
      if [ $((now - lock_ts)) -ge $LOCK_TTL ] || ! kill -0 "$lock_pid" 2>/dev/null; then
        rm -rf "$LOCKDIR" 2>/dev/null
        mkdir "$LOCKDIR" 2>/dev/null && break
      fi
      return 1  # fail-closed
    fi
    sleep 0.1
  done
  echo "$$" > "$LOCKDIR/pid"
  date +%s > "$LOCKDIR/ts"
  HAVE_LOCK=1
}

_unlock() {
  [ "$HAVE_LOCK" -eq 1 ] && rm -rf "$LOCKDIR" 2>/dev/null
  HAVE_LOCK=0
}

trap '_unlock' EXIT

# Read JSON input from stdin
INPUT=$(cat)

# Check if jq is available
if ! command -v jq &> /dev/null; then
  exit 0
fi

# Extract tool info
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty' 2>/dev/null)
TOOL_OUTPUT=$(echo "$INPUT" | jq -r '.tool_output // empty' 2>/dev/null)

# Only process Bash, MCP Codex, and Skill tools
if [[ "$TOOL_NAME" != "Bash" ]] && \
   [[ "$TOOL_NAME" != "mcp__codex__codex" ]] && \
   [[ "$TOOL_NAME" != "mcp__codex__codex-reply" ]] && \
   [[ "$TOOL_NAME" != "Skill" ]]; then
  exit 0
fi

# Extract command (Bash), skill name (Skill), or output (MCP)
if [[ "$TOOL_NAME" == "Bash" ]]; then
  COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)
elif [[ "$TOOL_NAME" == "Skill" ]]; then
  # Skill tool — extract skill name as command, tool_output is the skill's text output
  COMMAND=$(echo "$TOOL_INPUT" | jq -r '.skill // empty' 2>/dev/null)
else
  # MCP tool — extract text from tool_output.content (string) or content[].text (array)
  # Guard: tool_output must be an object to access .content; fall back to string if not
  COMMAND=""
  TOOL_OUTPUT=$(echo "$INPUT" | jq -r '
    if (.tool_output | type) == "object" then
      if (.tool_output.content | type) == "string" then .tool_output.content
      elif (.tool_output.content | type) == "array" then [.tool_output.content[] | select(.type == "text") | .text] | join("\n")
      else (.tool_output | tostring)
      end
    elif (.tool_output | type) == "string" then .tool_output
    else empty
    end // empty' 2>/dev/null)
fi

# Initialize state file (if not exists)
init_state_file() {
  if [[ ! -f "$STATE_FILE" ]]; then
    cat > "$STATE_FILE" << 'EOF'
{
  "session_id": "",
  "updated_at": "",
  "review_mode": "single",
  "has_code_change": false,
  "has_doc_change": false,
  "code_review": {"executed": false, "passed": false, "last_run": ""},
  "doc_review": {"executed": false, "passed": false, "last_run": ""},
  "precommit": {"executed": false, "passed": false, "last_run": ""},
  "aggregate_gate": {"executed": false, "gate": null, "source": null, "reason": null, "last_run": ""},
  "schema_version": 2,
  "iteration_history": {"current_round": 0, "max_rounds": 10, "findings_by_round": [], "total_rounds_session": 0, "strategic_reset_fired": false}
}
EOF
  fi
}

# Read max_rounds override from project config (R6)
_read_project_max_rounds() {
  local default_val="${1:-10}"
  local rf val
  for rf in "rules/auto-loop-project.md" ".claude/rules/auto-loop-project.md"; do
    [[ ! -f "$rf" ]] && continue
    val=$(grep -v '<!--' "$rf" 2>/dev/null | grep -A1 '## Max Rounds' | tail -1 | tr -d ' ')
    if [[ "$val" =~ ^[0-9]+$ && "$val" -ge 3 && "$val" -le 50 ]]; then
      echo "$val"; return
    fi
  done
  echo "$default_val"
}

# Migrate state file to schema v2 (add iteration_history if missing)
_migrate_state_v2() {
  local state_file="${1:-$STATE_FILE}"
  [[ ! -f "$state_file" ]] && return 0
  local ver
  ver=$(jq -r '.schema_version // 1' "$state_file" 2>/dev/null || echo 1)
  if [[ "$ver" -lt 2 ]]; then
    local tmp
    tmp=$(mktemp)
    local mr
    mr=$(_read_project_max_rounds 10)
    jq --argjson mr "$mr" '.schema_version = 2
      | .iteration_history //= {"current_round": 0, "max_rounds": $mr, "findings_by_round": [], "total_rounds_session": 0, "strategic_reset_fired": false}' \
      "$state_file" > "$tmp" && mv "$tmp" "$state_file"
  fi
}

# Update state file (acquires lock for consistency with aggregate_gate writes)
update_state() {
  local key="$1"
  local executed="$2"
  local passed="$3"

  if _lock; then
    init_state_file

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update using jq
    local tmp
    tmp=$(mktemp)
    if jq --arg key "$key" \
       --argjson executed "$executed" \
       --argjson passed "$passed" \
       --arg now "$now" \
       '.[$key].executed = $executed | .[$key].passed = $passed | .[$key].last_run = $now | .updated_at = $now' \
       "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"; then
      # Successful locked write → state is consistent, clear stale sidecar
      rm -f "${STATE_FILE}.blocked" 2>/dev/null || true
    fi
    _unlock
  else
    # Fail-open for review state (not as critical as aggregate gate)
    init_state_file
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local tmp
    tmp=$(mktemp)
    jq --arg key "$key" \
       --argjson executed "$executed" \
       --argjson passed "$passed" \
       --arg now "$now" \
       '.[$key].executed = $executed | .[$key].passed = $passed | .[$key].last_run = $now | .updated_at = $now' \
       "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE" 2>/dev/null || true
  fi
}

# Update iteration history (extract finding counts from review output)
_update_iteration() {
  local tool_output="$1"
  local state_file="${2:-$STATE_FILE}"
  [[ ! -f "$state_file" ]] && return 0

  local p0_count p1_count p2_count nit_count total

  # Dual-format parsing: tag-based [P0] AND section-based #### P0
  # grep -c exits 1 on no match but still outputs "0"; use subshell to isolate
  p0_count=$(echo "$tool_output" | grep -cE '^\- \[P0\]|^#### P0' 2>/dev/null) || p0_count=0
  p1_count=$(echo "$tool_output" | grep -cE '^\- \[P1\]|^#### P1' 2>/dev/null) || p1_count=0
  p2_count=$(echo "$tool_output" | grep -cE '^\- \[P2\]|^#### P2' 2>/dev/null) || p2_count=0
  nit_count=$(echo "$tool_output" | grep -cE '^\- \[Nit\]|^#### Nit' 2>/dev/null) || nit_count=0
  total=$((p0_count + p1_count + p2_count + nit_count))

  local now tmp
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Acquire lock for state file write (consistent with update_state)
  if _lock; then
    _migrate_state_v2 "$state_file"
    tmp=$(mktemp)
    if jq --argjson total "$total" --argjson p0 "$p0_count" \
       --argjson p1 "$p1_count" --argjson p2 "$p2_count" \
       --argjson nit "$nit_count" --arg now "$now" \
       '.iteration_history.current_round += 1 |
        .iteration_history.total_rounds_session = ((.iteration_history.total_rounds_session // 0) + 1) |
        .iteration_history.findings_by_round += [{"round": (.iteration_history.current_round), "total": $total, "p0": $p0, "p1": $p1, "p2": $p2, "nit": $nit, "timestamp": $now}] |
        .updated_at = $now' \
       "$state_file" > "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
      mv "$tmp" "$state_file"
      if [[ "${HOOK_DEBUG:-}" == "1" ]]; then
        echo "[Review State] Iteration updated: total=$total (p0=$p0_count p1=$p1_count p2=$p2_count nit=$nit_count)" >&2
      fi
    else
      rm -f "$tmp" 2>/dev/null
      echo "[Review State] Iteration update skipped (jq write failed)" >&2
    fi
    _unlock
  else
    echo "[Review State] Iteration update skipped (lock contention)" >&2
  fi
}

# Reset changed files array on review pass (D-3)
_reset_changed_files() {
  [[ ! -f "$STATE_FILE" ]] && return 0
  local tmp
  tmp=$(mktemp)
  if jq '.changed_files_since_review = []' "$STATE_FILE" > "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
    mv "$tmp" "$STATE_FILE"
  else
    rm -f "$tmp" 2>/dev/null
  fi
  return 0
}

# === Nit History Persistence (R4) ===
NIT_HISTORY_FILE=".claude_nit_history.json"
NIT_LOCKDIR="${NIT_HISTORY_FILE}.lockdir"
NIT_HAVE_LOCK=0

_nit_lock() {
  local start end
  start=$(date +%s)
  while ! mkdir "$NIT_LOCKDIR" 2>/dev/null; do
    end=$(date +%s)
    if [ $((end - start)) -ge 3 ]; then
      # Stale recovery
      local lock_ts
      lock_ts=$(cat "$NIT_LOCKDIR/ts" 2>/dev/null || echo 0)
      local now
      now=$(date +%s)
      if [ $((now - lock_ts)) -ge 10 ]; then
        rm -rf "$NIT_LOCKDIR" 2>/dev/null
        mkdir "$NIT_LOCKDIR" 2>/dev/null && break
      fi
      return 1
    fi
    sleep 0.1
  done
  echo "$$" > "$NIT_LOCKDIR/pid" 2>/dev/null
  date +%s > "$NIT_LOCKDIR/ts" 2>/dev/null
  NIT_HAVE_LOCK=1
}

_nit_unlock() {
  [ "$NIT_HAVE_LOCK" -eq 1 ] && rm -rf "$NIT_LOCKDIR" 2>/dev/null
  NIT_HAVE_LOCK=0
}

_canonicalize_issue() {
  local issue="$1"
  printf '%s' "$issue" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[[:space:]]+/ /g' \
    | sed -E 's/line [0-9]+//gi' \
    | sed -E 's/[0-9]+/N/g' \
    | sed -E 's/\*\*//g; s/`//g; s/#//g; s/>//g; s/\|//g' \
    | cut -c1-120 \
    | sed 's/[[:space:]]*$//'
}

_compute_hash() {
  local file="$1" issue="$2"
  local canonical
  canonical=$(_canonicalize_issue "$issue")
  local key="${file}|${canonical}"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$key" | shasum -a 256 | cut -c1-16
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$key" | sha256sum | cut -c1-16
  else
    # Fallback: use cksum-based pseudo-hash (less ideal but functional)
    printf '%s' "$key" | od -A n -t x1 | tr -d ' \n' | cut -c1-16
  fi
}

_init_nit_history() {
  local nit_file="${1:-$NIT_HISTORY_FILE}"
  if [[ ! -f "$nit_file" ]]; then
    printf '{"schema_version":1,"deferred":[],"dismissed_via_verdict":[]}\n' > "$nit_file"
  fi
  # Validate JSON; recreate if corrupted
  if ! jq empty "$nit_file" 2>/dev/null; then
    echo "[Nit History] Corrupted file, recreating" >&2
    printf '{"schema_version":1,"deferred":[],"dismissed_via_verdict":[]}\n' > "$nit_file"
  fi
}

_gc_nit_history() {
  local nit_file="${1:-$NIT_HISTORY_FILE}"
  [[ ! -f "$nit_file" ]] && return 0
  local now_epoch tmp
  now_epoch=$(date +%s)
  tmp=$(mktemp)
  if jq --argjson now "$now_epoch" '
    .deferred |= [.[] | select(
      ((.last_seen | sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) + (.ttl_days * 86400)) > $now
    )] |
    .dismissed_via_verdict |= [.[] | select(
      ((.timestamp | sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) + (.ttl_days * 86400)) > $now
    )]
  ' "$nit_file" > "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
    mv "$tmp" "$nit_file"
  else
    rm -f "$tmp" 2>/dev/null
  fi
}

_upsert_nit_deferred() {
  local sentinel_line="$1"
  local nit_file="${2:-$NIT_HISTORY_FILE}"

  # Parse: [NIT_DEFERRED] file:line | issue | reason: <reason> | <timestamp>
  local file_with_line issue reason
  file_with_line=$(printf '%s' "$sentinel_line" | sed -E 's/^\[NIT_DEFERRED\][[:space:]]*//' | cut -d'|' -f1 | sed 's/[[:space:]]*$//')
  issue=$(printf '%s' "$sentinel_line" | cut -d'|' -f2 | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  reason=$(printf '%s' "$sentinel_line" | cut -d'|' -f3 | sed 's/^[[:space:]]*reason:[[:space:]]*//; s/[[:space:]]*$//')

  # Strip :line from file path
  local file_path
  file_path=$(printf '%s' "$file_with_line" | sed -E 's/:[0-9]+$//')

  # Security: reject paths with shell metacharacters
  if printf '%s' "$file_path" | grep -qE '[;&|`]' || printf '%s' "$file_path" | grep -qE '\$\('; then
    echo "[Nit History] Rejected suspicious file path" >&2
    return 0
  fi
  if printf '%s' "$issue" | grep -qE '[;&`]' || printf '%s' "$issue" | grep -qE '\$\('; then
    echo "[Nit History] Rejected suspicious issue text" >&2
    return 0
  fi

  [[ -z "$file_path" || -z "$issue" ]] && return 0

  local hash
  hash=$(_compute_hash "$file_path" "$issue")
  [[ -z "$hash" ]] && return 0

  _init_nit_history "$nit_file"

  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local tmp
  tmp=$(mktemp)
  if jq --arg hash "$hash" --arg file "$file_path" --arg issue "$(_canonicalize_issue "$issue")" \
     --arg reason "${reason:-unknown}" --arg now "$now" '
    if (.deferred | map(.hash) | index($hash)) then
      .deferred |= map(if .hash == $hash then .defer_count += 1 | .last_seen = $now else . end)
    else
      .deferred += [{
        "hash": $hash,
        "file": $file,
        "severity": "Nit",
        "canonical_issue": $issue,
        "reason": $reason,
        "defer_count": 1,
        "first_seen": $now,
        "last_seen": $now,
        "ttl_days": 14
      }]
    end
  ' "$nit_file" > "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
    mv "$tmp" "$nit_file"
  else
    rm -f "$tmp" 2>/dev/null
    echo "[Nit History] Upsert failed (jq error)" >&2
    return 0
  fi

  _gc_nit_history "$nit_file"
  echo "[Nit History] Deferred: hash=$hash file=$file_path" >&2
}

_upsert_dismiss_verdict() {
  local sentinel_line="$1"
  local nit_file="${2:-$NIT_HISTORY_FILE}"

  # Parse key=value pairs from [DISMISS_VERDICT] line
  # Key format: key=file|issue — contains | which is also the field delimiter (space-pipe-space)
  # Parse key= up to " | severity=" boundary to preserve the file|issue structure
  local key_field severity verdict confidence timestamp
  key_field=$(printf '%s' "$sentinel_line" | sed -E 's/.*key=([^|]+\|[^|]+) \| severity=.*/\1/' | sed 's/[[:space:]]*$//')
  severity=$(printf '%s' "$sentinel_line" | grep -oE 'severity=[^|]+' | sed 's/^severity=//' | sed 's/[[:space:]]*$//')
  verdict=$(printf '%s' "$sentinel_line" | grep -oE 'verdict=[^|]+' | sed 's/^verdict=//' | sed 's/[[:space:]]*$//')
  confidence=$(printf '%s' "$sentinel_line" | grep -oE 'confidence=[^|]+' | sed 's/^confidence=//' | sed 's/[[:space:]]*$//')
  timestamp=$(printf '%s' "$sentinel_line" | grep -oE 'timestamp=[^|]+' | sed 's/^timestamp=//' | sed 's/[[:space:]]*$//')

  # Extract file from key (format: file|issue)
  local file_path issue_text
  file_path=$(printf '%s' "$key_field" | cut -d'|' -f1 | sed 's/[[:space:]]*$//')
  issue_text=$(printf '%s' "$key_field" | cut -d'|' -f2- | sed 's/^[[:space:]]*//')

  [[ -z "$file_path" || -z "$verdict" ]] && return 0

  local hash
  hash=$(_compute_hash "$file_path" "$issue_text")
  [[ -z "$hash" ]] && return 0

  _init_nit_history "$nit_file"

  local now
  now="${timestamp:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

  local tmp
  tmp=$(mktemp)
  if jq --arg hash "$hash" --arg file "$file_path" --arg severity "${severity:-unknown}" \
     --arg verdict "$verdict" --arg confidence "${confidence:-0}" --arg now "$now" '
    if (.dismissed_via_verdict | map(.hash) | index($hash)) then
      .dismissed_via_verdict |= map(if .hash == $hash then .verdict = $verdict | .confidence = ($confidence | tonumber) | .timestamp = $now else . end)
    else
      .dismissed_via_verdict += [{
        "hash": $hash,
        "file": $file,
        "severity": $severity,
        "verdict": $verdict,
        "confidence": ($confidence | tonumber),
        "timestamp": $now,
        "ttl_days": 30
      }]
    end
  ' "$nit_file" > "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
    mv "$tmp" "$nit_file"
  else
    rm -f "$tmp" 2>/dev/null
    echo "[Nit History] Dismiss verdict upsert failed (jq error)" >&2
    return 0
  fi

  _gc_nit_history "$nit_file"
  echo "[Nit History] Dismissed: hash=$hash verdict=$verdict" >&2
}

_parse_nit_sentinels() {
  local tool_output="$1"
  local nit_file="${2:-$NIT_HISTORY_FILE}"

  # Acquire nit history lock for batch write
  if ! _nit_lock; then
    echo "[Nit History] Lock contention, skipping sentinel parse" >&2
    return 0
  fi

  # Parse [NIT_DEFERRED] sentinels
  while IFS= read -r line; do
    [[ -n "$line" ]] && _upsert_nit_deferred "$line" "$nit_file"
  done < <(printf '%s' "$tool_output" | grep '^\[NIT_DEFERRED\]' 2>/dev/null || true)

  # Parse [DISMISS_VERDICT] sentinels
  while IFS= read -r line; do
    [[ -n "$line" ]] && _upsert_dismiss_verdict "$line" "$nit_file"
  done < <(printf '%s' "$tool_output" | grep '^\[DISMISS_VERDICT\]' 2>/dev/null || true)

  _nit_unlock
}

# Check for pass markers (anchored to line start to avoid false positives in error messages)
check_passed() {
  local output="$1"
  # Primary: anchored markers (most reliable)
  if echo "$output" | grep -qE '^## Gate: ✅|^✅ All Pass|^## Overall: ✅ PASS'; then
    echo "true"
  # Fallback: unanchored but only if no error/fail context on same line
  elif echo "$output" | grep -E '## Gate: ✅|✅ All Pass' | grep -qvE 'Error|Failed|FAIL'; then
    echo "true"
  else
    echo "false"
  fi
}

# D-5: Parse review gate with JSON-first, text sentinel fallback
# Conflict policy: JSON READY + text BLOCKED → fail-closed BLOCKED
_parse_review_gate() {
  local output="$1"
  local json_gate text_gate

  # Try JSON block: look for {"gate":"READY"} or {"gate":"BLOCKED"}
  json_gate=$(echo "$output" | sed -n '/```json/,/```/p' | sed '1d;$d' | jq -r '.gate // empty' 2>/dev/null || true)

  # Text sentinel
  text_gate=$(check_passed "$output")

  if [[ -n "$json_gate" ]]; then
    local json_result="false"
    [[ "$json_gate" == "READY" ]] && json_result="true"
    # Conflict resolution: if JSON says READY but text says BLOCKED → fail-closed
    if [[ "$json_result" == "true" && "$text_gate" == "false" ]]; then
      echo "false"  # fail-closed
    else
      echo "$json_result"
    fi
  else
    echo "$text_gate"  # fallback to text sentinel
  fi
}

# Update aggregate_gate in state file (call within lock)
update_aggregate_gate() {
  local gate_value="$1"

  init_state_file

  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local tmp
  tmp=$(mktemp)
  case "$gate_value" in
    PENDING)
      jq --arg now "$now" \
         '.review_mode = "dual" | .aggregate_gate.executed = false | .aggregate_gate.gate = null | .aggregate_gate.source = null | .aggregate_gate.reason = null | .aggregate_gate.last_run = $now | .updated_at = $now | .review_phase = "pending_review"' \
         "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
      ;;
    READY)
      jq --arg gate "$gate_value" --arg now "$now" \
         '.aggregate_gate.executed = true | .aggregate_gate.gate = $gate | .aggregate_gate.reason = null | .aggregate_gate.last_run = $now | .updated_at = $now | .review_phase = "precommit_pending"' \
         "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
      ;;
    BLOCKED)
      jq --arg gate "$gate_value" --arg now "$now" \
         '.aggregate_gate.executed = true | .aggregate_gate.gate = $gate | .aggregate_gate.reason = null | .aggregate_gate.last_run = $now | .updated_at = $now | .review_phase = "addressing_findings"' \
         "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
      ;;
  esac
  # Clear sidecar marker on successful locked write (supersedes any prior lock-failure marker)
  rm -f "${STATE_FILE}.blocked" 2>/dev/null || true
}

# Best-effort blocked write (used when lock fails — no lock held)
# Uses both: (1) unlocked JSON write (best-effort) + (2) atomic sidecar marker (race-safe)
update_aggregate_blocked() {
  local reason="${1:-unknown}"
  # Atomic sidecar marker: stop-guard checks this file as fail-closed fallback
  echo "$reason" > "${STATE_FILE}.blocked" 2>/dev/null || true
  # Best-effort JSON write (may race, but sidecar guarantees fail-closed)
  init_state_file
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local tmp
  tmp=$(mktemp)
  jq --arg reason "$reason" --arg now "$now" \
     '.review_mode = "dual" | .aggregate_gate.executed = true | .aggregate_gate.gate = "BLOCKED" | .aggregate_gate.reason = $reason | .aggregate_gate.last_run = $now | .updated_at = $now' \
     "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE" 2>/dev/null || true
}

# === Process different commands ===

# === emit-review-gate parse branch ===
if [[ "$TOOL_NAME" == "Bash" ]] && echo "$COMMAND" | grep -qE 'emit-review-gate'; then
  GATE_VALUE=$(echo "$TOOL_OUTPUT" | grep -oE '^REVIEW_GATE=(PENDING|READY|BLOCKED)' | tail -1 | cut -d= -f2)
  if [[ -n "$GATE_VALUE" ]]; then
    _lock || { update_aggregate_blocked "lock_failure"; echo "[Review State] Lock failed, fail-closed BLOCKED (reason: lock_failure)" >&2; exit 0; }
    update_aggregate_gate "$GATE_VALUE"
    _unlock
    echo "[Review State] aggregate_gate updated: gate=$GATE_VALUE" >&2
  fi
fi

# /codex-review-fast or /codex-review (also matches Skill name: sd0x-dev-flow:codex-review-fast)
if echo "$COMMAND" | grep -qE '/?(sd0x-dev-flow:)?codex-review(-fast)?($|\s)'; then
  passed=$(_parse_review_gate "$TOOL_OUTPUT")
  update_state "code_review" "true" "$passed"
  [[ "$passed" == "true" ]] && { _reset_changed_files || true; }
  _update_iteration "$TOOL_OUTPUT" "$STATE_FILE"
  echo "[Review State] code_review updated: passed=$passed" >&2
fi

# /codex-review-doc or /review-spec (also matches Skill name form)
if echo "$COMMAND" | grep -qE '/?(sd0x-dev-flow:)?codex-review-doc($|[[:space:]])|/?(sd0x-dev-flow:)?review-spec($|[[:space:]])'; then
  passed=$(check_passed "$TOOL_OUTPUT")
  update_state "doc_review" "true" "$passed"
  echo "[Review State] doc_review updated: passed=$passed" >&2
fi

# /precommit or /precommit-fast (also matches Skill name form)
if echo "$COMMAND" | grep -qE '/?(sd0x-dev-flow:)?precommit(-fast)?($|\s)'; then
  passed=$(check_passed "$TOOL_OUTPUT")
  update_state "precommit" "true" "$passed"
  if [[ "$passed" == "true" ]]; then
    ( _phase_tmp=$(mktemp)
      if jq '.review_phase = "idle"' "$STATE_FILE" > "$_phase_tmp" 2>/dev/null && [[ -s "$_phase_tmp" ]]; then
        mv "$_phase_tmp" "$STATE_FILE"
      else rm -f "$_phase_tmp" 2>/dev/null; fi
    ) 2>/dev/null || true
  fi
  echo "[Review State] precommit updated: passed=$passed" >&2
fi

# === MCP sentinel routing (no command to parse) ===
if [[ "$TOOL_NAME" == "mcp__codex__codex" || "$TOOL_NAME" == "mcp__codex__codex-reply" ]]; then
  # Priority 1: doc-specific (require ## Document Review section header to avoid collision with security reviews)
  if echo "$TOOL_OUTPUT" | grep -qE '## Document Review' && echo "$TOOL_OUTPUT" | grep -qE '✅ Mergeable'; then
    update_state "doc_review" "true" "true"
    echo "[Review State] doc_review updated (MCP): passed=true" >&2
  elif echo "$TOOL_OUTPUT" | grep -qE '## Document Review' && echo "$TOOL_OUTPUT" | grep -qE '⛔ Needs revision'; then
    update_state "doc_review" "true" "false"
    echo "[Review State] doc_review updated (MCP): passed=false" >&2
  # Priority 2: code-specific
  elif echo "$TOOL_OUTPUT" | grep -qE '✅ Ready'; then
    update_state "code_review" "true" "true"
    _reset_changed_files || true
    _update_iteration "$TOOL_OUTPUT" "$STATE_FILE"
    echo "[Review State] code_review updated (MCP): passed=true" >&2
  elif echo "$TOOL_OUTPUT" | grep -qE '⛔ Blocked'; then
    update_state "code_review" "true" "false"
    _update_iteration "$TOOL_OUTPUT" "$STATE_FILE"
    echo "[Review State] code_review updated (MCP): passed=false" >&2
  # Priority 3: precommit
  elif echo "$TOOL_OUTPUT" | grep -qE '## Overall: ✅ PASS'; then
    update_state "precommit" "true" "true"
    ( _phase_tmp=$(mktemp)
      if jq '.review_phase = "idle"' "$STATE_FILE" > "$_phase_tmp" 2>/dev/null && [[ -s "$_phase_tmp" ]]; then
        mv "$_phase_tmp" "$STATE_FILE"
      else rm -f "$_phase_tmp" 2>/dev/null; fi
    ) 2>/dev/null || true
    echo "[Review State] precommit updated (MCP): passed=true" >&2
  elif echo "$TOOL_OUTPUT" | grep -qE '## Overall: (⛔ FAIL|❌ FAIL)'; then
    update_state "precommit" "true" "false"
    echo "[Review State] precommit updated (MCP): passed=false" >&2
  # Priority 4: generic
  elif echo "$TOOL_OUTPUT" | grep -qE '✅ All Pass'; then
    update_state "code_review" "true" "true"
    _reset_changed_files || true
    echo "[Review State] code_review updated (MCP): passed=true" >&2
  fi
  # Bare ## Gate: ✅/⛔ alone → skip (ambiguity rule)
fi

# === Nit sentinel routing ===
# [NIT_DEFERRED] and [DISMISS_VERDICT] appear in code review and seek-verdict output.
# Restrict to known producers to avoid pollution from template/doc content.
_NIT_ELIGIBLE=false
if [[ "$TOOL_NAME" == "mcp__codex__codex" || "$TOOL_NAME" == "mcp__codex__codex-reply" ]]; then
  _NIT_ELIGIBLE=true
elif [[ "$TOOL_NAME" == "Skill" ]] && echo "$COMMAND" | grep -qE '(codex-review|seek-verdict|codex-cli-review)'; then
  # Skill tool: restrict to known nit sentinel producers
  _NIT_ELIGIBLE=true
elif [[ "$TOOL_NAME" == "Bash" ]] && echo "$COMMAND" | grep -qE '/(sd0x-dev-flow:)?(codex-review|seek-verdict|codex-cli-review)'; then
  _NIT_ELIGIBLE=true
fi
if [[ "$_NIT_ELIGIBLE" == "true" ]] && printf '%s' "$TOOL_OUTPUT" | grep -qE '^\[NIT_DEFERRED\]|^\[DISMISS_VERDICT\]' 2>/dev/null; then
  _parse_nit_sentinels "$TOOL_OUTPUT"
fi

exit 0
