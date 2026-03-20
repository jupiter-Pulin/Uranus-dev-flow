---
description: Validate skill quality against routing, progressive loading, and verification criteria.
argument-hint: [--deep] [--json]
allowed-tools: Read, Grep, Glob, Bash(node:*)
---

**Must read and follow the skill below before executing this command:**

@skills/skill-health-check/SKILL.md
@skills/skill-health-check/references/routing-signature-guide.md

## Context

- Skills directory: !`ls skills/ | wc -l` skills
- Commands directory: !`ls commands/ | wc -l` commands

## Task

Run skill health check.

### Arguments

```
$ARGUMENTS
```

| Parameter | Description |
|-----------|-------------|
| `--deep` | Include manual review dimensions (Step 2) |
| `--json` | Output JSON format |

### Workflow

```
Run skill-lint.js → [Optional: manual review] → Report + Gate
```

1. **Run automated lint**: `bash scripts/run-skill.sh skill-health-check skill-lint.js --fix-hint` (append `--json` if `$ARGUMENTS` contains `--json`)
2. **If `--deep`** (from `$ARGUMENTS`): Read flagged skills and evaluate Why>What, scope, progressive loading, routing precision
3. **Output**: Health report + Gate sentinel

## Output

```markdown
# Skill Health Check Report

## Summary
| Metric | Value |
|--------|-------|
| Skills scanned | N |
| Commands scanned | N |
| Checks passed | N |
| P0 (Must Fix) | N |
| P1 (Should Fix) | N |
| P2 (Suggestion) | N |

## Per-Skill Results
| Skill | Routing | When-NOT | Output | Verification | Refs | ArgHint | AT-Sync | Lines | Status |
|-------|---------|----------|--------|--------------|------|---------|---------|-------|--------|

## Gate: ✅ All Pass / ⛔ N issues need fixing
```

## Examples

```bash
/skill-health-check
/skill-health-check --deep
/skill-health-check --json
```
