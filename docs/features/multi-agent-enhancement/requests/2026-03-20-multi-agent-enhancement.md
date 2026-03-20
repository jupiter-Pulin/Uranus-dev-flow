# Multi-Agent Enhancement

## Metadata

| Field | Value |
|-------|-------|
| Created | 2026-03-20 |
| Status | Superseded |
| Priority | P1 |
| Tech Spec | [2-tech-spec.md](../2-tech-spec.md) |
| Feasibility | Codex threadId: `019d0aa7-cc00-7d50-9b79-65ce12a67ef4` |

## Superseded By

This request has been split into 3 focused requests per granularity check (signal=3.5):

1. [R1: Wiring Guardrails](./2026-03-20-wiring-guardrails-r1.md) — B0 phase, code-layer
2. [R2: Agent Activation](./2026-03-20-agent-activation-r2.md) — B1-A phase, behavior-layer
3. [R3: Skill Parallelization](./2026-03-20-skill-parallelization-r3.md) — B1-P phase, mixed-layer

## Summary

Activate 13 idle custom agents, add wiring validation to skill-lint, and parallelize 2 high-ROI skills (`/load-pr-review`, `/pre-pr-audit`).

## Acceptance Criteria

| # | Criterion | Evidence Type | Status |
|---|-----------|--------------|--------|
| AC-1 | `skill-lint.js` validates agent ref existence | Automated test | Pending |
| AC-2 | `skill-lint.js` validates Agent/Task tool entitlement | Automated test | Pending |
| AC-3 | All 14 agents referenced by at least 1 skill or command | Set-comparison: agent names from `agents/*.md` vs `grep subagent_type skills/ commands/` | Pending |
| AC-4 | `/load-pr-review` dispatches per-thread verdicts in parallel | Runtime verification | Pending |
| AC-5 | `/pre-pr-audit` Phase A/B use background agents | Runtime verification | Pending |
| AC-6 | No sentinel output regression | Existing tests pass | Pending |
| AC-7 | `deep-explore` and `deep-research` have Agent in allowed-tools (both SKILL.md and command.md) | Lint verification | Pending |
| AC-8 | Untrusted PR content handling documented and enforced in `/load-pr-review` parallel dispatch | Code review | Pending |
| AC-9 | `allowed-tools` changes applied to both SKILL.md and command.md for all modified skills | Lint verification (allowed-tools-sync check passes) | Pending |

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| B0: Guardrails | B0-1 through B0-6 | Pending |
| B1-A: Agent Activation | B1-A1 through B1-A4 | Pending |
| B1-P: Parallelization | B1-P1 through B1-P4 | Pending |

## Scope Exclusions

- Full agent platform (Solution C)
- Agent testing framework
- Cost monitoring dashboard
- New agent creation (audit-dimension, failure-triager)
