# Multi-Agent Deep Research Skill (`/deep-research`)

> **Created**: 2026-03-19
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Best Practices Audit**: Phase 4 Gap Report (conversation 2026-03-19)
> **Brainstorm threadId**: `019d053d-e515-7ca2-bd8b-f676c23d9d83`

## Background

現有 skills 在通用議題探索上有缺口：`/deep-explore` 只能探索 codebase，`/best-practices` 僅限 audit 場景，`/feasibility-study` 聚焦方案評估。缺少一個能對**任何議題**進行多 agent 並行 deep research 的通用工具——結合 web research + codebase analysis + adversarial validation。

業界趨勢（Anthropic/OpenAI/LangChain）: orchestrator-worker pattern, parallel sub-agent exploration, claim registry synthesis, conditional adversarial debate。

## Requirements

| 需求 | 說明 |
|------|------|
| 4-Phase Pipeline | Scope → Parallel Research → Synthesis+GapDetect → Conditional Validation |
| 3 Role Templates | researcher（evidence-first）, synthesizer（claim registry + conflict resolution）, validator（dispute check + debate escalation） |
| Parallel Web + Code Research | 2-3 researcher agents in background, each with distinct shard（source type or domain） |
| Claim Registry | Unified evidence model（URL + file:line），dedup, conflict resolution by evidence weight |
| Completeness Scoring | 4-signal: source_diversity 30% + cross_verification 30% + gap_coverage 25% + question_closure 15% × confidence_cap |
| Conditional Debate | `--debate auto`: trigger on unresolved P0/P1 conflict, low cross-verification, high blast-radius recommendation |
| Mode System | `--mode exploratory\|compliance\|decision` controls scoring weights and debate threshold |
| Composable | Reuse `/codex-brainstorm` for debate, `deep-explore` claim registry, `best-practices` web research cascade |

## Scope

| Scope | Description |
|-------|-------------|
| In | 4-phase pipeline, 3 role templates, parallel research dispatch, claim registry (URL + file:line), 4-signal completeness scoring, conditional debate trigger, mode system, token budget cap |
| Out | Persistent cross-session learning（v2）, custom tool plugins（v2）, streaming progress UI（v2） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/deep-research/SKILL.md` | New | Skill definition (4-phase workflow, role templates, scoring model) |
| `skills/deep-research/references/research-roles.md` | New | 3 role prompt templates (researcher, synthesizer, validator) |
| `skills/deep-research/references/scoring-model.md` | New | 4-signal completeness scoring + confidence caps |
| `skills/deep-research/references/claim-registry.md` | New | Unified evidence model adapted from deep-explore synthesis |
| `commands/deep-research.md` | New | Command entry point + allowed-tools |
| `test/commands/deep-research.test.js` | New | Schema + content validation tests |
| `CLAUDE.template.md` | Modify | Command Quick Reference 加入 `/deep-research` |
| `CLAUDE.md` | Modify | Command Quick Reference 加入 `/deep-research` |
| `.claude/CLAUDE.md` | Modify | Command Quick Reference 加入 `/deep-research` |

## Acceptance Criteria

### AC1: Pipeline Architecture

- [x] 4-phase workflow: Scope → Parallel Research → Synthesis+GapDetect → Conditional Validation
- [x] Phase 0 produces research plan with shard assignments + token budget
- [x] Phase 1 dispatches 2-3 researcher agents in parallel (background)
- [x] Phase 2 synthesizer merges results via claim registry + computes provisional score

### AC2: Role System

- [x] 3 distinct role templates: researcher, synthesizer, validator
- [x] Researcher outputs evidence-first findings (not conclusions)
- [x] Synthesizer handles dedup, conflict resolution, gap detection
- [x] Validator runs dispute-specific checks on contested claims

### AC3: Claim Registry

- [x] Unified evidence model supports both URL (web) and file:line (code)
- [x] Dedup by canonical key (source + claim text normalization)
- [x] Conflict resolution by evidence weight (High > Medium > Low)
- [x] Unresolved conflicts escalated to validation phase

### AC4: Completeness Scoring

- [x] 4-signal model: source_diversity + cross_verification + gap_coverage + question_closure
- [x] Confidence cap applied (1.0 / 0.9 / 0.75 based on tool availability)
- [x] Score threshold gates Phase 3 debate trigger

### AC5: Mode System

- [x] `--mode exploratory` (default): uses exploratory scoring weights (diversity 30%, verification 30%, gap 25%, closure 15%)
- [x] `--mode compliance`: forces debate (`--debate force` implied), uses `best-practices` web research cascade
- [x] `--mode decision`: higher debate trigger threshold (any unresolved conflict triggers debate)

### AC6: Conditional Debate

- [x] `--debate auto` (default): trigger on P0/P1 conflict, low verification, high blast-radius
- [x] `--debate force`: always invoke `/codex-brainstorm`
- [x] `--debate off`: skip validation phase entirely
- [x] Debate uses `/codex-brainstorm` via Skill tool (not raw MCP)

### AC7: Composable Reuse

- [x] Claim registry follows `deep-explore/references/synthesis.md` schema (adapted for URL evidence)
- [x] Web research uses `best-practices` Phase 1 tool cascade (agent-browser > WebSearch > WebFetch)
- [x] Adversarial debate delegates to `/codex-brainstorm` (not reimplemented)

### AC8: Infrastructure

- [x] `commands/deep-research.md` frontmatter with correct allowed-tools
- [x] CLAUDE.md command tables updated (3 files)
- [x] Tests pass (schema + content validation) — 14/14 tests
- [x] `skills-schema.test.js` passes (no dangling refs)

## Design Decisions (from Brainstorm)

| 決策 | 選擇 | 替代方案 | 理由 |
|------|------|----------|------|
| Phase count | 4 phases | 6 phases (Codex initial) | Merge analyst+critic reduces latency + token cost without quality loss |
| Role count | 3 roles | 4 roles (+ critic) | Role prompt drift risk with 4; critic absorbed into validator |
| Scoring model | 4-signal exploratory | 2-signal (deep-explore style) | Web research needs source diversity + cross-verification, not just novelty |
| Debate trigger | Conditional (auto) | Always mandatory (best-practices style) | 15x token cost; force only for compliance mode |
| Composition | Reuse existing skills | Self-contained | Lower maintenance, consistent behavior across skills |

## Progress

- [x] Best practices audit (Phase 1-4, 5 independent sources)
- [x] Adversarial brainstorm (3 rounds, Pure Strategy Equilibrium)
- [x] Tech spec — `docs/features/deep-research/2-tech-spec.md`
- [x] Implementation — commit `7f19a57`
- [x] Testing — 14/14 tests pass (`test/commands/deep-research.test.js`)
- [x] Documentation — SKILL.md (294 lines) + 3 references + CLAUDE.md updated
