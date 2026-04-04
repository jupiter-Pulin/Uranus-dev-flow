---
name: codex-review-branch
description: "Fully automated review of an entire feature branch using Codex MCP"
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(git:*), Bash(bash:*), Read, Grep, Glob, Task
---

# Codex Review Branch

Thin entry-point skill — routes to the parent skill for full workflow.

## Parent Skill

This is the **Branch** variant of `codex-code-review`. Full workflow, prompt templates, and review logic are defined in the parent skill.

See `@skills/codex-code-review/SKILL.md`

## Variant

| Property | Value |
|----------|-------|
| Scope | Full branch (all commits since base) |
| Pre-checks | None |
| Prompt template | `@skills/codex-code-review/references/codex-prompt-branch.md` |

## Trigger

- Keywords: branch review, full branch, review branch, codex-review-branch

## When NOT to Use

- Quick diff-only review (use `/codex-review-fast`)
- Full review with lint + build (use `/codex-review`)
- Document review (use `/codex-review-doc`)
