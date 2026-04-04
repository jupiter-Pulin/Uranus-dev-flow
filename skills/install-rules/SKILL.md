---
name: install-rules
description: "Install plugin rules into project .claude/rules/ for persistent use without plugin loaded"
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Bash(mkdir:*), Bash(diff:*), Bash(git:*), Bash(ls:*)
---

# Install Rules

## Trigger

- Keywords: install rules, setup rules, copy rules, install-rules

## When NOT to Use

- Installing hooks (use `/install-hooks`)
- Installing scripts (use `/install-scripts`)
- Full project setup (use `/project-setup`)

## Workflow

```
Phase 1: Locate plugin rules dir
Phase 2: Enumerate *.md
Phase 3: Determine install set (--all, specific names, or interactive)
Phase 3.5: Read manifest + classify (new/unchanged/modified/conflict)
Phase 4: Install (smart merge with manifest tracking)
Phase 4.5: Backfill CLAUDE.md references
Phase 5: Output report
```

### Arguments

```
$ARGUMENTS
```

| Argument | Description |
|----------|-------------|
| `--all` | Install all available rules |
| `--list` | List available rules without installing |
| `--dry-run` | Show what would be installed, no changes |
| `--force` | Overwrite modified rules |
| `--legacy-strategy <strategy>` | Handle pre-manifest installs (ask/overwrite/skip) |
| `--customize <rule>` | Customize a project-override rule |
| `rule-names...` | Specific rules to install |

### Manifest Tracking

Uses `.sd0x/install-state.json` to track installed file hashes. Smart merge logic:

| Status | Action |
|--------|--------|
| New (not installed) | Copy |
| Unchanged (hash match) | Auto-upgrade |
| Modified by user | Skip (preserve edits) |
| Conflict (both changed) | AskUserQuestion |

### Customize Mode (`--customize`)

Manages `*-project.md` companion files for user overrides:

| Sub-flag | Action |
|----------|--------|
| (none) | Show section status |
| `--add-section` | Add a new section |
| `--update-section <name>` | Update specific section |
| `--reset` | Regenerate from template |

## Output

```markdown
## Install Rules Report

| Rule | Status | Action |
|------|--------|--------|
| auto-loop.md | unchanged | auto-upgraded |
| testing.md | user-modified | skipped |

Installed: N | Skipped: M | Conflicts: K
```
