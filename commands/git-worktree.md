---
description: Manage git worktrees — create, list, remove, parallel branch development
argument-hint: [add|list|remove|prune] [--branch <name>] [--base <ref>] [--no-claude-sync]
allowed-tools: Bash(git:*), Bash(bash:*), Read, Grep, Glob
---

## Context

- Worktrees: !`git worktree list 2>/dev/null || echo 'not in a git repo'`
- Branch: !`git rev-parse --abbrev-ref HEAD`

## Task

Follow the `git-worktree` skill workflow.

### Sub-commands

| Sub-command | Action |
|-------------|--------|
| `add` | Create new worktree (ask for branch + purpose), then auto-sync `.claude/` |
| `list` | Show all worktrees with status |
| `remove` | Remove a worktree (with confirmation) |
| `prune` | Clean up stale worktree records |
| (none) | Show current worktrees and suggest actions |

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--no-claude-sync` | `false` | Skip `.claude/` sync after `add` |

### Naming

Use `wt-{repo-shortname}-{purpose}` format, placed in repo's parent directory.

### `.claude/` Auto-Sync

After `git worktree add` succeeds, automatically sync `.claude/` to the new worktree:

```bash
bash scripts/worktree-claude-sync.sh <worktree-path>
```

Sync failure does not block worktree creation. Use `--no-claude-sync` to skip.

## Output

For `add`: the exact `git worktree add` command, sync report, and next steps.
For `list`: formatted table of worktrees.
For `remove`: confirmation prompt then `git worktree remove` command.
