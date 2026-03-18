# Request: Deep Explore — Multi-Wave Code Exploration Orchestrator

> **Created**: 2026-03-18
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Source**: 2 rounds `/best-practices` audit + `/codex-brainstorm` Nash Equilibrium (threadIds: `019d0095-6b65-7f31-90cf-d323f8a93ea4`, `019d009d-c64e-7542-b222-5d9ec3f80aaa`)

## Background

`/code-explore` 是單 agent 單輪探索，無法覆蓋大型 codebase 的多個面向。`/code-investigate` 提供雙視角但仍是單輪。使用者需要 multi-wave, multi-agent orchestrator 來快速了解跨域系統，並能發現使用者沒想到的角度。

## Requirements

- 新建 `/deep-explore` skill + command
- Multi-wave architecture: 至少 2 waves（mandatory），最多 3 waves（adaptive）
- 每波 2-3 個 Explore agents 並行調研不同 areas
- 80/20 contract: 80% primary + 20% peripheral vision
- 2-signal completeness score (novelty rate + critical open questions)
- Claim-registry synthesis with conflict resolution + divergence section
- Routing guard: small tasks redirect to `/code-explore`
- Inter-wave context: summary + question backlog + do-not-repeat ledger

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md, command, reference files (agent-prompt, synthesis), tests, CLAUDE.md entry |
| Out | Custom agent profile (v2), checklist-mode scoring (v2), Codex integration (use /code-investigate) |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/deep-explore/SKILL.md` | New | Orchestrator workflow + wave strategy + completeness model |
| `skills/deep-explore/references/agent-prompt.md` | New | Per-agent prompt template (80/20 contract) |
| `skills/deep-explore/references/synthesis.md` | New | Claim registry + report template |
| `commands/deep-explore.md` | New | Command wrapper with arguments |
| `CLAUDE.md` | Modify | Add `/deep-explore` to Command Quick Reference |
| `.claude/CLAUDE.md` | Modify | Same |
| `CLAUDE.template.md` | Modify | Add entry |
| `test/commands/deep-explore.test.js` | New | Content assertions |

## Acceptance Criteria

- [x] SKILL.md has multi-wave workflow (Wave 1 breadth + Wave 2 depth + optional Wave 3)
- [x] SKILL.md has 80/20 agent contract (max 2 peripheral findings)
- [x] SKILL.md has 2-signal completeness score (novelty + critical open Qs)
- [x] SKILL.md has routing guard (redirect to /code-explore for small tasks)
- [x] SKILL.md has claim registry synthesis (normalize → dedup → consensus → conflict → divergence)
- [x] SKILL.md has inter-wave context packet spec
- [x] Command has `--agents`, `--waves`, `--areas` arguments
- [x] CLAUDE.md has `/deep-explore` entry
- [x] Agent prompt reference exists with 80/20 contract + output schema
- [x] Synthesis reference exists with claim registry + report template
- [x] Tests pass (11/11 + 214 total)
- [x] `/codex-review-doc` pass (tech spec: 2 rounds → ✅ Mergeable)
- [x] `/precommit-fast` pass (214 tests, 0 errors)
- [x] Pilot gate documented in tech spec (5 runs, 90% compliance threshold)
- [x] First `/deep-explore` invocation completed successfully (53 skills surveyed, score 92/100)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Best Practices | ✅ Done | 2 rounds audit + 4 debate rounds |
| Tech Spec | ✅ Done | `docs/features/deep-explore/2-tech-spec.md` |
| Development | ✅ Done | SKILL.md + 2 references + command + CLAUDE.md entries |
| Testing | ✅ Done | 11 assertions + 214 total tests pass |
| Verification | ✅ Done | Tech spec review ✅ Mergeable + precommit ✅ All Pass |
| Field Testing | ✅ Done | First invocation: 53 skills surveyed, 3 agents, score 92/100 |

## References

- Best Practices threadId 1: `019d0095-6b65-7f31-90cf-d323f8a93ea4` (architecture)
- Best Practices threadId 2: `019d009d-c64e-7542-b222-5d9ec3f80aaa` (multi-wave model)
- Industry: [OpenAI Deep Research](https://openai.com/index/introducing-deep-research/), [Anthropic Agentic Coding 2026](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf), [Agent Orchestration Patterns](https://gurusup.com/blog/agent-orchestration-patterns)
