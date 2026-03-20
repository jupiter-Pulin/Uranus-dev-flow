#!/usr/bin/env bash
# Resolve current feature context and output JSON.
# Usage: bash scripts/resolve-feature.sh [--feature <key>]
#
# Output: JSON with fields: key, source, confidence, docs_path, has_tech_spec, has_requests
# Exit 0 on success (outputs {} on error).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Forward all args to the Node.js resolver CLI
node "$SCRIPT_DIR/resolve-feature-cli.js" "$@" 2>/dev/null || echo '{}'
