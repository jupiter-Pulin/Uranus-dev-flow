# Check Mode Output Template

## Report Format

```markdown
## Runbook Health Check: {feature}

| Section | Status | Sources | Stale Source(s) |
|---------|--------|---------|-----------------|
| 1. Release Summary | {status} | {source files} | {stale details or —} |
| 2. SRE Quick Reference | {status} | {source files} | {stale details or —} |
| 3. Scope / Blast Radius | {status} | {source files} | {stale details or —} |
| 4. Preconditions Checklist | {status} | {source files} | {stale details or —} |
| 5. Deployment Procedure | {status} | {source files} | {stale details or —} |
| 6. Verification / Smoke Tests | {status} | {source files} | {stale details or —} |
| 7. Monitoring Signals | {status} | {source files} | {stale details or —} |
| 8. Rollback Plan | {status} | {source files} | {stale details or —} |
| 9. Open Risks / Human Checks | {status} | {source files} | {stale details or —} |

### Stale Sections
- {§N section}: `{file}` SHA changed {old} → {new} ({other sources unchanged})

### Missing Evidence
- {§N section}: "{fallback text}" — {guidance}

### Verdict: {Ready / Stale / Incomplete}
```

## Status Definitions

| Status | Condition | Detail |
|--------|-----------|--------|
| **Fresh** | All `sources[].sha` match current `git hash-object` | All sources unchanged |
| **Stale** | Any `sources[].sha` mismatches current hash | At least one source changed |
| **Missing** | `sources` is empty array | No data available at generation time |
| **Unknown** | Any `sources[].file` no longer exists on disk | Source file deleted, needs human review |

> Section status = worst of all its sources. Priority: Fresh > Stale > Unknown > Missing.

## Staleness Check Algorithm

```
For each section in provenance manifest:
  1. If sources is empty → Missing
  2. For each source in sources:
     a. Check file exists → if not, mark Unknown
     b. Run: git hash-object <file>
     c. Compare with recorded sha
     d. If mismatch → Stale (record old → new SHA)
  3. Section status = worst status across all sources
```

## Verdict Logic

| Condition | Verdict |
|-----------|---------|
| All sections Fresh | **Ready** — runbook is up to date |
| Any section Stale or Unknown | **Stale** — run `/runbook --update` to refresh |
| Any section Missing + no source improvement possible | **Incomplete** — missing monitoring/observability, needs human action |

## No Provenance Fallback

If the runbook file exists but has no `<!-- runbook-provenance -->` block:

```
⚠️ Runbook exists but has no provenance manifest.
Cannot determine staleness. Run `/runbook --update` to regenerate with provenance tracking.
Verdict: Unknown
```
