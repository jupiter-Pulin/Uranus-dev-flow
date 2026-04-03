---
description: Replicate knowledge from any source as sd0x-dev-flow skill definition.
argument-hint: <input> [--source auto|github_repo|external_evidence|local_code_context] [--mode analyze|generate] [--skill <name>] [--batch-size N] [--target-dir <path>] [--dry-run]
allowed-tools: Read, Grep, Glob, Bash(gh:*), Bash(node:*), Write, Agent, AskUserQuestion, WebSearch, WebFetch, Skill
---

**Must read and follow the skill below before executing this command:**

@skills/sharingan/SKILL.md
@skills/sharingan/references/format-mapping.md
@skills/sharingan/references/dependency-graph-algorithm.md
@skills/sharingan/references/output-template.md
@skills/sharingan/references/quality-checklist.md
@skills/sharingan/references/source-bundle.md
@skills/sharingan/references/input-classification.md

## Context

- Git status: !`git status -sb`
- Available skills: !`ls skills/ 2>/dev/null | head -20`
- Available rules: !`ls rules/ 2>/dev/null | head -20`

## Task

Replicate knowledge from any source and optionally generate equivalent sd0x-dev-flow skill definitions.

### Arguments

```
$ARGUMENTS
```

| Flag | Default | Description |
|------|---------|-------------|
| `<input>` | Required | Any input: GitHub URL, web URL, description, or local path |
| `--source` | `auto` | Override strategy: `github_repo` / `external_evidence` / `local_code_context` |
| `--mode` | `analyze` | `analyze` (report only) / `generate` (report + files) |
| `--skill <name>` | auto-detect | Filter to single skill (github_repo only) |
| `--batch-size` | `3` | Skills per batch, 1-5 (github_repo only) |
| `--target-dir` | `skills/` | Output directory |
| `--dry-run` | `false` | Show plan without writing files |

### Workflow

```
Phase 0 (Validate) → Phase 1 (Scan) → Phase 2 (Analyze) → Phase 3 (Generate) → Phase 4 (Validate)
```

1. **Phase 0**: Validate input, classify source (Phase 0A regex / Phase 0B LLM), apply security gate
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
