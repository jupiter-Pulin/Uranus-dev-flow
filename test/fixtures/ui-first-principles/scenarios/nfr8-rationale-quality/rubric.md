# NFR-8 Rationale Quality Rubric

> **Goal**: ≥ 90% of decision rows produced by `/ui-first-principles` score ≥ 2 on the 3-point rubric (per tech-spec §6 Integration Tests).

## Scoring (per decision row)

| Score | Criterion |
|-------|-----------|
| **2** | Rationale traces back to a Phase 3 job (functional / emotional / social) **or** a quantitative threshold (e.g., "exceeds Miller", "Hick decision time") **and** explains the priority choice in 1–2 sentences. |
| **1** | Rationale names a relevant principle but does not link to a specific Phase 3 job, **or** the priority choice is asserted without justification. |
| **0** | Rationale is missing, repeats the field name, leaks raw values, or invokes an aesthetic / vibe argument. |

## Pass Rule

- **Global threshold (tech-spec §6 mandate)**: ≥ 45 / 50 rows score ≥ 2 (90% across 5 scenarios × 10 rows).
- **Per-scenario floor (advisory check, this rubric only)**: ≥ 8 / 10 rows score ≥ 2 (80%). Not part of the tech-spec mandate. Use it to spot a weak scenario the global average could mask — failing the floor while the global threshold passes is a signal to iterate the failing scenario's prompt, not a blocker.

## Procedure

Each fixture below is a wrapper of shape `{ scenario, fieldCount, input }`. The skill's `--api` flag expects the *bare* JSON sample — just the wrapper's `.input` object — so unwrap before invoking:

```bash
FIXTURE=test/fixtures/ui-first-principles/scenarios/nfr8-rationale-quality/wallet-balance.json
SLUG=$(basename "$FIXTURE" .json)
SCENARIO=$(jq -r .scenario "$FIXTURE")
jq .input "$FIXTURE" > "/tmp/nfr8-${SLUG}-input.json"
/ui-first-principles "$SCENARIO" \
  --api "/tmp/nfr8-${SLUG}-input.json" \
  --output "/tmp/nfr8-${SLUG}-handoff.md"
```

The `--output` override is required: without it the skill writes the default `handoff-ui-first-principles.md` and each subsequent run silently overwrites the previous report.

Then:

1. Repeat the unwrap-and-invoke step for all 5 fixtures (each produces its own `nfr8-<slug>-handoff.md`).
2. Open each produced `nfr8-<slug>-handoff.md`.
3. Score each row in §2 Field Decision Table using the rubric above.
4. Record results in `results.csv` (one row per decision; columns: scenario, field, score, comment).
5. Compute pass / fail per the rule (global threshold is mandatory; per-scenario floor is advisory).

## Fixtures (5 scenarios × 10 fields = 50 decisions)

| Scenario | Input file | Field count |
|----------|-----------|-------------|
| Wallet balance dashboard | `wallet-balance.json` | 10 |
| DEX swap quote | `dex-swap-quote.json` | 10 |
| NFT collection listing | `nft-collection.json` | 10 |
| KYC application status | `kyc-status.json` | 10 |
| Token transfer confirmation | `token-transfer.json` | 10 |

## Common pitfalls (auto-zero score)

| Pattern | Why it scores 0 |
|---------|-----------------|
| `"Required field"` | No JTBD trace |
| `"Must be primary"` | Tautological — no rationale |
| Echoes the raw value (e.g., `"alice@example.com"` instead of `"the user's email"`) | Phase 7 will catch as PII leak; auto-fail |
| Uses placeholder syntax (`<redacted:email>`) instead of class semantic | Implementation detail leak — see output-template.md § Section 2 Rationale rules |
| Cites principle ID with no decision link (e.g., `"CognitiveLoadTheory"` alone) | Principle named, not applied |

## Reporting Template

```markdown
## NFR-8 Rubric Run — <ISO-8601 date>

| Scenario | Total rows | Rows ≥ 2 | % | Floor (≥ 80%)? |
|----------|------------|----------|---|-----------------|
| wallet-balance | 10 | 9 | 90% | ✅ |
| dex-swap-quote | 10 | 8 | 80% | ✅ |
| nft-collection | 10 | 10 | 100% | ✅ |
| kyc-status | 10 | 7 | 70% | ❌ |
| token-transfer | 10 | 9 | 90% | ✅ |
| **Total** | **50** | **43** | **86%** (global, threshold 90%) | **❌** |

Verdict: global threshold (90%) missed; kyc-status also tripped the per-scenario advisory floor — prompt iteration needed.
```
