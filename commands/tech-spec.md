---
description: Produce or update a technical spec document from requirements
argument-hint: [<requirement description | feature-keyword>] [--request] [--no-save]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(node:*), Write
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/tech-spec/SKILL.md
@skills/tech-spec/references/template.md
@skills/tech-spec/references/feature-context-resolution.md

## Context Detection

When `$ARGUMENTS` is empty or is a feature keyword (not a full description), auto-detect the target feature:

```bash
# Resolve feature context (5-level cascade)
node scripts/resolve-feature-cli.js 2>/dev/null || echo '{}'

# Check git state for additional context
git branch --show-current
git diff --name-only HEAD 2>/dev/null | head -20
```

### Mode Selection (Upsert)

| Condition | Mode | Action |
|-----------|------|--------|
| `$ARGUMENTS` is a full requirement description | Create | Generate new tech spec |
| Feature resolved + `2-tech-spec.md` exists | Update | Incrementally update existing spec |
| Feature resolved + `2-tech-spec.md` absent | Create | Generate new tech spec at `docs/features/<key>/2-tech-spec.md` |
| Feature NOT resolved + no arguments | Gate | Output `## Gate: Need Human` |

### Cross-Linking

When creating or updating a tech spec, check for active request docs in `docs/features/<key>/requests/` and insert back-links:

```markdown
> **Requests**: [Request Title](./requests/YYYY-MM-DD-title.md)
```

## Task

Produce or update a technical spec document based on requirements or detected context.

### Requirements

```
$ARGUMENTS
```

### Parameter Description

- `--request` - Also generate a request document
- `--no-save` - Do not save to docs/

## Examples

```bash
# Create from description
/tech-spec "Add user quota management feature"

# Auto-detect feature from context (branch, git diff, etc.)
/tech-spec

# Auto-detect + update existing spec
/tech-spec statusline-config

# Create with request document
/tech-spec "Optimize cache performance" --request
```
