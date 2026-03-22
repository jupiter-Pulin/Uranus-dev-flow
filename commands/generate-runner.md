---
description: Generate a customized precommit runner for any ecosystem. Detects project type, selects template, writes user-owned runner script.
argument-hint: "[--ecosystem <node|python|rust|go>] [--output <path>] [--force]"
allowed-tools: Read, Grep, Glob, Bash(node:*), Write
---

@skills/generate-runner/SKILL.md
@skills/generate-runner/references/templates.md

## Context

- Project root: !`git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repo)"`
- Ecosystem hints: !`ls package.json pyproject.toml Cargo.toml go.mod 2>/dev/null || echo "(none found)"`
- Existing runner: !`test -f .claude/scripts/precommit-runner.js && echo "exists" || echo "missing"`

## Task

Generate a customized precommit runner per SKILL.md workflow.

### Arguments

```
$ARGUMENTS
```

| Arg | Description | Default |
|-----|-------------|---------|
| `--ecosystem <name>` | Force ecosystem | auto-detect |
| `--output <path>` | Custom output path | `.claude/scripts/precommit-runner.js` |
| `--force` | Overwrite existing | off |

### Workflow

1. **Detect** ecosystem from manifest files (or use `--ecosystem`)
2. **Select** template from `references/templates.md`
3. **Customize** with project-specific values (pm, scripts, globs)
4. **Write** runner with eject header
5. **Verify** output

## Examples

```bash
/generate-runner
/generate-runner --ecosystem python
/generate-runner --force --output .claude/scripts/custom-runner.js
```
