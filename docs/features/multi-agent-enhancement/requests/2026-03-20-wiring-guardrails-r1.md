# Wiring Guardrails

> **Created**: 2026-03-20
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md) Section 3.2

## Background

14 custom agents exist in `agents/` but skill-lint has no validation for agent references. Skills describe `Agent()` dispatch without listing `Agent` in `allowed-tools`. This creates silent failures and drift.

## Requirements

- Add `agent-ref-validity` check: `subagent_type` references must resolve to `agents/*.md` (skip built-ins and external plugin refs)
- Add `agent-tool-entitlement` check: skills mentioning `Agent(` or `Task(` must have them in `allowed-tools`
- Add `agent-tools-syntax` check: validate `tools:` field format in agent frontmatter
- Fix existing gaps: `deep-explore` and `deep-research` missing `Agent` in allowed-tools
- All `allowed-tools` changes must apply to both SKILL.md and command.md

## Scope

| Scope | Description |
|-------|-------------|
| In | 3 new lint checks + tests + fix existing allowed-tools gaps |
| Out | Agent activation (R2), parallelization (R3), new agent creation |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/skill-health-check/scripts/skill-lint.js` | Modify | Add 3 new validation checks |
| `test/scripts/skill-lint.test.js` | New | Unit tests for new checks |
| `skills/deep-explore/SKILL.md` | Modify | Add Agent to allowed-tools |
| `commands/deep-explore.md` | Modify | Sync allowed-tools |
| `skills/deep-research/SKILL.md` | Modify | Add Agent to allowed-tools |
| `commands/deep-research.md` | Modify | Sync allowed-tools |

## Acceptance Criteria

- [ ] `skill-lint.js` validates `subagent_type` references resolve to `agents/*.md`
- [ ] `skill-lint.js` validates Agent/Task tool entitlement in `allowed-tools`
- [ ] `deep-explore` and `deep-research` have `Agent` in allowed-tools (both SKILL.md and command.md)
- [ ] `allowed-tools` changes applied to both SKILL.md and command.md for all modified skills
- [ ] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec Section 3.2 complete |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Sibling: [R2: Agent Activation](./2026-03-20-agent-activation-r2.md)
- Sibling: [R3: Skill Parallelization](./2026-03-20-skill-parallelization-r3.md)
