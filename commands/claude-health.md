---
description: Claude Code configuration health check + plugin sync for .claude/ directory
argument-hint: [--scope hygiene|sync|all] [--fix] [--fix-safe]
allowed-tools: Read, Grep, Glob, Bash(ls:*), Bash(find:*), Bash(wc:*), Bash(du:*), Bash(rm:*), Bash(git:*)
---

## Context

- Project root: !`git rev-parse --show-toplevel`
- .claude/ exists: !`ls -d .claude 2>/dev/null && echo "yes" || echo "no"`

## Task

Run a health check on the `.claude/` directory structure and plugin sync status, reporting issues and suggesting fixes.

**⚠️ Must read and follow the skill below:**

@skills/claude-health/SKILL.md
@skills/claude-health/references/best-practices.md

### Arguments

```
$ARGUMENTS
```

| Argument | Description |
|----------|-------------|
| `--scope hygiene` | Only run C1-C7 hygiene checks |
| `--scope sync` | Only run S1-S3 sync checks |
| `--scope all` | Run both modules (**default**) |
| `--fix` | Auto-fix P1 hygiene + guided sync remediation |
| `--fix-safe` | Auto-fix P1 hygiene + safe sync fixes (rules OUTDATED auto-fix; hooks/scripts MISSING only) |

### Workflow

1. Select modules based on `--scope` (default: all)
2. Execute selected checks from the skill
3. Output consolidated report
4. If `--fix` or `--fix-safe`: delegate fixes to `/install-rules`, `/install-hooks`, `/install-scripts`

## Output

See skill for output format.

## Examples

```bash
# Run full health check (hygiene + sync)
/claude-health

# Check plugin sync status only
/claude-health --scope sync

# Auto-fix safe items
/claude-health --fix-safe

# Guided remediation for all issues
/claude-health --fix
```
