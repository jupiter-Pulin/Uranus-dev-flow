---
description: Multi-target refactoring orchestrator — code + doc cleanup with behavioral verification
argument-hint: --target <path> | --auto [--max-targets N]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, Skill, AskUserQuestion
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/refactor/SKILL.md
@skills/refactor/references/refactor-catalog.md
@skills/refactor/references/target-detection.md
@skills/refactor/references/behavioral-gate.md
@skills/refactor/references/output-template.md

## Context

- Git status: !`git status -sb`
- Current branch: !`git branch --show-current`

## Arguments

| Parameter | Description |
|-----------|-------------|
| `--target <path>` | Specific file or directory to refactor (repo-relative) |
| `--auto` | Auto-detect targets using inline metrics |
| `--max-targets N` | Maximum number of targets (default: 10) |

## Key Rules

| Rule | Description |
|------|-------------|
| No git commit | per @rules/git-workflow.md |
| Behavioral gate | Code targets must pass `/verify fast` pre/post comparison |
| Doc bypass | Doc targets skip `/verify`, go directly to `/codex-review-doc` |
| Path validation | Reject absolute paths, `..` traversal, symlink escape |

## Workflow

```
Phase 0: Target Detection → Phase 2: Incremental Refactor Loop → Phase 3: Report
(Phase 1: reserved for v2 — parallel exploration)
```

## Examples

```bash
/refactor --target src/utils.ts
/refactor --target docs/guide.md
/refactor --auto
/refactor --auto --max-targets 5
```
