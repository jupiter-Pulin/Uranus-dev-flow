---
description: Feature development workflow. Guides through design -> implement -> test + review -> precommit -> doc sync flow.
argument-hint: "<feature description>" [--skip-design]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, Skill, AskUserQuestion, mcp__codex__codex, mcp__codex__codex-reply
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/feature-dev/SKILL.md

## Context

- Git status: !`git status -sb`
- Current branch: !`git branch --show-current`

## Arguments

| Parameter | Description |
|-----------|-------------|
| `<feature>` | Feature requirement description |
| `--skip-design` | Skip architecture design phase |

## Workflow

```
Requirements → Design → Implement → Test + Review → Precommit Gate → Doc Sync
                │          │            │                  │               │
                ▼          ▼            ▼                  ▼               ▼
           /codex-     /codex-    /verify              /precommit-fast  /update-docs
           architect   implement  /codex-test-review   (or /precommit)  /create-request --update
                                  /codex-review-fast
```

## Key Rules

- **No git commit**: This skill does not commit. Use `/smart-commit --execute` separately.
- **Mandatory test review**: `/codex-test-review` after `/verify` for code changes
- Reference existing code patterns before implementing
- Every new service/provider must have unit tests
- Bug fixes must include regression tests
- Follow auto-loop rule: fix → re-review → ... → Pass
- Follow `@rules/testing.md` for test conventions

## Examples

```bash
/feature-dev "Add user authentication with JWT"
/feature-dev "Implement fee calculation" --skip-design
/feature-dev 繼續
```
