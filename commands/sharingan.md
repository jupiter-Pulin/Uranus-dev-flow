---
description: Analyze external GitHub repos and auto-generate equivalent sd0x-dev-flow skill definitions.
argument-hint: <github-url> [--mode analyze|generate] [--skill <name>] [--batch-size N] [--target-dir <path>] [--dry-run]
allowed-tools: Read, Grep, Glob, Bash(gh:*), Bash(node:*), Write, Agent, AskUserQuestion
---

**Must read and follow the skill below before executing this command:**

@skills/sharingan/SKILL.md
@skills/sharingan/references/format-mapping.md
@skills/sharingan/references/dependency-graph-algorithm.md
@skills/sharingan/references/output-template.md
@skills/sharingan/references/quality-checklist.md

## Context

- Git status: !`git status -sb`
- Available skills: !`ls skills/ 2>/dev/null | head -20`
- Available rules: !`ls rules/ 2>/dev/null | head -20`

## Task

Analyze an external GitHub repository and optionally generate equivalent sd0x-dev-flow skill definitions.

### Arguments

```
$ARGUMENTS
```

| Flag | Default | Description |
|------|---------|-------------|
| `<github-url>` | Required | GitHub repo URL |
| `--mode` | `analyze` | `analyze` (report only) / `generate` (report + files) |
| `--skill <name>` | auto-detect | Filter to single skill |
| `--batch-size` | `3` | Skills per batch (1-5) |
| `--target-dir` | `skills/` | Output directory |
| `--dry-run` | `false` | Show plan without writing files |

### Workflow

```
Phase 0 (Validate) → Phase 1 (Scan) → Phase 2 (Analyze) → Phase 3 (Generate) → Phase 4 (Validate)
```

1. **Phase 0**: Validate URL, check gh auth, validate target-dir containment
2. **Phase 1**: Run `scan-repo.js` → repo classification + dependency graph + batch order
3. **Phase 2**: Semantic extraction per skill → format mapping → untranslatable flagging
4. **Phase 3**: Template skeleton + LLM body generation → user approval → file write (generate mode only)
5. **Phase 4**: L1 frontmatter + L2 skill-lint + L3 LLM semantic validation

## Examples

```bash
/sharingan https://github.com/anthropics/skills
/sharingan https://github.com/anthropics/skills --mode generate
/sharingan https://github.com/anthropics/skills --skill skill-creator --mode generate
/sharingan https://github.com/owner/repo --dry-run
```
