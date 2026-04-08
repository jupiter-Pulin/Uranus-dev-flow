# Stress-Test a Design Decision with Adversarial Debate

## Use this when

You face a design decision with strong trade-offs (performance vs. simplicity, consistency vs. availability, etc.) and want to pressure-test your choice before committing.

## Core skills

| Skill | Role |
|-------|------|
| `/codex-brainstorm` | Multi-round adversarial debate with Nash equilibrium |
| `/codex-architect` | Architecture advice grounded in the codebase |
| `/deep-research` | Research prior art and industry patterns |
| `/feasibility-study` | Quantitative evaluation of alternatives |

## Command flow

1. Frame the decision: define the trade-off axes (e.g., "monolith vs. microservice for auth")
2. `/deep-research <topic>` — gather how others solved similar problems
3. `/codex-brainstorm <decision>` — adversarial debate: pro vs. con perspectives argue until reaching Nash equilibrium (neither side can improve without the other changing)
4. Review equilibrium output: the converged recommendation with acknowledged trade-offs
5. If architecture is involved: `/codex-architect` — validate against the existing codebase
6. `/feasibility-study` — if multiple viable approaches survived the debate, quantify them

## How adversarial debate works

```
Round 1: Advocate A argues for Option X
         Advocate B argues for Option Y
Round 2: Each responds to the other's strongest points
         ...
Round N: Nash equilibrium — converged recommendation
         with clear trade-off acknowledgment
```

The debate isn't about "winning" — it's about finding blind spots that a single perspective would miss.

## Decision points

| Situation | Choice |
|-----------|--------|
| Debate reaches clear consensus? | Adopt the recommendation; proceed to spec |
| Debate reveals a third option? | Add it to the debate; run another round |
| Equilibrium favors current approach? | Confidence boost — proceed with documented rationale |
| No equilibrium after multiple rounds? | Both options viable; pick by constraint priority |
| Need codebase-specific validation? | `/codex-architect` to check feasibility in existing code |

## Gates

No enforced gates — this is a decision-making workflow. Output is a documented decision with trade-off rationale.

## Expected outcome

- Design decision pressure-tested from multiple angles
- Blind spots surfaced and addressed
- Trade-offs explicitly documented (not hidden)
- Clear rationale for the chosen approach
- Ready to proceed to `/tech-spec` or implementation

## Related scenarios

- [Validate a feature direction](validate-direction.md) — broader direction validation before a specific design decision
- [Rough request to tech spec](request-to-spec.md) — turning the validated decision into a spec
