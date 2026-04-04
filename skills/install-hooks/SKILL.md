---
name: install-hooks
description: "Install plugin hooks into project .claude/ for persistent use without plugin loaded"
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Bash(mkdir:*), Bash(diff:*), Bash(git:*), Bash(ls:*), Bash(chmod:*), Bash(jq:*)
---

# Install Hooks

## Trigger

- Keywords: install hooks, setup hooks, copy hooks, install-hooks

## When NOT to Use

- Installing rules (use `/install-rules`)
- Installing scripts (use `/install-scripts`)
- Full project setup (use `/project-setup`)

## Workflow

```
Phase 1: Locate plugin hooks dir
Phase 2: Enumerate hook scripts
Phase 3: Determine install set (--all, specific names, or interactive)
Phase 4a: Copy scripts to .claude/hooks/
Phase 4b: Merge hook definitions into settings.json
Phase 4c: Update manifest
Phase 4.5: Backfill CLAUDE.md references
Phase 5: Output report
```

### Arguments

```
$ARGUMENTS
```

| Argument | Description |
|----------|-------------|
| `--all` | Install all available hooks |
| `--list` | List available hooks without installing |
| `--dry-run` | Show what would be installed, no changes |
| `--force` | Overwrite existing hooks with different content |
| `--local` | Write to settings.local.json instead of settings.json |
| `--guard-mode warn\|strict` | Set stop-guard mode during install |
| `hook-names...` | Specific hooks to install |

### Two-Layer Install

| Layer | Target | Content |
|-------|--------|---------|
| Scripts | `.claude/hooks/*.sh` | Executable hook scripts |
| Definitions | `settings.json` hooks entries | Event → script path mapping |

### Conflict Handling

| Script Status | Settings Status | Action |
|---------------|----------------|--------|
| Missing | Missing | Install both |
| Identical | Present | Skip (up to date) |
| Different | Present | AskUserQuestion |

## Output

```markdown
## Install Hooks Report

| Hook | Script | Settings | Status |
|------|--------|----------|--------|
| post-edit-format | ✅ | ✅ | installed |
| stop-guard | ✅ | ⏭️ | skipped (identical) |

Scripts: N installed | Settings entries: M merged
```
