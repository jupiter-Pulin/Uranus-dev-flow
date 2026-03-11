#!/usr/bin/env bash
# worktree-claude-sync.sh — Sync .claude/ directory to a git worktree
set -euo pipefail

DRY_RUN=""
WORKTREE_PATH=""

usage() {
  cat <<'EOF'
Usage:
  worktree-claude-sync.sh <worktree-path> [--dry-run]

Syncs the .claude/ directory from the main worktree to the target worktree
using an allowlist of symlinks and file copies.

Options:
  --dry-run   Show what would be done without making changes
  -h, --help  Show this help

Exit codes:
  0   Synced successfully or skipped (see output for details)
  1   Error
  2   Invalid arguments
EOF
}

# --- args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="yes"; shift ;;
    -h|--help) usage; exit 0 ;;
    -*)  echo "Unknown option: $1" >&2; usage; exit 2 ;;
    *)
      if [[ -z "$WORKTREE_PATH" ]]; then
        WORKTREE_PATH="$1"; shift
      else
        echo "Unexpected argument: $1" >&2; usage; exit 2
      fi
      ;;
  esac
done

if [[ -z "$WORKTREE_PATH" ]]; then
  echo "Error: <worktree-path> is required" >&2
  usage
  exit 2
fi

# Resolve worktree path
if [[ ! -d "$WORKTREE_PATH" ]]; then
  echo "Error: worktree path does not exist: $WORKTREE_PATH" >&2
  exit 1
fi

WORKTREE_ROOT="$(cd "$WORKTREE_PATH" && pwd)"

# Find main worktree root via git
MAIN_ROOT=""
if command -v git >/dev/null 2>&1; then
  COMMON_DIR="$(cd "$WORKTREE_ROOT" && git rev-parse --git-common-dir 2>/dev/null || true)"
  if [[ -n "$COMMON_DIR" && "$COMMON_DIR" != ".git" ]]; then
    # COMMON_DIR is typically /path/to/main/.git — parent is main root
    MAIN_ROOT="$(cd "$WORKTREE_ROOT" && cd "$COMMON_DIR" && cd .. && pwd)"
  else
    # We're in the main worktree itself, or no common dir
    GIT_TOPLEVEL="$(cd "$WORKTREE_ROOT" && git rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$GIT_TOPLEVEL" ]]; then
      MAIN_ROOT="$GIT_TOPLEVEL"
    fi
  fi
fi

if [[ -z "$MAIN_ROOT" ]]; then
  echo "Error: cannot determine main worktree root" >&2
  exit 1
fi

SOURCE_CLAUDE="$MAIN_ROOT/.claude"
TARGET_CLAUDE="$WORKTREE_ROOT/.claude"
STAGING_DIR="$WORKTREE_ROOT/.claude-staging"

# Expected symlink targets (allowlist)
declare -A EXPECTED_TARGETS=(
  ["agents"]="../agents"
  ["commands"]="../commands"
  ["hooks"]="../hooks"
  ["rules"]="../rules"
  ["scripts"]="../scripts"
  ["skills"]="../skills"
)

SYMLINK_DIRS=("agents" "commands" "hooks" "rules" "scripts" "skills")
COPY_FILES=(".gitignore" ".sd0x-install-state.json" "settings.local.json")

# Counters
SYNCED=0
SKIPPED=0
WARNINGS=0

log_info()  { echo "[INFO] $*"; }
log_warn()  { echo "[WARN] $*"; WARNINGS=$((WARNINGS + 1)); }

# --- Segment-safe boundary check ---
# Ensures resolved path is within (or equal to) the worktree root
check_boundary() {
  local resolved="$1"
  local root_canonical="$2"
  if [[ "$resolved" == "$root_canonical" || "$resolved" == "$root_canonical/"* ]]; then
    return 0
  fi
  return 1
}

# === Guards ===

# Guard 1: source .claude/ must exist
if [[ ! -d "$SOURCE_CLAUDE" ]]; then
  log_info "Source .claude/ not found at $SOURCE_CLAUDE. Run /project-setup to initialize."
  echo ""
  echo "Status: SKIPPED_NO_SOURCE"
  exit 0
fi

# Guard 2: completed sync exists → skip
if [[ -f "$TARGET_CLAUDE/.sync-complete" ]]; then
  log_info ".claude/ already synced in worktree, skipping"
  echo ""
  echo "Status: SKIPPED"
  exit 0
fi

# Guard 3: user-managed .claude/ exists → skip (and clean stale staging if any)
if [[ -d "$TARGET_CLAUDE" ]]; then
  if [[ -d "$STAGING_DIR" ]]; then
    if [[ -z "$DRY_RUN" ]]; then
      rm -rf "$STAGING_DIR"
    fi
    log_info "Cleaned stale staging directory"
  fi
  log_info ".claude/ exists (user-managed), skipping sync"
  echo ""
  echo "Status: SKIPPED"
  exit 0
fi

# Guard 4: partial failure recovery — clean stale staging
if [[ -d "$STAGING_DIR" ]]; then
  log_warn "Previous sync incomplete, cleaning staging and retrying..."
  if [[ -z "$DRY_RUN" ]]; then
    rm -rf "$STAGING_DIR"
  fi
fi

# === Dry-run mode ===
if [[ -n "$DRY_RUN" ]]; then
  echo "=== DRY RUN ==="
  echo ""
  echo "Source: $SOURCE_CLAUDE"
  echo "Target: $TARGET_CLAUDE"
  echo ""
  echo "Would create:"
  for dir in "${SYMLINK_DIRS[@]}"; do
    echo "  symlink: .claude/$dir → ${EXPECTED_TARGETS[$dir]}"
  done
  echo "  symlink: .claude/CLAUDE.md → ../CLAUDE.md"
  for file in "${COPY_FILES[@]}"; do
    if [[ -f "$SOURCE_CLAUDE/$file" ]]; then
      echo "  copy: .claude/$file"
    fi
  done
  echo ""
  echo "Status: DRY_RUN"
  exit 0
fi

# === Sync ===
mkdir -p "$STAGING_DIR"

REPORT_LINES=()

add_report() {
  local entry="$1" strategy="$2" status="$3"
  REPORT_LINES+=("| $entry | $strategy | $status |")
}

# 1. Symlink directories (exact target validation)
ROOT_CANONICAL="$(cd "$WORKTREE_ROOT" && pwd -P)"

for dir in "${SYMLINK_DIRS[@]}"; do
  source_link="$SOURCE_CLAUDE/$dir"
  expected="${EXPECTED_TARGETS[$dir]}"

  if [[ -L "$source_link" ]]; then
    actual_target="$(readlink "$source_link")"

    if [[ "$actual_target" == "$expected" ]]; then
      # Boundary check: resolve the target from staging dir perspective
      # The target "../agents" from .claude-staging/ resolves to worktree_root/agents
      # Use cd+pwd (macOS compatible) instead of realpath -m
      target_path="$WORKTREE_ROOT/$dir"
      if [[ -e "$target_path" ]]; then
        resolved="$(cd "$target_path" && pwd -P)"
      else
        # Target doesn't exist yet — construct canonical path
        resolved="$ROOT_CANONICAL/$dir"
      fi
      if [[ -n "$resolved" ]] && check_boundary "$resolved" "$ROOT_CANONICAL"; then
        ln -s "$actual_target" "$STAGING_DIR/$dir"
        add_report "$dir → $actual_target" "symlink" "✅"
        SYNCED=$((SYNCED + 1))
      else
        log_warn "Symlink escapes worktree boundary: $dir → $actual_target (resolved: $resolved)"
        add_report "$dir" "skip" "⚠️ boundary escape"
        SKIPPED=$((SKIPPED + 1))
      fi
    else
      log_warn "Non-canonical link: $dir → $actual_target (expected: $expected)"
      log_warn "  Fix: ln -s $expected $TARGET_CLAUDE/$dir"
      log_warn "  Or:  cp -R $source_link $TARGET_CLAUDE/$dir"
      add_report "$dir → $actual_target" "skip" "⚠️ non-canonical"
      SKIPPED=$((SKIPPED + 1))
    fi
  elif [[ -d "$source_link" ]]; then
    log_warn "Expected symlink but found directory: $dir"
    add_report "$dir" "skip" "⚠️ expected symlink"
    SKIPPED=$((SKIPPED + 1))
  else
    add_report "$dir" "skip" "not found"
    SKIPPED=$((SKIPPED + 1))
  fi
done

# 2. Special symlinks: CLAUDE.md → ../CLAUDE.md
CLAUDE_MD_TARGET="../CLAUDE.md"
CLAUDE_MD_RESOLVED="$WORKTREE_ROOT/CLAUDE.md"

if [[ -f "$CLAUDE_MD_RESOLVED" ]]; then
  ln -s "$CLAUDE_MD_TARGET" "$STAGING_DIR/CLAUDE.md"
  add_report "CLAUDE.md → $CLAUDE_MD_TARGET" "symlink" "✅"
  SYNCED=$((SYNCED + 1))
else
  # Fallback: copy from source .claude/CLAUDE.md
  if [[ -f "$SOURCE_CLAUDE/CLAUDE.md" ]]; then
    cp "$SOURCE_CLAUDE/CLAUDE.md" "$STAGING_DIR/CLAUDE.md"
    add_report "CLAUDE.md" "copy (fallback)" "✅"
    SYNCED=$((SYNCED + 1))
  else
    add_report "CLAUDE.md" "skip" "not found"
    SKIPPED=$((SKIPPED + 1))
  fi
fi

# 3. Copy files
for file in "${COPY_FILES[@]}"; do
  source_file="$SOURCE_CLAUDE/$file"
  if [[ -f "$source_file" ]]; then
    cp "$source_file" "$STAGING_DIR/$file"
    add_report "$file" "copy" "✅"
    SYNCED=$((SYNCED + 1))
  else
    add_report "$file" "skip" "not found"
    SKIPPED=$((SKIPPED + 1))
  fi
done

# 4. Atomic commit: touch marker → rename staging → .claude
touch "$STAGING_DIR/.sync-complete"
mv "$STAGING_DIR" "$TARGET_CLAUDE"

# === Output Report ===
echo ""
echo "## .claude/ Sync Report"
echo ""
echo "| Entry | Strategy | Status |"
echo "|-------|----------|--------|"
for line in "${REPORT_LINES[@]}"; do
  echo "$line"
done
echo ""
echo "**Synced**: $SYNCED / **Skipped**: $SKIPPED / **Warnings**: $WARNINGS"

# settings.local.json hint
if [[ -f "$TARGET_CLAUDE/settings.local.json" ]]; then
  echo ""
  echo "settings.local.json copied (isolated). To share: ln -sf $SOURCE_CLAUDE/settings.local.json $TARGET_CLAUDE/settings.local.json"
fi

echo ""
echo "Status: SYNCED"
exit 0
