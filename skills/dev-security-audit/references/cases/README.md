# Supply Chain Incident Case Library

Case files contain IoCs, detection commands, cleanup procedures, and attack chain analysis for specific supply chain incidents. SKILL.md Phase 0 loads matching cases on demand based on platform and product presence.

## Active Cases

| case_id | Product | Status | Platforms | Attack Window | Confidence | File |
|---------|---------|--------|-----------|---------------|------------|------|
| APIFOX-2026-03 | Apifox | active | macOS, Windows, Linux | 2026-03-04 to 2026-03-22 | high | [apifox-2026-03.md](./apifox-2026-03.md) |
| AXIOS-2026-03 | axios (npm) | active | macOS, Windows, Linux | 2026-03-31 00:21 to 03:15 UTC | high | [axios-2026-03.md](./axios-2026-03.md) |

## Case File Template

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `case_id` | string | yes | `PRODUCT-YYYY-MM` format |
| `status` | enum | yes | `active` / `monitoring` / `archived` |
| `last_updated` | date | yes | ISO 8601 |
| `review_by` | date | yes | Soft expiry — after this date, mark findings as `stale intel / confidence reduced` |
| `platforms` | list | yes | Affected OS platforms |
| `attack_window` | object | yes | `start` and `end` dates |
| `confidence` | enum | yes | `high` / `medium` / `low` |
| `product_type` | enum | no | `app` (default) / `npm-library`. Library cases use lockfile scan for presence check instead of app directory check |

### Required Section Order

1. Summary
2. Attack Window & Timeline
3. IoCs — Network Indicators
4. IoCs — Host Indicators
5. IoCs — Cryptographic Indicators
6. Detection Commands
7. Interpretation Guide
8. Evidence Preservation
9. Cleanup
10. Appendix: Attack Chain Summary (optional read)
11. Source Attribution

### Authoring Rules

| Rule | Description |
|------|-------------|
| Line budget | Target under 500 lines. If appendix pushes past 500, split to `<case_id>-analysis.md` |
| IoC format | Use markdown tables with columns: Type, Indicator, Notes |
| Detection commands | Include per-platform bash/cmd blocks |
| Redaction | Partially redact secrets in examples (show first 8 + last 4 chars) |
| Sources | Every factual claim must cite a source in Source Attribution |

## Adding a New Case

1. Create `<case_id>.md` following the template above
2. Add a row to the Active Cases table in this README
3. No changes to SKILL.md needed — Phase 0 dispatcher auto-discovers cases from this catalog
