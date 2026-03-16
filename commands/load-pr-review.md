---
description: Load GitHub PR review comments into AI session — summarize, plan, fix, writeback.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(bash:*), Bash(jq:*), Read, Grep, Glob, Edit, Write, AskUserQuestion, mcp__codex__codex
argument-hint: "[PR#|URL] [--mode summary|plan|fix] [--all] [--writeback] [--budget <N>] [--no-verdict]"
---

@skills/load-pr-review/SKILL.md
@skills/load-pr-review/references/api-contract.md
@skills/load-pr-review/references/token-budget.md
@skills/load-pr-review/references/writeback-guardrails.md
@skills/load-pr-review/references/verdict-triage-prompt.md
@skills/seek-verdict/references/policy-mapping.md

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(detached)"`
- Repo: !`gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "(unknown)"`
- PR: !`gh pr view --json number,title,state --template '#{{.number}} {{.title}} [{{.state}}]' 2>/dev/null || echo "(no PR on this branch)"`

## Task

Load the PR review comments per SKILL.md workflow. Use context block data for PR auto-detection.

### Arguments

| Arg | Description |
|-----|-------------|
| `<PR#\|URL>` | Target PR (default: current branch PR) |
| `--mode summary\|plan\|fix` | Interaction mode (default: summary) |
| `--all` | Include resolved + outdated threads |
| `--writeback` | Enable reply/resolve writeback |
| `--budget <N>` | Max loaded threads (default: 30, 200 with --all; GraphQL ceiling: 100) |
| `--no-verdict` | Skip Codex verdict triage (saves cost) |

### Workflow

1. **Resolve PR** — from args or context block data
2. **Fetch** — run script `fetch` subcommand
3. **Verdict Triage** (plan/fix mode, unless `--no-verdict`) — batch Codex assessment per Step 1.5 in SKILL.md
4. **Present** — based on `--mode`, enriched with verdict data
5. **Fix** (if mode=fix) — apply changes per thread, then auto-loop per @rules/auto-loop.md
6. **Writeback** (if `--writeback`) — dry-run plan → AskUserQuestion → execute

## Examples

```bash
/load-pr-review
/load-pr-review 42 --mode plan
/load-pr-review https://github.com/owner/repo/pull/42 --mode fix
/load-pr-review --all --budget 50
/load-pr-review --mode fix --writeback
```
