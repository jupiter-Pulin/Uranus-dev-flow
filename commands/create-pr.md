---
description: Create or update GitHub PR from branch — auto-extract ticket, generate title/body, auto-detect existing PR for update, dry-run by default
argument-hint: [--head <branch>] [--base <branch>] [--title <title>] [--update] [--execute] [--dry-run]
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob
---

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD`
- Remote: !`gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo 'unknown'`
- Commits: !`git log --oneline -10`

## Task

Follow the `create-pr` skill workflow:

1. **Gather info**: branch, remote, existing PRs, commits, diff stats
2. **Extract ticket**: from branch name using `{TICKET_PATTERN}` (default: `[A-Z]+-\d+`)
3. **Generate title**: `<type>: [<TICKET>] <summary>`
4. **Generate body**: Summary bullets + Ticket link + Test plan
5. **Pre-flight + mode detect**: verify branch pushed, check existing PR → auto-switch to update mode if PR exists
6. **Output**: `gh pr create` or `gh pr edit` command (dry-run default)

Arguments:
- `--head <branch>`: Source branch (default: current)
- `--base <branch>`: Target branch (default: `{TARGET_BRANCH}` or `main`)
- `--title <text>`: Override title
- `--update`: Force update mode (re-generate title/body for existing PR)
- `--execute`: Actually create/update the PR (asks confirmation first)
- `--dry-run`: Show command only (default)

## Output

**Create mode** — Dry-run: `gh pr create` command. Execute: created PR URL.
**Update mode** — Before/after diff of title/body + `gh pr edit` command (dry-run) or updated PR URL (execute).
