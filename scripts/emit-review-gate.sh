#!/usr/bin/env bash
# emit-review-gate.sh — Emit a machine-readable review gate sentinel
# Will be consumed by hooks/post-tool-review-state.sh (W3) to update aggregate_gate state.
#
# Usage: bash scripts/emit-review-gate.sh PENDING|READY|BLOCKED
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: emit-review-gate.sh PENDING|READY|BLOCKED" >&2
  exit 1
fi

GATE="$1"

case "$GATE" in
  PENDING|READY|BLOCKED)
    echo "REVIEW_GATE=$GATE"
    ;;
  *)
    echo "Error: invalid gate value '$GATE'. Must be PENDING, READY, or BLOCKED." >&2
    exit 1
    ;;
esac
