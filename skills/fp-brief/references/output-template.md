# FP-Brief Output Template

## Header Metadata

```markdown
# First-Principles Briefing: <document title>

> Source: <relative path to source doc>
> Depth: brief | normal | deep
> Format detected: tech-spec | feasibility-study | request-doc | unknown (confidence: high | medium | low)
> Generated: <ISO 8601 timestamp>
```

## Section Templates

### 1. Root Problem

```markdown
## 1. Root Problem

### Surface Problem
<what the document explicitly states as the problem>

### First-Principles Decomposition
1. Why is this a problem? → <answer from document>
2. Why does <answer> matter? → <deeper reason>
3. Why is <deeper reason> unavoidable? → <fundamental constraint>
4. Why can't existing solutions address this? → <gap analysis>
5. Why is this gap critical now? → <trigger/urgency>

### Fundamental Truth
> <one-sentence irreducible statement of the core problem>
```

### 2. Assumptions Register

```markdown
## 2. Assumptions Register

| # | Assumption | Source Section | Confidence | If Wrong... |
|---|-----------|---------------|------------|-------------|
| A1 | <stated or implied assumption> | §<section heading> | High/Medium/Low | <consequence if invalid> |
| A2 | ... | ... | ... | ... |
```

### 3. Reasoning Chain

```markdown
## 3. Reasoning Chain

### Decision D1: <decision name>
- **Principle**: <fundamental truth or constraint that drives this decision>
- **Reasoning**: Because <principle P>, and given constraint <C>, therefore <decision D>
- **Source**: §<section heading in source doc>

### Decision D2: <decision name>
- **Principle**: ...
- **Reasoning**: ...
- **Source**: ...
```

### 4. Alternative Rejection Log

```markdown
## 4. Alternative Rejection Log

| # | Alternative | Rejected Because | First-Principle Basis |
|---|-----------|-----------------|----------------------|
| R1 | <rejected approach> | <specific reason> | Violates assumption A<N> / Contradicts principle P<N> |
| R2 | ... | ... | ... |
```

### 5. Decision Sensitivity

```markdown
## 5. Decision Sensitivity

| Assumption | If Wrong → Affected Decisions | Impact |
|-----------|------------------------------|--------|
| A1 | D1, D3 | High — <what changes> |
| A2 | D2 | Low — <limited effect> |
```

### 6. Open Unknowns

```markdown
## 6. Open Unknowns

| # | Unknown | Source | Risk Level | Suggested Resolution |
|---|---------|--------|------------|---------------------|
| U1 | <what we don't know> | Document §<ref> / Inferred | High/Medium/Low | <how to resolve> |
```

### 7. Verification Delta (optional)

```markdown
## 7. Verification Delta

| Aspect | Claude Assessment | Codex Assessment | Delta |
|--------|------------------|------------------|-------|
| Root Problem depth | <adequate/shallow> | <adequate/shallow> | <agree/disagree + detail> |
| Missing assumptions | <none/list> | <none/list> | <new findings> |
| Reasoning gaps | <none/list> | <none/list> | <logical jumps found> |
| Sensitivity completeness | <complete/partial> | <complete/partial> | <missing links> |
```

## Depth Matrix

| # | Section | brief | normal | deep |
|---|---------|:-----:|:------:|:----:|
| 1 | Root Problem | Full | Full | Full |
| 2 | Assumptions Register | Top 3 only | Full list | Full + challenge questions per assumption |
| 3 | Reasoning Chain | Key decisions only (summary) | Full chain with source citations | Full + evidence strength rating per decision |
| 4 | Alternative Rejection Log | Omitted | Full | Full + counterfactual analysis |
| 5 | Decision Sensitivity | Top 3 sensitive decisions | Full mapping | Full + sensitivity matrix table |
| 6 | Open Unknowns | Omitted | Full | Full + risk-weighted prioritization |
| 7 | Verification Delta | Omitted | Only if `--verify codex` | Only if `--verify codex` |

## Length Policy

| Depth | Max Length | Minimum Evidence Rule |
|-------|-----------|----------------------|
| brief | ~500 words (upper bound) | Each included section must cite at least 1 source section |
| normal | ~1500 words (upper bound) | Each section must cite at least 1 source section |
| deep | ~2500 words (upper bound) | Each section must cite at least 2 source sections |

These are caps, not targets. If source document is thin, output will be shorter.

## Evidence Insufficient Rule

When a section cannot be populated due to insufficient source data:

```markdown
[Evidence insufficient — source doc lacks data for this section]
```

Never fabricate reasoning, assumptions, or alternatives not grounded in the source document.
