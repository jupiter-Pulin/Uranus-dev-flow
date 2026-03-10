---
description: Post friendly review comments to a GitHub PR — prepare, preview, submit.
allowed-tools: Bash(bash:*), Read, Grep, Glob, AskUserQuestion
argument-hint: "[PR#] [--repo owner/repo]"
---

@skills/pr-comment/SKILL.md
@skills/pr-comment/references/api-and-guardrails.md

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(detached)"`
- Repo: !`bash -c 'gh repo view --json nameWithOwner --template "{{.nameWithOwner}}" 2>/dev/null || echo "unknown"'`
- PR: !`bash -c 'gh pr view --json number,title,url --template "PR #{{.number}}: {{.title}} ({{.url}})" 2>/dev/null || echo "no PR on current branch"'`

## Task

Post review comments to a GitHub PR per SKILL.md workflow. Use context block data for PR auto-detection.

### Arguments

| Arg | Description |
|-----|-------------|
| `<PR#>` | Target PR number (default: current branch PR) |
| `--repo <owner/repo>` | Target repository (default: auto-detect) |

### Workflow

1. **Collect** -- gather comments from conversation context
2. **Prepare** -- validate comments against PR changed files
3. **Preview** -- show dry-run to user
4. **Confirm** -- AskUserQuestion gate
5. **Submit** -- POST atomic review to GitHub

## Examples

```bash
/pr-comment
/pr-comment 42
/pr-comment 42 --repo owner/repo
```
