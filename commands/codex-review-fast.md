---
description: Quick second-opinion using Codex MCP (diff only, no tests). Supports review loop with context preservation.
argument-hint: [--focus "<text>"] [--base <gitref>] [--continue <threadId>]
allowed-tools: mcp__codex__codex, mcp__codex__codex-reply, Bash(git:*), Bash(bash:*), Read, Grep, Glob, Task
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/codex-code-review/SKILL.md
@skills/codex-code-review/references/codex-prompt-fast.md
@skills/codex-code-review/references/codex-prompt-full.md
@skills/codex-code-review/references/codex-prompt-branch.md
@skills/codex-code-review/references/review-common.md
@skills/codex-code-review/references/codex-research-instructions.md

## Context

- Git status: !`git status -sb`
- Git diff stats: !`git diff --stat HEAD 2>/dev/null | tail -5`

## Task

Quick code review using Codex MCP (diff only, no lint/build/test).

### Arguments

```
$ARGUMENTS
```

| Parameter               | Description                                 |
| ----------------------- | ------------------------------------------- |
| `--focus "<text>"`      | Focus on specific area (e.g. "auth")        |
| `--base <gitref>`       | Compare with specified branch (e.g. origin/main) |
| `--continue <threadId>` | Continue a previous review session          |

### Workflow

```
emit PENDING → git diff → Dual Review (Codex + Task background) → Await Codex → Reconcile → Emit Gate → Loop if Blocked
```

1. **Emit PENDING**: `bash scripts/emit-review-gate.sh PENDING`
2. **Collect metadata**: `git diff --name-only HEAD` + `git diff --stat HEAD` (Codex reads full diffs itself)
3. **Dual Review** (parallel dispatch, single message):
   - 3a. **Codex review** (primary, blocking): `mcp__codex__codex` or `mcp__codex__codex-reply`
   - 3b. **Secondary reviewer** (background, non-blocking): `Task(pr-review-toolkit:code-reviewer)` with `run_in_background: true`
4. **Await Codex result**, then reconcile: if Task completed, aggregate per SKILL.md Step 4
5. **Emit gate**: `bash scripts/emit-review-gate.sh READY|BLOCKED`
6. **Output**: Severity-grouped findings + source attribution + Merge Gate

### Key Rules

- **Codex must independently research** — not rely only on diff
- **Save `threadId`** — for review loop continuation
- **Gate sentinels** — output `✅ Ready` or `⛔ Blocked` for hook parsing

### Review Loop

**⚠️ @CLAUDE.md auto-loop: fix → re-review → ... → ✅ PASS ⚠️**

## Output

```markdown
## Codex Quick Review Report

### Review Scope
- Change stats: <git diff --stat summary>
- Focus area: <focus or "all">
- Review mode: dual (Codex + secondary) | single (Codex-only)

### Findings
#### P0 (Must Fix)
- [file:line] Issue -> Fix recommendation [source: codex|toolkit|both]
#### P1 (Should Fix)
- [file:line] Issue -> Fix recommendation [source: codex|toolkit|both]
#### P2 (Suggested Improvement)
- [file:line] Issue -> Fix recommendation [source: codex|toolkit|both]

### Merge Gate
✅ Ready / ⛔ Blocked (need to fix N P0/P1 issues)

### Loop Review
To re-review after fixes: `/codex-review-fast --continue <threadId>`
```

## Examples

```bash
/codex-review-fast
/codex-review-fast --focus "authentication"
/codex-review-fast --base origin/main
/codex-review-fast --continue abc123
```
