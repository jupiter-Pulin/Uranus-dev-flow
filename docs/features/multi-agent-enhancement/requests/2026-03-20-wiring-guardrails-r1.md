# Wiring Guardrails

> **Created**: 2026-03-20
> **Status**: Completed
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
| In | 4 new lint checks (2 per-skill + 2 cross-skill) + tests + fix existing allowed-tools gaps |
| Out | Agent activation (R2), parallelization (R3), new agent creation |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/skill-health-check/scripts/skill-lint.js` | Modify | Add 4 new validation checks (2 per-skill + 2 cross-skill) |
| `test/scripts/skill-lint.test.js` | New | Unit tests for new checks |
| `skills/deep-explore/SKILL.md` | Modify | Add Agent to allowed-tools |
| `commands/deep-explore.md` | Modify | Sync allowed-tools |
| `skills/deep-research/SKILL.md` | Modify | Add Agent to allowed-tools |
| `commands/deep-research.md` | Modify | Sync allowed-tools |

## Acceptance Criteria

- [x] `skill-lint.js` validates `subagent_type` references resolve to `agents/*.md`
- [x] `skill-lint.js` validates Agent/Task tool entitlement in `allowed-tools`
- [x] `deep-explore` and `deep-research` have `Agent` in allowed-tools (both SKILL.md and command.md)
- [x] `allowed-tools` changes applied to both SKILL.md and command.md for all modified skills
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec Section 3.2 complete |
| Development | Done | 13c62ac: 4 new checks + module exports |
| Testing | Done | 21/21 tests pass + CI #23369726375 pass |
| Acceptance | Done | All 5 AC verified, Codex review ✅ Ready |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Sibling: [R2: Agent Activation](./2026-03-20-agent-activation-r2.md)
- Sibling: [R3: Skill Parallelization](./2026-03-20-skill-parallelization-r3.md)
