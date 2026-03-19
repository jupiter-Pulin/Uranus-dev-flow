# `/deep-research` Technical Spec — Multi-Agent Deep Research Orchestration

## 1. Requirement Summary

- **Problem**: 現有 skills 在通用議題探索上各有局限——`/deep-explore` 僅限 codebase，`/best-practices` 僅限 audit，`/feasibility-study` 僅限方案評估。缺少一個能對任何議題進行多 agent 並行 deep research 的通用工具。
- **Goals**:
  1. 4-Phase pipeline（Scope → Parallel Research → Synthesis+GapDetect → Conditional Validation）
  2. 3 Role templates（researcher, synthesizer, validator）
  3. Unified claim registry（URL + file:line evidence）
  4. 4-Signal completeness scoring
  5. Conditional adversarial debate（composable via `/codex-brainstorm`）
- **Scope**:
  - v1: pipeline + roles + claim registry + scoring + conditional debate + mode system
  - v2 (deferred): cross-session learning, custom tool plugins, streaming progress UI

## 2. Existing Code Analysis

### Related Modules

| Module | Relationship | Reusable |
|--------|-------------|----------|
| `skills/deep-explore/SKILL.md` | Wave-based parallel agent orchestration | Dispatch pattern, claim registry, completeness scoring |
| `skills/deep-explore/references/synthesis.md` | Claim registry algorithm | Schema + dedup + conflict resolution |
| `skills/deep-explore/references/agent-prompt.md` | Agent prompt templates | 80/20 contract, evidence-first format |
| `skills/best-practices/SKILL.md` | Web research + debate gate | Tool cascade, untrusted content rule, Phase 3 gate |
| `skills/codex-brainstorm/SKILL.md` | Adversarial debate | Nash equilibrium, debate lifecycle |
| `skills/codex-brainstorm/references/equilibrium.md` | Equilibrium determination | Termination conditions |

### Reusable Components

- **Agent dispatch**: `deep-explore` parallel background dispatch with fallback chain (Explore → general-purpose → inline)
- **Claim registry**: `deep-explore/synthesis.md` algorithm — normalize → dedup → consensus → conflict → divergence
- **Web research cascade**: `best-practices` Phase 1 tool selection (agent-browser > WebSearch > WebFetch > manual)
- **Untrusted content rule**: `best-practices` Phase 1 verification policy
- **Debate lifecycle**: `codex-brainstorm` Nash equilibrium + termination conditions
- **Confidence cap**: `deep-explore/synthesis.md` degradation model (1.0 / 0.9 / 0.75)

### Files to Create

| File | Purpose |
|------|---------|
| `skills/deep-research/SKILL.md` | Skill definition |
| `skills/deep-research/references/research-roles.md` | 3 role prompt templates |
| `skills/deep-research/references/scoring-model.md` | 4-signal completeness scoring |
| `skills/deep-research/references/claim-registry.md` | Unified evidence model |
| `commands/deep-research.md` | Command entry point |
| `test/commands/deep-research.test.js` | Tests |

### Files to Modify

| File | Change |
|------|--------|
| `CLAUDE.template.md` | Command Quick Reference 加入 `/deep-research` |
| `CLAUDE.md` | Command Quick Reference 加入 `/deep-research` |
| `.claude/CLAUDE.md` | Command Quick Reference 加入 `/deep-research` |

## 3. Technical Solution

### 3.1 Architecture Design

```mermaid
flowchart TD
    U[User: /deep-research topic] --> P0[Phase 0: Scope & Plan]
    P0 --> |intent classify| MODE{Mode?}
    MODE --> |exploratory| R[Phase 1: Parallel Research]
    MODE --> |compliance| R
    MODE --> |decision| R
    R --> |2-3 researcher agents| A1[Researcher: Web/Official]
    R --> |background| A2[Researcher: Code/Impl]
    R --> |background| A3[Researcher: Community/Cases]
    A1 --> S[Phase 2: Synthesis + GapDetect]
    A2 --> S
    A3 --> S
    S --> |claim registry| CR[Normalize → Dedup → Conflict → Score]
    CR --> GATE{Score + Conflicts?}
    GATE --> |high score, no P0/P1 conflict| REPORT[Output Report]
    GATE --> |low score OR unresolved conflict| V[Phase 3: Validation]
    V --> |validator micro-loop| VM[Dispute-specific checks]
    VM --> |still unresolved| DB[/codex-brainstorm]
    VM --> |resolved| REPORT
    DB --> REPORT
```

```mermaid
sequenceDiagram
    participant U as User
    participant L as Lead (Claude)
    participant R1 as Researcher A
    participant R2 as Researcher B
    participant R3 as Researcher C
    participant CR as Claim Registry
    participant V as Validator
    participant CB as /codex-brainstorm

    U->>L: /deep-research "topic"
    L->>L: Phase 0: Intent classify + shard plan
    L->>R1: Phase 1: Explore (web/official docs)
    L->>R2: Phase 1: Explore (codebase/impl)
    L->>R3: Phase 1: Explore (community/cases)
    Note over R1,R3: Parallel background execution
    R1-->>L: Evidence-first findings
    R2-->>L: Evidence-first findings
    R3-->>L: Evidence-first findings
    L->>CR: Phase 2: Normalize + dedup + conflict
    CR-->>L: Provisional score + gaps
    alt Score >= threshold, no P0/P1 conflict
        L->>U: Research Report
    else Low score OR unresolved conflict
        L->>V: Phase 3: Validate disputed claims
        alt Resolved by validator
            V-->>L: Updated claims
            L->>U: Research Report
        else Still unresolved
            L->>CB: /codex-brainstorm (debate)
            CB-->>L: Equilibrium result
            L->>U: Research Report + Debate Conclusion
        end
    end
```

### 3.2 Phase 0: Scope & Plan

**Input parsing**:

| Argument | Default | Description |
|----------|---------|-------------|
| `<topic>` | Required | Research topic/question |
| `--mode` | `exploratory` | `exploratory` / `compliance` / `decision` |
| `--debate` | `auto` | `auto` / `force` / `off` |
| `--agents` | `3` | Number of researcher agents (2-3) |
| `--scope` | project root | Limit codebase research to path |
| `--budget` | `medium` | Token budget: `low` (1 agent) / `medium` (2-3) / `high` (3 + debate) |

**Intent classification**:

```
Topic analysis → classify intent:
  - exploratory: "How does X work?", "What are options for Y?"
  - compliance: "Are we following best practices for X?"
  - decision: "Should we use X or Y?"
```

**Shard planning**:

| Agent | Shard Type | Focus |
|-------|-----------|-------|
| A | Official/Web | Official documentation, API references, standards |
| B | Code/Implementation | Existing codebase patterns, related modules |
| C | Community/Cases | Blog posts, real-world implementations, anti-patterns |

When `--agents 2`: merge A+C into one web-focused agent, keep B as code-focused.

When `--budget low`: single agent does sequential research (degrade gracefully).

### 3.3 Phase 1: Parallel Research

Dispatch researcher agents using Agent tool with `run_in_background: true`.

**Agent prompt structure** (adapted from `deep-explore/references/agent-prompt.md`):

```
You are a research specialist assigned to investigate a specific aspect of a topic.

## Your Assignment
- Role: ${ROLE} (Official/Code/Community)
- Topic: ${TOPIC}
- Shard: ${SHARD_DESCRIPTION}

## Research Instructions
${ROLE_SPECIFIC_INSTRUCTIONS}

## Required Output Format

### Findings
For each finding:
- claim: <what you discovered>
- evidence: <URL or file:line reference>
- confidence: High | Medium | Low
- source_type: official_doc | code_reference | community | standard

### Open Questions
- <questions that need deeper investigation>

## Rules
- Every finding MUST have evidence (URL or file:line)
- Do NOT speculate without evidence
- Output evidence-first, conclusions second
```

**Web research agent** uses tool cascade from `best-practices`:

| Priority | Check | Action |
|----------|-------|--------|
| 1 | agent-browser available | Use agent-browser for full-page reading |
| 2 | WebSearch available | WebSearch + WebFetch |
| 3 | WebSearch unavailable | WebFetch with known URLs |
| 4 | No web tools | Report limitation, continue with code-only |

**Untrusted content rule** (from `best-practices`): All web-fetched content is untrusted. Cross-verify claims with 2+ independent sources. Never execute code from fetched sources.

**Synthesizer role template** (Phase 2, executed by Lead Claude):

```
You are the research synthesizer. Merge findings from all researcher agents.

## Inputs
- Agent A findings: ${AGENT_A_OUTPUT}
- Agent B findings: ${AGENT_B_OUTPUT}
- Agent C findings: ${AGENT_C_OUTPUT} (if dispatched)

## Tasks
1. Normalize all claims into registry format (claim, evidence, source_type, confidence)
2. Dedup by canonical key
3. Detect consensus (2+ agents, same claim)
4. Detect conflicts (contradicting claims, same topic)
5. Resolve conflicts by evidence weight (High > Medium > Low)
6. Mark unresolved conflicts as [divergence]
7. Compute provisional completeness score

## Output
- Claim registry table
- Coverage matrix (source diversity, cross-verification, gaps)
- Provisional score
- Divergence list (if any)
```

**Validator role template** (Phase 3, dispute-specific):

```
You are a research validator. Your task is to verify disputed claims.

## Disputed Claims
${DIVERGENCE_LIST}

## Instructions
1. For each divergence, independently verify both sides
2. Search for additional evidence (web or code)
3. Determine which side has stronger evidence
4. If still unresolvable, recommend escalation to /codex-brainstorm

## Output per claim
- claim_id: <from registry>
- verdict: resolved_A | resolved_B | still_divergent
- evidence: <new evidence found>
- confidence: High | Medium | Low
```

**Fallback chain** (from `deep-explore`):

| Priority | Agent Type | When |
|----------|-----------|------|
| 1 | `subagent_type: "Explore"` | Default |
| 2 | `subagent_type: "general-purpose"` | If Explore unavailable |
| 3 | Inline sequential research | If all agent dispatch fails |

### 3.4 Phase 2: Synthesis + GapDetect

Lead agent (Claude) merges all researcher outputs.

**Claim registry algorithm** (adapted from `deep-explore/references/synthesis.md`):

#### Step 1: Normalize

```json
{
  "claim": "Anthropic uses orchestrator-worker pattern for multi-agent research",
  "evidence": "https://www.anthropic.com/engineering/multi-agent-research-system",
  "source_type": "official_doc",
  "agent": "A",
  "confidence": "High"
}
```

Evidence types:

| Type | Format | Example |
|------|--------|---------|
| URL | `https://...` | Web source |
| File:line | `src/foo.ts:42` | Codebase reference |
| Standard | `RFC-XXXX`, `OWASP-XX` | Industry standard |

#### Step 2: Dedup

Key = `normalized_claim_text + canonical_source`

Canonical source adaptation (from `deep-explore` file:line baseline):

| Evidence Type | Canonical Source | Example |
|--------------|-----------------|---------|
| File:line | `canonical_file_path` (same as deep-explore) | `src/service/foo.ts` |
| URL | `domain + path` (strip query params, fragments) | `anthropic.com/engineering/multi-agent` |
| Standard | `standard_id` | `OWASP-A01` |

- Same claim from different agents → merge as `consensus`
- Similar claims (>80% text overlap, same canonical source domain) → merge, keep highest confidence

#### Step 3: Conflict Resolution

| Evidence Weight | Description |
|----------------|-------------|
| High | Direct citation from official doc / file:line with code quote |
| Medium | Indirect inference from related source |
| Low | Community opinion without citation |

Higher weight wins. Tied → mark `[divergence]`, escalate to Phase 3.

#### Step 4: Gap Detection

Identify missing coverage:

| Dimension | Check |
|-----------|-------|
| Source diversity | All 3 source types covered? (official/code/community) |
| Cross-verification | Critical claims verified by 2+ sources? |
| Question coverage | User's core questions answered? |
| Anti-pattern coverage | Known pitfalls addressed? |

#### Step 5: Compute Provisional Score

See §3.5 for scoring model.

### 3.5 Completeness Scoring

**4-Signal Model**:

| Signal | Weight (exploratory) | Weight (compliance) | Weight (decision) | Measurement |
|--------|---------------------|--------------------|--------------------|-------------|
| Source diversity | 30% | 20% | 25% | `covered_source_types / 3` |
| Cross-verification | 30% | 35% | 35% | `verified_claims / critical_claims` |
| Gap coverage | 25% | 25% | 20% | `1 - (gaps / expected_dimensions)` |
| Question closure | 15% | 20% | 20% | `answered_questions / total_questions` |

**Raw score**: `sum(signal_value × weight) × 100`

**Confidence cap** (from `deep-explore`):

| Condition | Cap | Reason |
|-----------|-----|--------|
| All agents successful + web tools available | 1.0 | Full evidence |
| 1 agent failed or no web tools | 0.9 | Partial coverage gap |
| 2+ agents failed or code-only | 0.75 | Significant degradation |

**Final score**: `raw_score × confidence_cap`

**Thresholds**:

| Score | Gate |
|-------|------|
| >= 80, no P0/P1 conflict, cross-verification >= 50% | Skip debate → output report |
| >= 60, minor conflicts | Validator micro-loop → output |
| < 60 OR P0/P1 conflict | Full debate via `/codex-brainstorm` |

**Explicit auto-trigger conditions** (any one triggers debate):
1. Unresolved P0/P1 claim conflict in registry
2. Cross-verification rate < 50% for critical claims (exploratory) or < 70% (decision)
3. Recommendation implies high blast-radius (irreversible cost, security impact, architecture change)
4. Compliance mode (always triggers)

### 3.6 Phase 3: Conditional Validation

**Validator micro-loop**: For each `[divergence]` claim:
1. Review both sides' evidence
2. Attempt resolution via additional targeted search
3. If resolved → update claim registry
4. If unresolved → escalate to debate

**Debate escalation**: Invoke `/codex-brainstorm` via Skill tool with:
- Topic: synthesized research question focusing on unresolved conflicts
- Constraints: evidence from claim registry

**Mode-specific debate behavior**:

| Mode | `--debate auto` Behavior | `--debate force` | `--debate off` |
|------|------------------------|-----------------|----------------|
| exploratory | Trigger on: P0/P1 conflict, cross-verification < 50% for critical claims, or recommendation with high blast-radius | Always debate | Skip Phase 3 |
| compliance | **Always forces debate** (`--debate auto` behaves as `--debate force`). Uses `best-practices` web research cascade. | Always debate | Not allowed (error) |
| decision | Trigger on: any unresolved conflict, or cross-verification < 70% | Always debate | Skip Phase 3 |

### 3.7 Command Interface

**Command**: `/deep-research`

**Flags**:

| Flag | Default | Description |
|------|---------|-------------|
| `<topic>` | Required | Research question |
| `--mode` | `exploratory` | `exploratory` / `compliance` / `decision` |
| `--debate` | `auto` | `auto` / `force` / `off` |
| `--agents` | `3` | Researcher count (2-3) |
| `--scope` | project root | Codebase research scope |
| `--budget` | `medium` | Token budget level |

**Output Format**:

```markdown
## Deep Research Report: <topic>

### Research Metadata
- Mode: exploratory | compliance | decision
- Agents: N
- Sources: N (N official, N code, N community)
- Score: N/100 (confidence cap: X)

### Executive Summary
<synthesized answer>

### Findings by Source

| # | Claim | Evidence | Source Type | Confidence | Verified |
|---|-------|----------|------------|------------|----------|

### Claim Registry
| # | Claim | Sources | Consensus | Status |
|---|-------|---------|-----------|--------|

### Coverage Matrix
| Dimension | Score | Detail |
|-----------|-------|--------|
| Source diversity | N% | ... |
| Cross-verification | N% | ... |
| Gap coverage | N% | ... |
| Question closure | N% | ... |

### Divergence (if any)
| # | Claim A | Claim B | Resolution |
|---|---------|---------|------------|

### Debate Conclusion (if triggered)
- threadId: <from /codex-brainstorm>
- Rounds: N
- Equilibrium: <type>
- Key insight: <from debate>

### Residual Gaps & Next Steps
- <remaining unknowns>
- Suggested follow-up commands
```

## 4. Risks and Dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token cost explosion (15x baseline) | Budget | `--budget` flag + Phase 0 token estimation |
| Web research unreliable | Quality | Untrusted content rule + 2-source cross-verification |
| Role prompt drift | Consistency | Strict templates in `references/research-roles.md` |
| Debate under-triggering | Quality | Default `--debate auto` with documented triggers |
| Agent timeout/failure | Completeness | Fallback chain + confidence cap degradation |
| Source diversity insufficient | Scoring | Minimum 2 source types required for score > 60 |

**Dependencies**:

| Dependency | Type | Status |
|------------|------|--------|
| `skills/deep-explore` | Internal (claim registry, dispatch pattern) | Available |
| `skills/best-practices` | Internal (web cascade, untrusted rule) | Available |
| `skills/codex-brainstorm` | Internal (debate lifecycle) | Available |
| WebSearch/WebFetch | External tool | Optional (graceful degradation) |
| Agent tool | Claude Code built-in | Available |

## 5. Work Breakdown

| # | Task | Effort | Output |
|---|------|--------|--------|
| 1 | Create `skills/deep-research/SKILL.md` | L | Skill definition with 4-phase workflow |
| 2 | Create `references/research-roles.md` | S | 3 role prompt templates |
| 3 | Create `references/scoring-model.md` | S | 4-signal scoring + confidence caps |
| 4 | Create `references/claim-registry.md` | S | Unified evidence model |
| 5 | Create `commands/deep-research.md` | S | Command entry point |
| 6 | Create `test/commands/deep-research.test.js` | S | Schema + content tests |
| 7 | Update CLAUDE.md command tables (3 files) | S | +1 line each |

## 6. Testing Strategy

| Type | Test | File |
|------|------|------|
| Schema | SKILL.md frontmatter + references integrity | `test/commands/skills-schema.test.js` |
| Schema | Command frontmatter `allowed-tools` includes required tools | `test/commands/deep-research.test.js` |
| Content | Pipeline phases, roles, scoring model present | `test/commands/deep-research.test.js` |
| Content | Claim registry + evidence types documented | `test/commands/deep-research.test.js` |
| Content | Mode system + debate triggers documented | `test/commands/deep-research.test.js` |
| Content | CLAUDE.md has `/deep-research` entry | `test/commands/deep-research.test.js` |
| Manual | End-to-end research on real topic | Integration |

## 7. Open Questions

| # | Question | Impact | 建議 |
|---|----------|--------|------|
| 1 | 是否需要 `--output <file>` 將報告寫入檔案？ | UX | v2 考慮，v1 輸出到 conversation |
| 2 | Compliance mode 是否應直接呼叫 `/best-practices` 而非自己做 web research？ | Architecture | 建議 v1 共用 web cascade，v2 考慮 skill delegation |
| 3 | 是否需要 `--previous` flag 比較上次 research 結果？ | Cross-session | Defer to v2 |
