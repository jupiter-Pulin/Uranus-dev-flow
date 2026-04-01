---
description: Interactive debugging — reproduce, classify, probe, confirm root cause, fix.
argument-hint: "<problem description>" [--export [path]]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, Skill, mcp__codex__codex, mcp__codex__codex-reply
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/debug/SKILL.md
@skills/debug/references/failure-taxonomy.md
@skills/debug/references/probe-protocol.md
@skills/debug/references/report-template.md

## Context

- Git status: !`git status -sb`
- Current branch: !`git branch --show-current`

## Task

Perform interactive debugging with hypothesis-driven probe loop.

### Arguments

```
$ARGUMENTS
```

| Parameter | Description |
|-----------|-------------|
| `<problem>` | Problem description (natural language) or script/command path |
| `--export [path]` | Export Debug Report to file after completion |

### Key Rules

| Rule | Description |
|------|-------------|
| No git commit | `❌ git add \| git commit \| git push` — per @rules/git-workflow.md |
| Repro Contract | Must reproduce before probe — no static speculation |
| Probe Safety | Read-first default, deny list enforced — per Probe Safety Rules |
| Mandatory verdict | `/seek-verdict --intent confirm` required in Phase 3 |

### Workflow

| Phase | Action |
|-------|--------|
| 0 — Intake | Execute + reproduce the issue |
| 1 — Classify | Failure Taxonomy → select first-probe strategy |
| 2 — Probe | Hypothesis → Command → Observe → Repeat (max 6) |
| 3 — Confirm | `/seek-verdict --intent confirm` (mandatory) |
| 4 — Fix | Simple: Edit + test / Complex: delegate `/bug-fix` |
| 5 — Report | Output Debug Report (+ `--export` if specified) |

### Probe Loop Escalation

| Condition | Action |
|-----------|--------|
| ≥2 competing hypotheses | `/codex-brainstorm` — adversarial debate |
| 2 rounds no new info | `⚠️ Need Human` |
| Max rounds (6) | `⚠️ Need Human` |

## Examples

```bash
/debug bash scripts/deploy.sh 回傳 exit code 1
/debug API 回傳空陣列但資料庫有資料
/debug ks-status.sh 回傳 ready:false 但 deployment 已就緒
/debug "login 頁面載入後白屏" --export
```
