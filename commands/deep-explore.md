---
description: Multi-wave parallel code exploration. Orchestrates 2-3 Explore agents across multiple waves for large-scale codebase research with completeness scoring.
argument-hint: <query> [--agents N] [--waves N] [--areas "a, b, c"] [--quick]
allowed-tools: Read, Grep, Glob, Bash, Agent
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/deep-explore/SKILL.md
@skills/deep-explore/references/agent-prompt.md
@skills/deep-explore/references/synthesis.md

## Context

- Git status: !`git status -sb`
- Project structure: !`ls skills/ commands/ rules/ hooks/ scripts/ 2>/dev/null | head -20`
- Estimated file count: !`find . -name "*.md" -o -name "*.js" -o -name "*.sh" -o -name "*.ts" | grep -v node_modules | grep -v .git | wc -l`

## Task

Orchestrate multi-wave parallel code exploration.

### Arguments

```
$ARGUMENTS
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `<query>` | Research topic/question | Required |
| `--agents N` | Agents per wave (1-3) | 3 |
| `--waves N` | Max waves (2-3) | 3 (adaptive) |
| `--areas "a, b, c"` | Manual shard specification | Auto-detect |
| `--quick` | Redirect to `/code-explore` | Off |

### Mode Detection

```
Has --quick      -> Redirect to /code-explore
Estimated files <= 25 -> Redirect to /code-explore (with note)
Other            -> Multi-wave orchestration
```

### Workflow

```
Phase 0 (Intent) → Wave 1 (Breadth) → Gather → Wave 2 (Depth) → Gate → [Wave 3] → Report
```

1. **Phase 0**: Parse query, estimate scope, plan shards
2. **Wave 1**: Fan-out 2-3 Explore agents (parallel, background)
3. **Gather**: Collect results, build claim registry, rank open Qs
4. **Wave 2**: Deep dive into top hotspots
5. **Gate**: Compute completeness score (novelty + critical open Qs)
6. **Wave 3** (optional): Cross-cutting if score < 80
7. **Report**: Synthesize unified report

### Key Rules

- **80/20 contract**: Each agent 80% primary + 20% peripheral (max 2 peripheral findings)
- **Anti-anchoring**: Inter-wave context passes facts, not conclusions
- **`--waves` is hard ceiling**: Never exceed user-specified max
- **Evidence required**: Every finding must have file:line reference

## Output

```markdown
## Deep Exploration Report: <query>

### Completeness
- Score: <N>/100
- Waves: <N>/<max>
- Agents: <N>

### Executive Summary
<answer>

### Per-Wave Findings
| Wave | Focus | Key Findings | Open Qs |
|------|-------|-------------|---------|

### Claim Registry (top findings)
| # | Claim | Evidence | Confidence | Consensus |
|---|-------|----------|------------|-----------|

### Coverage Matrix + Proactive Discoveries + Divergence + Residual Risks
```

## Examples

```bash
/deep-explore "How does the review pipeline work end-to-end?"
/deep-explore --areas "hooks, skills/codex-code-review, rules" "Review architecture"
/deep-explore --quick "How does emit-review-gate work?"
/deep-explore --agents 2 --waves 2 "Plugin install flow"
```
