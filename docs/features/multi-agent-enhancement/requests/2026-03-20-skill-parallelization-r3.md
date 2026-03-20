# Skill Parallelization

> **Created**: 2026-03-20
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md) Section 3.4
> **Depends On**: [R1: Wiring Guardrails](./2026-03-20-wiring-guardrails-r1.md)

## Background

`/load-pr-review` and `/pre-pr-audit` have parallelizable workflows but rely on behavior-layer parallelism (model issuing multiple Skill calls in one message). This is not runtime-guaranteed. Using the Agent tool with `run_in_background: true` provides true parallelism.

## Requirements

- `/load-pr-review`: Use Agent-as-Skill-runner pattern to dispatch per-thread `/seek-verdict` calls in parallel
- `/pre-pr-audit`: Dispatch Phase A (state read + file mapping) and Phase B (coverage analysis) as background agents
- Add untrusted content handling for PR review threads dispatched to background agents
- Verify no sentinel output regression (auto-loop hooks depend on `[DISMISS_VERDICT]`, gate sentinels)

## Scope

| Scope | Description |
|-------|-------------|
| In | Parallelize 2 skills, untrusted content controls, sentinel compatibility |
| Out | Lint checks (R1), agent wiring (R2), new agent creation, cost dashboard |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/load-pr-review/SKILL.md` | Modify | Agent-as-Skill-runner parallel dispatch |
| `commands/load-pr-review.md` | Modify | Add Agent to allowed-tools |
| `skills/pre-pr-audit/SKILL.md` | Modify | Background agent dispatch for Phase A/B |
| `commands/pre-pr-audit.md` | Modify | Add Agent to allowed-tools |

## Acceptance Criteria

- [ ] `/load-pr-review` dispatches per-thread verdicts via background Agent tool
- [ ] `/pre-pr-audit` Phase A/B use background agents for parallel execution
- [ ] No sentinel output regression (existing auto-loop hook tests pass)
- [ ] Untrusted PR content handling documented and enforced in parallel dispatch
- [ ] Pass `/codex-review-fast` + `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec Section 3.4 + Codex feasibility review |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Codex Feasibility: threadId `019d0aa7-cc00-7d50-9b79-65ce12a67ef4`
- Sibling: [R1: Wiring Guardrails](./2026-03-20-wiring-guardrails-r1.md)
- Sibling: [R2: Agent Activation](./2026-03-20-agent-activation-r2.md)
