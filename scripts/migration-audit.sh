#!/usr/bin/env bash
# migration-audit.sh — Audit command/skill parity gap
# Outputs JSON inventory to stdout or file
#
# Usage: bash scripts/migration-audit.sh [--output <path>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMANDS_DIR="$PROJECT_ROOT/commands"
SKILLS_DIR="$PROJECT_ROOT/skills"

OUTPUT_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Collect command names (strip .md extension)
# Uses while-read instead of mapfile for macOS Bash 3.2 compatibility
COMMANDS=()
while IFS= read -r name; do
  COMMANDS+=("$name")
done < <(find "$COMMANDS_DIR" -maxdepth 1 -name '*.md' -exec basename {} .md \; | sort)

# Collect skill names (directory names under skills/)
SKILLS=()
while IFS= read -r name; do
  SKILLS+=("$name")
done < <(find "$SKILLS_DIR" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; | sort)

# Find gaps: commands without matching skills
MISSING=()
for cmd in "${COMMANDS[@]}"; do
  found=0
  for skill in "${SKILLS[@]}"; do
    if [[ "$cmd" == "$skill" ]]; then
      found=1
      break
    fi
  done
  if [[ $found -eq 0 ]]; then
    MISSING+=("$cmd")
  fi
done

# Skills that intentionally have no same-name command (parent/shared skills).
# These are not defects — they serve as delegation targets for B1 alias skills.
KNOWN_PARENT_SKILLS=(
  "codex-code-review" "doc-review" "security-review" "test-review"
  "dev-security-audit" "portfolio" "req-analyze" "request-tracking"
)

is_known_parent() {
  local name="$1"
  for kp in "${KNOWN_PARENT_SKILLS[@]}"; do
    [[ "$name" == "$kp" ]] && return 0
  done
  return 1
}

# Find orphans: skills without matching commands (excluding known parents)
ORPHANS=()
for skill in "${SKILLS[@]}"; do
  is_known_parent "$skill" && continue
  found=0
  for cmd in "${COMMANDS[@]}"; do
    if [[ "$skill" == "$cmd" ]]; then
      found=1
      break
    fi
  done
  if [[ $found -eq 0 ]]; then
    ORPHANS+=("$skill")
  fi
done

# Build JSON output
json_array() {
  if [[ $# -eq 0 ]]; then
    echo "[]"
    return
  fi
  local result="["
  local first=1
  for item in "$@"; do
    if [[ $first -eq 1 ]]; then
      first=0
    else
      result+=","
    fi
    result+="\"$item\""
  done
  result+="]"
  echo "$result"
}

COMMANDS_COUNT=${#COMMANDS[@]}
SKILLS_COUNT=${#SKILLS[@]}
MISSING_COUNT=${#MISSING[@]}
ORPHANS_COUNT=${#ORPHANS[@]}
MATCHED_COUNT=$((COMMANDS_COUNT - MISSING_COUNT))

JSON=$(cat <<EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "summary": {
    "commands_total": $COMMANDS_COUNT,
    "skills_total": $SKILLS_COUNT,
    "matched": $MATCHED_COUNT,
    "missing_skills": $MISSING_COUNT,
    "orphan_skills": $ORPHANS_COUNT,
    "parity_achieved": $([ "$MISSING_COUNT" -eq 0 ] && echo "true" || echo "false")
  },
  "missing_skills": $(json_array ${MISSING[@]+"${MISSING[@]}"}),
  "orphan_skills": $(json_array ${ORPHANS[@]+"${ORPHANS[@]}"})
}
EOF
)

if [[ -n "$OUTPUT_FILE" ]]; then
  echo "$JSON" > "$OUTPUT_FILE"
  echo "Wrote inventory to $OUTPUT_FILE" >&2
  echo "Gap: $MISSING_COUNT commands without matching skills" >&2
else
  echo "$JSON"
fi
