# Over-Designed Sample — Necessity Audit Fixture

> **Purpose**: Deterministic input for `integration.test.js`. Contains FR/NFR
> rows hand-crafted so `extractRequirements` + `classifyAll` yield predictable
> Keep / Review / Cut verdicts across dims 1 / 3 / 5.
>
> Tests assert on element counts, IDs, and classification verdicts — not on
> exact `source_line` numbers — so minor text edits above the table rows are
> safe. Adding/removing FR/NFR rows will break `integration.test.js`.

## Requirements

| ID | Description | Priority |
|----|-------------|----------|
| FR-1 | User login via OAuth with session cookie issuance | Must |
| FR-2 | Abstract interface with zero consumers for future growth | Should |
| FR-3 | Cache layer added without any performance data for throughput | Should |
| FR-4 | Optional plugin interface might want to extend later for flexibility | Could |
| FR-5 | Audit log write on failed authentication attempts | Must |

## Non-Functional Requirements

| ID | Description | Priority |
|----|-------------|----------|
| NFR-1 | Response time under 200ms at p95 for read endpoints | Must |
| NFR-2 | All secrets redacted from logs per security policy | Must |

## Technical Notes

Real requirements live in a proper lifecycle doc; this fixture intentionally
mixes cleanly-necessary items (FR-1 / NFR-2 / FR-5) with textbook over-
engineering signals (FR-2 abstraction with zero consumers, FR-3 premature
optimization without evidence, FR-4 speculative extensibility). Dimension
keyword detection assigns primary dimensions per heuristics in
`scripts/skills/necessity-audit/elements.js`.

### Expected classification (plain text — no table rows to avoid re-extraction)

- Row 1 is expected to classify as Keep (no over-design signals on the rationale line).
- Row 2 is expected to classify as Cut via dimension 2 (High: "zero consumers").
- Row 3 is expected to classify as Cut via dimension 5 (High: "without any performance data").
- Row 4 is expected to yield Review via two Med signals across dims 3 and 4 ("might want to extend", "for flexibility").
- Row 5 is expected to classify as Keep (security / compliance framing).
- Non-functional row 1 is expected to classify as Keep (measurement given, no over-design signal).
- Non-functional row 2 is expected to classify as Keep (no signals).

The integration test asserts on counts and specific IDs; minor regex tweaks
should not break it so long as the High/Med/Low patterns for dims 2 and 5
remain intact.
