---
description: Monitor GitHub Actions CI runs for current HEAD or specified SHA
argument-hint: [--sha <sha>] [--branch <branch>] [--timeout <min>] [--run-id <id>] [--foreground]
allowed-tools: Bash(gh:*), Bash(git:*)
---

**Must read and follow the skill below before executing this command:**

@skills/watch-ci/SKILL.md

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD`
- HEAD SHA: !`git rev-parse --short HEAD`
- Recent CI runs: !`gh run list --limit 3 --json databaseId,name,status,conclusion,headSha --template '{{range .}}{{.databaseId}} {{.name}} {{.status}} {{.conclusion}} {{.headSha | truncate 7}}{{"\n"}}{{end}}' 2>/dev/null || echo "gh CLI unavailable"`

## Task

Monitor GitHub Actions CI runs until completion and report verdict.

### Arguments

```
$ARGUMENTS
```

| Argument | Description | Default |
|----------|-------------|---------|
| `--sha <sha>` | SHA to monitor | `git rev-parse HEAD` |
| `--branch <branch>` | Branch to filter runs | current branch |
| `--timeout <min>` | Watch timeout in minutes | 10 |
| `--run-id <id>` | Monitor a specific run ID directly | auto-detect |
| `--foreground` | Run `gh run watch` in foreground (blocking) | background |

## Examples

```bash
# Watch CI for current HEAD
/watch-ci

# Watch CI for a specific SHA
/watch-ci --sha abc1234def

# Watch a specific run
/watch-ci --run-id 12345678

# Watch with longer timeout
/watch-ci --timeout 20
```
