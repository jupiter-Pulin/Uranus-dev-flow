---
description: Context-aware test orchestration. Maps git changes to tests, runs progressive ladder (unit→integration→e2e), triages failures, applies safety-gated fixers.
argument-hint: [--all] [--layer <unit|integration|e2e>] [--no-fail-fast] [--no-fix] [--focus <path>] [--branch]
allowed-tools: Read, Grep, Glob, Bash, Write
---

**Must read and follow the skill below before executing this command:**

@skills/test-deep/SKILL.md
@skills/test-deep/references/test-selection.md
@skills/test-deep/references/triage-pipeline.md
@skills/test-deep/references/fixer-catalog.md

## Context

- Git status: !`git status -sb`
- Changed files: !`git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null`
- Changed file count: !`{ git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u | wc -l`
- Test framework: !`node -e "const p=require('./package.json');console.log(p.scripts?.test||'unknown')" 2>/dev/null || echo "unknown"`

## Task

Execute context-aware test orchestration.

### Arguments

```
$ARGUMENTS
```

| Flag | Default | Description |
|------|---------|-------------|
| `--all` | false | Force full test suite |
| `--layer <unit\|integration\|e2e>` | all | Run only specified layer |
| `--no-fail-fast` | false | Run all layers regardless of failures |
| `--no-fix` | false | Triage only, skip fixer execution |
| `--focus <path>` | — | Limit test selection to path |
| `--branch` | false | Use merge-base diff instead of working tree |

### Workflow

```
Phase 0 (Selection) → Phase 1 (Ladder) → Phase 2 (Triage) → Phase 3 (Fix) → Artifacts + Report
```

1. **Phase 0**: Collect git diff → map to test targets via filename patterns → Glob confirm
2. **Phase 1**: Progressive ladder — unit → integration → e2e with fail-fast
3. **Phase 2**: On failure — parse output → LLM classify → safety gate
4. **Phase 3**: Fixer catalog lookup → tier check → auto/confirm/block
5. **Artifacts**: Write metadata + results + triage to `.claude/cache/test-deep/<runId>/`

### Output

```markdown
## Test Deep Report

### Test Selection
- Changed files: N
- Mapped test files: N (N unit, N integration, N e2e)
- Selection method: git diff mapping | framework native | full suite

### Results

| Layer | Tests | Passed | Failed | Skipped | Duration |
|-------|-------|--------|--------|---------|----------|

### Failure Triage

| # | Test | Classification | Root Cause | Fixer | Tier |
|---|------|---------------|------------|-------|------|

### Actions Taken
- [N] fixer_id: outcome

### Gate
✅ All Pass | ⛔ N failures pending resolution
```

## Examples

```bash
/test-deep
/test-deep --all
/test-deep --layer unit
/test-deep --no-fail-fast
/test-deep --focus test/scripts/
/test-deep --no-fix --branch
```
