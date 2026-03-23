---
description: Bug/Issue fix workflow. Investigate -> locate -> fix -> test -> review.
argument-hint: [issue-url or problem description]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/bug-fix/SKILL.md

## Context

- Git status: !`git status -sb`
- Current branch: !`git branch --show-current`

## Task

Perform a Bug/Issue fix.

### Arguments

```
$ARGUMENTS
```

### Key Rules

| Rule | Description |
|------|-------------|
| No git commit | `❌ git add \| git commit \| git push` — per @rules/git-workflow.md |
| Mandatory test review | `/codex-test-review` is mandatory for all code changes |

### Workflow

Follow the workflow in the skill:

| Phase | Action |
|-------|--------|
| Investigate | `gh issue view` / `Grep` / `/git-investigate` |
| Locate | `Read` related code |
| Fix | `Edit` minimal changes |
| Test | Add regression test at appropriate level (see bug-type matrix in skill) |
| Verify | `/verify` → `/codex-test-review` (mandatory) |
| Review | `/codex-review-fast` → `/precommit` |

### Test Requirements ⚠️

| Bug Type | Required | Recommended |
|----------|----------|-------------|
| Logic error | Unit | - |
| Service issue | Unit | Integration |
| API issue | Integration | E2E |
| Cross-service/data flow | Integration | E2E |
| User flow | E2E | - |

## Examples

```bash
/bug-fix https://github.com/user/repo/issues/123
/bug-fix "API returns 500 error when token is empty"
/bug-fix "TypeError: Cannot read property 'balance'"
```
