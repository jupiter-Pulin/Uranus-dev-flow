# Agent Activation

> **Created**: 2026-03-20
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md) Section 3.3
> **Depends On**: [R1: Wiring Guardrails](./2026-03-20-wiring-guardrails-r1.md)

## Background

13 of 14 custom agents are defined but not referenced by any skill or command. Several commands embed agent personas inline instead of dispatching to the dedicated agent definition. This wastes the agent definitions and prevents specialized behavior.

## Requirements

- Direct-wire 5 agents to their natural commands (brief-writer, doc-refactor, code-simplifier, git-investigator, coverage-analyst)
- Migrate 4 inline-persona commands to agent dispatch (check-coverage, project-brief, review-spec, deep-analyze)
- Wire 6 supplementary agents to skills (feasibility-analyst, performance-optimizer, refactor-reviewer, verify-app, codex-architect, codex-implementer)
- Verify all 14 agents are referenced via set-comparison

## Scope

| Scope | Description |
|-------|-------------|
| In | Agent wiring to existing commands/skills, inline persona migration |
| Out | Lint checks (R1), parallelization (R3), new agent creation |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `commands/project-brief.md` | Modify | Add `subagent_type: "brief-writer"` dispatch |
| `commands/doc-refactor.md` | Modify | Add `subagent_type: "doc-refactor"` dispatch |
| `commands/simplify.md` | Modify | Add `subagent_type: "code-simplifier"` dispatch |
| `commands/check-coverage.md` | Modify | Add `subagent_type: "coverage-analyst"` dispatch |
| `commands/review-spec.md` | Modify | Add `subagent_type: "tech-spec-reviewer"` dispatch |
| `commands/deep-analyze.md` | Modify | Add `subagent_type: "solution-architect"` dispatch |
| `skills/git-investigate/SKILL.md` | Modify | Wire `git-investigator` agent |
| `commands/git-investigate.md` | Modify | Sync allowed-tools |
| `skills/feasibility-study/SKILL.md` | Modify | Wire `feasibility-analyst` as supplementary |
| `skills/codex-architect/SKILL.md` | Modify | Wire `codex-architect` agent |
| `commands/codex-architect.md` | Modify | Sync allowed-tools |
| `skills/codex-implement/SKILL.md` | Modify | Wire `codex-implementer` agent |
| `commands/codex-implement.md` | Modify | Sync allowed-tools |
| `skills/best-practices/SKILL.md` | Modify | Wire `performance-optimizer` |
| `commands/simplify.md` | Modify | Wire `refactor-reviewer` as risk assessment secondary |
| `skills/test-deep/SKILL.md` | Modify | Wire `verify-app` for failure triage |

## Acceptance Criteria

- [x] 5 agents direct-wired to commands (brief-writer, doc-refactor, code-simplifier, git-investigator, coverage-analyst)
- [x] 4 inline-persona commands migrated to agent dispatch (check-coverage, project-brief, review-spec, deep-analyze)
- [x] All 14 agents referenced by at least 1 skill or command (set-comparison: `agents/*.md` names vs `subagent_type` refs)
- [x] Pass `/codex-review-doc`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Agent-to-skill mapping in tech spec Section 2.3 |
| Development | Done | 18 files modified (commit `4a2afd0`) |
| Testing | Done | skill-lint + set-comparison pass |
| Acceptance | Done | All AC checked, `/codex-review-doc` passed |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Sibling: [R1: Wiring Guardrails](./2026-03-20-wiring-guardrails-r1.md)
- Sibling: [R3: Skill Parallelization](./2026-03-20-skill-parallelization-r3.md)
