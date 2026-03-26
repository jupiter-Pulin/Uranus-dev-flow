---
description: Design and document system architecture, producing 3-architecture.md
argument-hint: [<feature-keyword>] [--skip-debate]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(node:*), Bash(bash:*), Write, Agent, Skill, AskUserQuestion, mcp__codex__codex, mcp__codex__codex-reply
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/architecture/SKILL.md
@skills/architecture/references/template.md
@skills/architecture/references/codex-prompt.md
@skills/tech-spec/references/feature-context-resolution.md

## Context Detection

```bash
# Resolve feature context (5-level cascade)
node scripts/resolve-feature-cli.js 2>/dev/null || echo '{}'

# Existence checks for mode selection (FEATURE_KEY resolved from above)
# test -f "docs/features/${FEATURE_KEY}/3-architecture.md" && echo "arch:exists" || echo "arch:absent"
# test -f "docs/features/${FEATURE_KEY}/2-tech-spec.md" && echo "spec:exists" || echo "spec:absent"
```

### Mode Selection

| Condition | Mode |
|-----------|------|
| `3-architecture.md` exists for resolved feature | Update |
| `3-architecture.md` absent + `2-tech-spec.md` exists | Create (tech-spec-informed) |
| `3-architecture.md` absent + no tech-spec | Create (code-only) |
| Feature NOT resolved + no arguments | Gate: Need Human |

## Task

Design and document the system architecture for the target feature.

### Arguments

```
$ARGUMENTS
```

| Parameter | Description |
|-----------|-------------|
| `<feature-keyword>` | Target feature (auto-detect if omitted) |
| `--skip-debate` | Skip Phase 3 adversarial verification |

## Examples

```bash
/architecture
/architecture statusline-config
/architecture --skip-debate
```
