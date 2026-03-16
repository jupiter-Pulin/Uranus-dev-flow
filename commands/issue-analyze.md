---
description: GitHub Issue and PR review thread deep analysis with Codex blind verdict. Read input -> classify -> verdict assessment -> investigate -> report.
argument-hint: "<issue-number|issue-url|review-thread-desc> [--triage]"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(gh:*), mcp__codex__codex
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/issue-analyze/SKILL.md
@skills/issue-analyze/references/classification.md
@skills/issue-analyze/references/report-template.md

## Context

- Git status: !`git status -sb`
- Current branch: !`git branch --show-current`

## Task

Analyze a GitHub Issue or PR review thread and produce a root cause analysis report.

### Arguments

| Arg | Description |
|-----|-------------|
| `<issue-number\|url\|description>` | GitHub Issue or review thread to analyze |
| `--triage` | Lightweight mode: classification + verdict only (skip investigation) |

```
$ARGUMENTS
```

### Execution Flow

```bash
# Step 1: Read Issue / Review Thread
# GitHub Issue: gh issue view <number> --json title,body,labels,comments,author,createdAt
# Review Thread: use provided file:line + comment data

# Step 2: Problem Classification (see SKILL.md decision tree)

# Step 2.5: Verdict Assessment (Codex blind verification)
# Uses @skills/seek-verdict/references/verdict-prompt.md pattern
# Thresholds: @skills/seek-verdict/references/policy-mapping.md
# --triage mode: stop here, output classification + verdict

# Step 3: Execute Investigation (skip if NON_ACTIONABLE + high confidence)

# Step 4: Produce Report (includes verdict)
```

## When to Use

- ✅ Need deep analysis of a GitHub Issue
- ✅ Root cause is uncertain
- ✅ Systematic investigation needed
- ✅ Triage PR review threads for actionability

## When NOT to Use

- ❌ Root cause already known, fix directly (use `/bug-fix`)
- ❌ Simple issue, just check code directly

## Examples

```bash
# Analyze by issue number
/issue-analyze 123

# Analyze by issue URL
/issue-analyze https://github.com/user/repo/issues/123

# Analyze by description (no issue)
/issue-analyze "API returns 500 when token is empty"

# Triage a review thread (lightweight verdict)
/issue-analyze --triage "src/service.ts:42 — Use early return instead of nested if"
```
