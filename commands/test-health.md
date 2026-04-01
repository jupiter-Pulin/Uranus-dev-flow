---
description: Holistic test coverage measurement — quantitative metrics + qualitative review dashboard with trend tracking.
argument-hint: [--full] [--collect] [--scope <path>] [--no-trend]
allowed-tools: Read, Grep, Glob, Bash(bash:*), Bash(git:*), Bash(node:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(npx:*), Bash(stat:*), Bash(find:*), Bash(python*:*), Bash(pytest:*), Bash(cargo:*), Bash(go:*), Skill, Agent
---

**Must read and follow the skill below before executing this command:**

@skills/test-health/SKILL.md
@skills/test-health/references/artifact-formats.md
@skills/test-health/references/trend-schema.md
@skills/test-health/references/test-count-parsers.md

## Context

- Git status: !`git status -sb`
- Test framework: !`node -e "const p=require('./package.json');console.log(p.scripts?.test||'unknown')" 2>/dev/null || echo "unknown"`
- Coverage script: !`node -e "const p=require('./package.json');console.log(p.scripts?.['test:coverage']||'none')" 2>/dev/null || echo "none"`

## Task

Execute holistic test coverage measurement.

### Arguments

| Argument | Description |
|----------|-------------|
| `--full` | Run all 4 phases (A→B→C→D) instead of quick mode |
| `--collect` | Opt-in: execute project coverage command (`test:coverage`) |
| `--scope <path>` | Limit analysis to specified directory |
| `--no-trend` | Skip trend comparison |

### Default (Quick Mode)

1. Count test files by layer (Glob-based). If `--scope`, limit to that directory.
2. Scan for coverage artifacts (consume existing, never install tools)
3. Compute trend delta vs previous snapshot (skip if `--no-trend`)
4. Output quick dashboard

### Full Mode (`--full`)

1. **Phase A**: Dispatch `/check-coverage` for feature-doc coverage
2. **Phase B**: Test inventory + coverage artifact consumption (+ `--collect` if specified)
3. **Phase C**: Dispatch `/codex-test-review` for qualitative review
4. **Phase D**: Aggregate multi-dimensional dashboard + write trend snapshot

## Output

Multi-dimensional dashboard (see SKILL.md for full output templates).

Gate policy: **advisory** (default) — output verdicts, do not block workflow.

## Examples

```bash
/test-health                    # Quick mode: inventory + artifacts + trend
/test-health --full             # All 4 phases with Codex review
/test-health --full --collect   # Full + run project coverage command
/test-health --scope src/       # Limit scope to src/
```
