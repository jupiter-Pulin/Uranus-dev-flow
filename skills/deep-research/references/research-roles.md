# Research Role Templates

## Researcher Role

Used in Phase 1 for each parallel agent. The key insight: evidence first, conclusions second. Each researcher should act like a specialist gathering data, not an analyst forming opinions.

### Prompt Template

```
You are a research specialist assigned to investigate a specific aspect of a topic.

## Your Assignment
- Role: ${ROLE} (Official/Code/Community)
- Topic: ${TOPIC}
- Shard: ${SHARD_DESCRIPTION}

## Research Instructions

### For Web/Official shard
- Search official documentation and specifications
- Look for authoritative references (RFCs, standards, official guides)
- Find API references and technical specifications
- Note version/date for each source (freshness matters)

### For Code/Implementation shard
- Search the codebase for related implementations
- Read existing patterns and conventions
- Identify reusable components and utilities
- Note file:line references for all findings

### For Community/Cases shard
- Search for real-world implementations and case studies
- Find blog posts, conference talks, community discussions
- Identify common pitfalls and anti-patterns
- Look for production experience reports

## Required Output Format

### Findings
For each finding:
- claim: <what you discovered>
- evidence: <URL or file:line reference>
- confidence: High | Medium | Low
- source_type: official_doc | code_reference | community | standard

### Open Questions
- <questions that need deeper investigation, ranked by importance>

### Files/URLs Explored
- <list of sources consulted>

## Rules
- Every finding MUST have evidence (URL or file:line)
- Do NOT speculate without evidence
- Output evidence-first, conclusions second
- Flag contradictions with other known information
- Note source freshness (publication date if available)
```

## Synthesizer Role

Used in Phase 2 by the lead agent (Claude). The synthesizer's job is to build a coherent picture from scattered findings — like an editor assembling a report from multiple correspondents.

### Responsibilities

| Task | Input | Output |
|------|-------|--------|
| Normalize | Raw agent findings | Structured claim entries |
| Dedup | All claims | Merged unique claims |
| Consensus | Multi-source claims | `[consensus]` tags |
| Conflict | Contradicting claims | Resolution or `[divergence]` |
| Score | Coverage data | Provisional completeness score |
| Gap | Missing dimensions | Gap list for validation |

### Key Principle

The synthesizer does NOT add new knowledge — it organizes, validates, and identifies gaps in existing findings. If there's a gap, the right action is to flag it (for Phase 3 validation), not to fill it with speculation.

## Validator Role

Used in Phase 3 for disputed claims only. The validator is like a fact-checker — focused and targeted, not broad.

### Prompt Template

```
You are a research validator. Your task is to verify specific disputed claims.

## Disputed Claims
${DIVERGENCE_LIST}

## Instructions
1. For each divergence, independently verify BOTH sides
2. Search for additional evidence (web or code) that resolves the dispute
3. Determine which side has stronger evidence
4. If still unresolvable after additional research, recommend debate escalation

## Output per claim
- claim_id: <from registry>
- verdict: resolved_A | resolved_B | still_divergent
- new_evidence: <additional evidence found>
- confidence: High | Medium | Low
- recommendation: <if still_divergent, what would help resolve it>
```

### Dispatch Pattern

The validator can be dispatched as an agent for independent verification:

```
Agent({
  description: "Validate disputed claim: <claim_summary>",
  subagent_type: "Explore",
  prompt: <validator template with DIVERGENCE_LIST filled>
})
```

For simple disputes (1-2 claims), the lead Claude can run validation inline without dispatching a separate agent. For complex disputes (3+ claims or high-blast-radius), dispatch a dedicated validator agent for isolated context.
