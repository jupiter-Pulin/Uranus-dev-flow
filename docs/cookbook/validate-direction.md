# Validate a Feature Direction Before Building

## Use this when

You have a feature idea but aren't sure if the approach is sound. You want industry best practices and deep research to sharpen the direction before writing any code.

## Core skills

| Skill | Role |
|-------|------|
| `/best-practices` | Audit against industry standards and patterns |
| `/deep-research` | Multi-source research (web + codebase + docs) |
| `/feasibility-study` | Quantitative comparison of approaches |
| `/codex-brainstorm` | Adversarial debate to stress-test the plan |

## Command flow

1. `/deep-research <topic>` — gather state-of-the-art approaches, prior art, and ecosystem conventions
2. `/best-practices` — audit the proposed approach against industry patterns; identifies gaps and anti-patterns
3. Synthesize: combine research findings with best-practice gaps into 2-3 candidate approaches
4. `/feasibility-study` — quantitative trade-off analysis across candidates
5. `/codex-brainstorm` — adversarial debate on the top candidate; finds blind spots
6. Decision: proceed with refined approach, or pivot based on findings

## Why this combo works

| Solo skill | Limitation | Combined effect |
|-----------|-----------|----------------|
| `/deep-research` alone | Broad information, no opinionated filter | `/best-practices` filters research through proven patterns |
| `/best-practices` alone | Checks against standards but doesn't explore alternatives | `/deep-research` provides the landscape of alternatives |
| `/feasibility-study` alone | Compares options but may miss industry context | Research + practices provide well-informed candidates |

## Decision points

| Situation | Choice |
|-----------|--------|
| Research reveals the idea already exists? | Evaluate existing solutions; adapt rather than reinvent |
| Best practices audit finds anti-patterns? | Redesign before investing in feasibility study |
| Brainstorm debate reaches no consensus? | Prototype both approaches; use evidence to decide |
| Direction is validated? | Proceed to `/tech-spec` → `/feature-dev` |

## Gates

No enforced gates — this is an exploration workflow. The output is a validated direction with supporting evidence.

## Expected outcome

- Clear understanding of the problem landscape (research)
- Approach validated against industry best practices
- Quantitative comparison of alternatives
- Blind spots identified via adversarial debate
- Confident direction ready for `/tech-spec`

## Related scenarios

- [Rough request to tech spec](request-to-spec.md) — the next step after direction is validated
- [Implement a new feature](new-feature.md) — building after spec is complete
