# Extraction Guide

Section-by-section heuristics for extracting first-principles reasoning from source documents.

## Pre-Extraction: Security Checks

### Path Validation

```
1. Normalize path (resolve symlinks)
2. Reject paths containing `..` traversal
3. Verify path is within repo root: git rev-parse --show-toplevel
4. If validation fails → abort with error message
```

### Secret Redaction (Fail-Safe)

| Pattern Type | Examples | Action |
|-------------|---------|--------|
| High-confidence | `sk-...`, `ghp_...`, `-----BEGIN PRIVATE KEY-----`, `AKIA...` | Abort — do not produce output |
| Medium-confidence | Long hex strings, `password=...`, `token=...` | Mask as `[REDACTED]` in output, emit warning |
| No match | — | Proceed normally |

## Section 1: Root Problem

**Core question**: What fundamental truth makes this problem unavoidable?

**Extraction method**: Reverse 5-Why from the document's stated problem.

```
1. Find the document's problem statement (§1, §Overview, or first heading)
2. Ask "Why is this a problem?" — answer from document context
3. Ask "Why does that matter?" — trace to a deeper constraint
4. Continue until reaching an irreducible truth (physics, math, human nature, business law)
5. The irreducible truth is the Fundamental Truth
```

**Anti-pattern**: Do NOT copy the problem statement verbatim. The goal is to go deeper than the document's own framing.

## Section 2: Assumptions Register

**Core question**: What are we taking for granted, and why?

**Extraction signals** — scan for these patterns in the source document:

| Signal Pattern | Example | Extraction |
|---------------|---------|------------|
| Explicit assumption | "Assuming X..." | Direct capture |
| Constraint statement | "Due to X limitation..." | Capture as assumption that X is true |
| Scope boundary | "Out of scope: X" | Assumption that X is not needed |
| Technology choice | "Using Redis for..." | Assumption that Redis is appropriate |
| Architecture decision | "Standalone skill..." | Assumption that separation is better than integration |

**For each assumption, record**:
- `#`: Sequential ID (A1, A2, ...)
- `Assumption`: What is assumed to be true
- `Source Section`: Which section of the source doc (§heading)
- `Confidence`: High (explicitly stated) / Medium (implied) / Low (inferred by analyst)
- `If Wrong...`: What consequence follows if this assumption is invalid

## Section 3: Reasoning Chain

**Core question**: How does each decision trace back to a principle or assumption?

**Extraction method**: For each major decision in the document, build a `Principle → Reasoning → Decision` triple.

```
1. Identify all decisions (technology choices, architecture patterns, scope decisions, rejected alternatives)
2. For each decision:
   a. Find the stated or implied REASON
   b. Trace that reason to a PRINCIPLE (fundamental truth) or ASSUMPTION (from register)
   c. Record: Principle/Assumption → "because P, given C, therefore D" → Decision
   d. Cite the source section
```

**Decision identification signals**: "We chose...", "The solution is...", "This approach...", "Standalone vs...", comparison tables, architecture diagrams.

## Section 4: Alternative Rejection Log

**Core question**: Why do other approaches violate our principles?

**Extraction sources**:

| Source | Example |
|--------|---------|
| Explicit comparison table | "Option A vs Option B" → extract rejected options |
| Debate record / appendix | "Rejected proposals" section |
| Implicit rejections | "This is NOT the same as X" → X was considered and rejected |
| Scope decisions | "Non-goals: X" → X was an alternative approach |

**For each rejection**: Link to a specific assumption (A<N>) or principle that the alternative violates.

## Section 5: Decision Sensitivity

**Core question**: If assumption X breaks, which decisions collapse?

**Extraction method**:

```
1. For each assumption in the Assumptions Register:
   a. Scan the Reasoning Chain for decisions that depend on this assumption
   b. If the assumption were false, would the decision still hold?
   c. Rate impact: High (core architecture changes), Medium (significant rework), Low (minor adjustment)
2. Produce assumption → affected decisions mapping
```

**High-sensitivity indicators**: An assumption that affects 3+ decisions, or affects the Root Problem framing.

## Section 6: Open Unknowns

**Core question**: What don't we know, and what should we find out?

**Two categories**:

| Category | Source | Example |
|----------|--------|---------|
| Known unknowns | Document's "Open Questions", "Risks", "TBD" | "Q1: Should we support batch mode?" |
| Inferred unknowns | Gaps discovered during extraction | "No performance data cited for the chosen approach" |

**For each unknown**: Assess risk level and suggest resolution path.

## Long Document Strategy (>500 lines)

```
1. Split document by top-level headings (## sections)
2. Process each section independently:
   - Extract assumptions, decisions, alternatives per section
3. Merge phase:
   - Deduplicate assumptions by content similarity
   - Build cross-section reasoning chains (decision in §3 depends on assumption in §2)
   - Merge alternative rejection logs
4. Sensitivity analysis runs on the merged register
```

This prevents token truncation in deep mode and ensures complete coverage.
