# Output Template — Pre-PR Audit

## Markdown Report

```markdown
## Pre-PR Audit Report

| Field | Value |
|-------|-------|
| Branch | `<branch>` |
| HEAD | `<sha>` |
| Mode | fast / deep |
| Timestamp | <ISO 8601> |

### Confidence Index: <N>/100 <sentinel>

| Dimension | Score | Confidence | Status |
|-----------|-------|------------|--------|
| Execution Integrity | <N> | <N>% | ✅/⚠️/⛔ |
| Coverage Adequacy | <N> | <N>% | ✅/⚠️/⛔ |
| Test Quality | <N> | <N>% | ✅/⚠️/⛔ |
| Risk-to-Test Alignment | <N> | <N>% | ✅/⚠️/⛔ |
| Evidence Governance | <N> | <N>% | ✅/⚠️/⛔ |

### Hard-Fail Checks

- [x] Precommit passed (HEAD match)
- [x] No policy breaches
- [x] Evidence fresh
- [x] No critical untested files

### Findings

- [P1] <file:line> <description> → <recommendation>
- [P2] <description>

### Next Actions

1. <prioritized action>
2. <action>

### Gate: <sentinel>
```

## Sentinel Strings

| Gate | Sentinel | Exit Code (strict) |
|------|----------|--------------------|
| ✅ Ready | `✅ PR-Ready` | 0 |
| ⚠️ Needs attention | `⚠️ PR-Caution` | 0 |
| ⛔ Not ready | `⛔ PR-Blocked` | 1 |
| Hard-fail | `⛔ PR-Blocked (hard-fail)` | 2 |

## JSON Schema (`--json`)

```json
{
  "version": 1,
  "branch": "<string>",
  "head": "<sha>",
  "mode": "fast|deep",
  "timestamp": "<ISO 8601>",
  "confidence_index": 82,
  "gate": "PR-Ready|PR-Caution|PR-Blocked",
  "evidence_cap": 0.9,
  "dimensions": [
    {
      "name": "Execution Integrity",
      "weight": 25,
      "score": 95,
      "confidence": 100,
      "status": "pass",
      "checks": [
        { "name": "precommit_passed", "value": 1.0, "detail": "HEAD match" },
        { "name": "tests_pass", "value": 1.0, "detail": "162/162" },
        { "name": "lint_clean", "value": 1.0, "detail": "0 errors" },
        { "name": "flaky_indicator", "value": "N/A", "detail": "no signal" }
      ]
    }
  ],
  "hard_fails": [
    { "name": "precommit_stale", "triggered": false },
    { "name": "policy_breach", "triggered": false },
    { "name": "evidence_stale", "triggered": false },
    { "name": "critical_untested", "triggered": false }
  ],
  "findings": [
    { "severity": "P1", "file": "src/auth.ts", "line": 42, "description": "...", "recommendation": "..." }
  ],
  "next_actions": ["..."]
}
```
