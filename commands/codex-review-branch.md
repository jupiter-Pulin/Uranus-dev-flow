---
description: Fully automated review of an entire feature branch using Codex MCP
argument-hint: [base-branch] [--continue <threadId>]
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

- Current branch: !`git branch --show-current`
- Commits ahead of main: !`git rev-list --count main..HEAD 2>/dev/null || echo 0`
- Changed files: !`git diff --name-only main..HEAD 2>/dev/null | head -10`

## Task

Review an entire feature branch using Codex MCP.

### Arguments

```
$ARGUMENTS
```

| Parameter               | Description                      |
| ----------------------- | -------------------------------- |
| `[base-branch]`         | Base branch (default: main)      |
| `--continue <threadId>` | Continue a previous review session |

### Workflow

```
emit PENDING → Collect branch info → Dual Review (Codex + Task background) → Await Codex → Reconcile → Emit Gate → Loop if Blocked
```

1. **Emit PENDING**: `bash scripts/emit-review-gate.sh PENDING`
2. **Collect branch metadata** (Codex reads full diffs itself via sandbox):
   - `git diff --name-only ${BASE_BRANCH}..HEAD`
   - `git diff --stat ${BASE_BRANCH}..HEAD`
   - `git log --oneline ${BASE_BRANCH}..HEAD`
3. **Dual Review** (parallel dispatch, single message):
   - 3a. **Codex review** (primary, blocking): `mcp__codex__codex` or `mcp__codex__codex-reply`
   - 3b. **Secondary reviewer** (background, non-blocking): `Task(pr-review-toolkit:code-reviewer)` with `run_in_background: true`
4. **Await Codex result**, then reconcile: if Task completed, aggregate per SKILL.md Step 4
5. **Emit gate**: `bash scripts/emit-review-gate.sh READY|BLOCKED`
6. **Output**: Branch overview + rating table (6 dimensions) + severity-grouped findings + source attribution + Merge Gate

### Key Rules

- **Reviews entire branch** — all commits from base, not just latest diff
- **6 review dimensions** — Feature Completeness, Code Quality, Security, Performance, Test Coverage, Documentation
- **Rating table** — star ratings per dimension
- **Codex must independently research** — read changed files, check tests, trace dependencies
- **Save `threadId`** — for review loop continuation

### Review Loop

**⚠️ @CLAUDE.md auto-loop: fix → re-review → ... → ✅ PASS ⚠️**

## Output

```markdown
## Branch Review Report

### Branch Info
- Current branch: <branch>
- Base branch: <base>
- Commits: <count>

### Branch Overview
<one-sentence description>

### Review Summary
| Dimension            | Rating     | Notes |
| -------------------- | ---------- | ----- |
| Feature Completeness | ⭐⭐⭐⭐☆ | ...   |
| Code Quality         | ⭐⭐⭐⭐☆ | ...   |
| Security             | ⭐⭐⭐⭐⭐ | ...   |
| Performance          | ⭐⭐⭐⭐☆ | ...   |
| Test Coverage        | ⭐⭐⭐☆☆  | ...   |
| Documentation        | ⭐⭐⭐⭐☆ | ...   |

### Findings
#### P0 (Must Fix)
- [file:line] Issue -> Fix recommendation [source: codex|toolkit|both]
#### P1 (Should Fix)
- [file:line] Issue -> Fix recommendation [source: codex|toolkit|both]

### Merge Gate
✅ Ready / ⛔ Blocked (need to fix N P0/P1 issues)

### Loop Review
To re-review after fixes: `/codex-review-branch --continue <threadId>`
```

## Examples

```bash
/codex-review-branch
/codex-review-branch origin/develop
/codex-review-branch --continue abc123
```
