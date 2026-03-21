---
description: Multi-agent deep research orchestration. Parallel researcher agents explore web + code + community sources, synthesize via claim registry, validate with conditional adversarial debate.
argument-hint: <topic> [--mode exploratory|compliance|decision] [--debate auto|force|off] [--agents N] [--scope <path>] [--budget low|medium|high]
allowed-tools: Read, Grep, Glob, Bash, Write, WebSearch, WebFetch, Agent
---

**Must read and follow the skill below before executing this command:**

@skills/deep-research/SKILL.md
@skills/deep-research/references/research-roles.md
@skills/deep-research/references/scoring-model.md
@skills/deep-research/references/claim-registry.md

## Context

- Git status: !`git status -sb`
- Project structure: !`ls skills/ commands/ rules/ 2>/dev/null | head -20`

## Task

Orchestrate multi-agent deep research on a topic.

### Arguments

```
$ARGUMENTS
```

| Flag | Default | Description |
|------|---------|-------------|
| `<topic>` | Required | Research question or topic |
| `--mode` | `exploratory` | `exploratory` / `compliance` / `decision` |
| `--debate` | `auto` | `auto` / `force` / `off` |
| `--agents` | `3` | Researcher count (2-3) |
| `--scope` | project root | Codebase research scope |
| `--budget` | `medium` | Token budget: `low` / `medium` / `high` |

### Workflow

```
Phase 0 (Scope) → Phase 1 (Parallel Research) → Phase 2 (Synthesis) → Phase 3 (Validation) → Report
```

1. **Phase 0**: Classify intent, plan shards, estimate budget
2. **Phase 1**: Dispatch 2-3 researcher agents in parallel (background)
3. **Phase 2**: Merge via claim registry, compute completeness score
4. **Phase 3**: Validate disputed claims, escalate to `/codex-brainstorm` if needed
5. **Report**: Unified research report with claim registry + coverage matrix

## Examples

```bash
/deep-research "What are the best patterns for multi-agent orchestration?"
/deep-research --mode compliance "Are our testing practices aligned with industry standards?"
/deep-research --mode decision "Should we use Redis or PostgreSQL for caching?"
/deep-research --debate force --agents 2 "How do modern CLI tools handle plugin systems?"
/deep-research --budget low "What is the current state of WebAssembly support?"
```
