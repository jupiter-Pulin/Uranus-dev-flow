---
description: Safely remove plugin assets (skill/command/agent/rule/script/hook) with dependency detection and reference cleanup
argument-hint: <type> <name> [--execute] [--dry-run]
disable-model-invocation: true
allowed-tools: Bash(bash:*), Bash(git:*), Read, Grep, Glob, Edit, Write, AskUserQuestion
---

**Must read and follow the skill below before executing this command:**

@skills/safe-remove/SKILL.md
@skills/safe-remove/references/removal-policy.md

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD`
- Status: !`git status --short | head -5`

## Task

Safely remove a plugin asset: discover dependencies, classify impact (BLOCKER/PATCHABLE), output removal plan (dry-run default), or apply removal with verification (`--execute`).

### Arguments

```
$ARGUMENTS
```

| Argument | Description | Default |
|----------|-------------|---------|
| `<type>` | Asset type: `skill`, `command`, `agent`, `rule`, `script`, `hook` | Required |
| `<name>` | Asset name (e.g., `create-skill`) | Required |
| `--execute` | Apply removal after AskUserQuestion confirmation | off |
| `--dry-run` | Output plan only (default) | on |

### Key Rules

- **Dry-run by default** — never delete without `--execute` + user confirmation
- **BLOCKER = HALT** — do not proceed if structured bindings exist (commands `@skills/`, agents `skills:`, hooks.json)
- **Patches before deletes** — update references first, delete files last
- **Verify after execute** — run type-specific grep to confirm no residual references

## Examples

```bash
/safe-remove skill create-skill
/safe-remove skill create-skill --execute
/safe-remove command old-command --execute
/safe-remove agent unused-agent
```
