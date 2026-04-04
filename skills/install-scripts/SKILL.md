---
name: install-scripts
description: "Install plugin runner scripts into project .claude/scripts/ for persistent use without plugin loaded"
allowed-tools: Read, Glob, Write, AskUserQuestion, Bash(mkdir:*), Bash(diff:*), Bash(git:*), Bash(ls:*), Bash(chmod:*), Bash(cp:*)
---

# Install Scripts

## Trigger

- Keywords: install scripts, setup scripts, copy scripts, install-scripts

## When NOT to Use

- Installing rules (use `/install-rules`)
- Installing hooks (use `/install-hooks`)
- Full project setup (use `/project-setup`)

## Workflow

```
Phase 1: Locate plugin scripts dir
Phase 2: Enumerate scripts (core + skill scripts)
Phase 3: Determine install set (--all, --skill, specific names)
Phase 4: Copy scripts + dependencies to .claude/scripts/
Phase 4.5: Update manifest
Phase 5: Output report
```

### Arguments

```
$ARGUMENTS
```

| Argument | Description |
|----------|-------------|
| `--all` | Install all available core scripts |
| `--list` | List available core scripts without installing |
| `--dry-run` | Show what would be installed, no changes |
| `--force` | Overwrite existing scripts with different content |
| `--skill <name>` | Install all scripts from the specified skill |
| `--skill-all` | Install scripts from all skills |
| `--skill-list` | List all available skill scripts |
| `script-names...` | Specific scripts to install |

### Script Types

| Type | Source | Target |
|------|--------|--------|
| Core scripts | `scripts/*.js`, `scripts/*.sh` | `.claude/scripts/` |
| Core lib | `scripts/lib/*.js` | `.claude/scripts/lib/` |
| Skill scripts | `skills/<name>/scripts/*` | `.claude/scripts/` |

### Conflict Handling

| Scenario | Action |
|----------|--------|
| Target missing | Copy |
| Target identical | Skip (up to date) |
| Target differs | Skip + warn (use --force to overwrite) |

## Output

```markdown
## Install Scripts Report

| Script | Type | Status |
|--------|------|--------|
| precommit-runner.js | core | installed |
| lib/utils.js | core-lib | up to date |
| git-profile.sh | skill | installed |

Installed: N | Skipped: M | Conflicts: K
```
