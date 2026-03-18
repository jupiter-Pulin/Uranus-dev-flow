---
description: Pre-PR confidence audit with 5-dimension scoring. Aggregates test quality, coverage, risk, and AC traceability into a single readiness index (0-100).
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(bash:*), Skill, AskUserQuestion
argument-hint: "[--mode fast|deep] [--strict] [--json] [--base <ref>]"
---

@skills/pre-pr-audit/SKILL.md
@skills/pre-pr-audit/references/scoring-model.md
@skills/pre-pr-audit/references/output-template.md
@rules/testing.md

## Context

- Branch: !`git branch --show-current`
- Status: !`git status -sb`
- HEAD: !`git rev-parse --short HEAD`
- Uncommitted files: !`git diff --stat HEAD`

## Task

Run the pre-PR audit per SKILL.md workflow. Use context block data for HEAD and change detection.

### Arguments

| Arg | Description | Default |
|-----|-------------|---------|
| `--mode fast\|deep` | Execution depth | `fast` |
| `--strict` | Non-zero exit on ⛔ | off |
| `--json` | Machine-readable JSON output | off |
| `--base <ref>` | Compare against ref | HEAD |

### Workflow

1. **Phase A**: Collect state + dispatch `/risk-assess` + detect changed files (parallel)
2. **Phase B**: `/codex-test-review` on top-N risky modules + `/check-coverage` (deep) + AC trace (deep)
3. **Phase C**: Aggregate scores per `references/scoring-model.md` + hard-fail checks
4. **Phase D**: Output report per `references/output-template.md` + gate sentinel

## Examples

```bash
/pre-pr-audit
/pre-pr-audit --mode deep
/pre-pr-audit --strict --json
```
