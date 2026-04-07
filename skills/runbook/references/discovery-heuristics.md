# Content Discovery Heuristics

## Scoped Discovery Cascade

Search from narrow to wide. Each level adds a confidence penalty.

| Priority | Scope | Confidence | When to use |
|----------|-------|------------|-------------|
| 1 | Request `Related Files` paths | High | Always first |
| 2 | Canonical docs (tech-spec, architecture) | High | Feature resolver provides |
| 3 | Feature-local paths (`docs/features/{feature}/`) | Medium | Canonical insufficient |
| 4 | Repo-wide grep | Low | **Last resort only** |

> Repo-wide results must be tagged `(low confidence — repo-wide search)`.

## Per-Section Discovery Map

| Section | P1: Related Files | P2: Canonical Docs | P3: Feature-local | P4: Repo-wide | Fallback |
|---------|------------------|-------------------|-------------------|---------------|----------|
| 1. Release Summary | — | tech-spec §1 (Requirement Summary) | — | — | "TBD — no tech-spec found" |
| 2. SRE Quick Ref | Grep in Related Files: `alert\|threshold\|metric\|rollback\|abort` | architecture §6 (Deployment & Config) | — | — | "Not defined in repo" |
| 3. Scope / Blast Radius | Request scope table | architecture §4 (Integration Points) | — | — | Architecture §2 (Component Responsibilities) |
| 4. Preconditions | Request ACs + quality-gate status | — | — | — | Standard checklist only |
| 5. Deployment Procedure | — | — | `.github/workflows/*.yml` | — | Standard skill sequence |
| 6. Verification | — | tech-spec §6 (Testing Strategy) | — | — | "TBD — no test strategy found" |
| 7. Monitoring | Grep in Related Files: `metrics\|prometheus\|grafana\|datadog\|log\.\(info\|warn\)\|feature.flag\|LaunchDarkly` | architecture §6 | Feature-local `*.config.*` | Grep in related dirs only | "Not defined in repo — add monitoring before release" |
| 8. Rollback | — | architecture AD-N decisions | — | — | "TBD — rollback strategy not documented" |
| 9. Open Risks | Unresolved request items (unchecked AC) | tech-spec §7 (Open Questions) | — | — | "No open risks identified" |

## Security — Redaction Rules

When extracting content from configs, workflows, or logs into the runbook:

| Prohibited Content | Replacement |
|-------------------|-------------|
| API keys, tokens, secrets | `${ENV_VAR_NAME}` placeholder |
| Webhook URLs with credentials | `<webhook-url>` symbolic reference |
| Internal-only endpoints (IP:port) | `<internal-endpoint>` placeholder |
| Database connection strings | `${DATABASE_URL}` placeholder |
| Private registry URLs | `<registry-url>` placeholder |

> Consistent with `rules/security.md`: Never log private keys, passwords, tokens.

## Discovery Execution Pattern

```
For each template section:
  1. Check P1 scope (Related Files) — if found, use with High confidence
  2. Check P2 scope (Canonical Docs) — if found, use with High confidence
  3. Check P3 scope (Feature-local) — if found, use with Medium confidence
  4. Check P4 scope (Repo-wide) — if found, tag as Low confidence
  5. If nothing found → use fallback text from table above
  6. Apply redaction rules to all extracted content
  7. Record source file + SHA in provenance manifest
```
