# UI Anti-Patterns Catalogue (v1)

Authoritative whitelist of 5 anti-pattern IDs detected in `/ui-first-principles` Phase 5b.

> **Tech spec**: docs/features/ui-first-principles/2-tech-spec.md §3.4 Phase 5b
> **Phase 7 enforcement**: any ID not in this whitelist triggers `invalid_anti_pattern_id` (soft).

## Whitelist (v1)

| ID | One-line summary |
|----|------------------|
| `too_many_primary` | Primary zone exceeds Miller 7 ± 2 |
| `scenario_field_mismatch` | Field is irrelevant to the scenario's stated jobs |
| `pure_aesthetic_over_utility` | Field exists only for visual completeness |
| `hidden_critical_info` | Critical decision input is in `on_demand` or `hidden` zone |
| `redundant_fields` | Multiple fields carry the same semantic information |

## Detection Discipline

Phase 5b should report each anti-pattern at most once per scenario, citing the **specific fields** that triggered it. If no anti-patterns apply, emit a single-row table with `(none detected) | — | info | All fields pass anti-pattern checks.` to satisfy Phase 7 structure requirement. The literal `(none detected)` (with parentheses and space) is intentional — it does not match the snake_case ID regex, so the validator skips it without emitting `invalid_anti_pattern_id`.

## Severity Decision Rubric

Every reported anti-pattern row must declare `warning` or `info`. Pick by stepping through the table top-to-bottom; first matching row wins:

| # | Condition | Severity |
|---|-----------|----------|
| 1 | Anti-pattern affects an irreversible action or a security/trust-critical decision | `warning` |
| 2 | Anti-pattern defeats a Phase 3 emotional or functional job (user cannot complete the job, or completes it wrongly) | `warning` |
| 3 | Anti-pattern violates a quantitative threshold (e.g., Miller > 7, > 10 primary actions for time-pressured scenario) | `warning` |
| 4 | Anti-pattern adds avoidable cognitive load but does not block the job (e.g., redundant derived field) | `info` |
| 5 | Anti-pattern is purely stylistic / layout-balancing concern with no JTBD impact | `info` |

> **Tie-breaker scope**: when a per-anti-pattern trigger table (below) names a matching trigger row, that row's severity wins — including over rows 1–5 of this rubric. The rubric applies only when no per-pattern row matches. **Catch-all**: if neither the per-pattern table nor rubric rows 1–5 fit the situation, default to `warning` for any anti-pattern that touches task correctness, security, or trust; otherwise default to `info`.

---

## 1. `too_many_primary`

**Definition**: The `primary` zone contains more fields than Miller's Law allows (typically > 7 unchunked items).

| Trigger | Severity | Reason |
|---------|----------|--------|
| Primary count = 8–9 with no chunking | `warning` | Crosses the 7 ± 2 threshold; users start losing items |
| Primary count ≥ 10 | `warning` | Severe working-memory overload regardless of chunking |
| Primary count = 8–9 chunked into 2 named groups | `info` | Borderline; chunking partially mitigates |

**Improvement direction**:
1. Demote weakest primaries to `secondary` based on JTBD criticality
2. Chunk by semantic group (Identity / Status / Activity)
3. If forced > 7, the screen probably bundles two scenarios — split

**Affected fields cell example**: `txHash, from, to, amount, gasUsed, gasPrice, nonce, blockNumber, confirmations, status`

---

## 2. `scenario_field_mismatch`

**Definition**: Field is exposed but does not serve any of the scenario's identified functional, emotional, or social jobs.

| Trigger | Severity | Reason |
|---------|----------|--------|
| Field has no JTBD anchor in Phase 3 analysis but is `primary` or `secondary` | `warning` | Wastes user attention on irrelevant data |
| Field has weak / theoretical JTBD link only | `info` | May still warrant `on_demand` placement |

**Examples**:
- `gasUsed` shown primary on a "transaction confirmation" screen aimed at non-developer users — they don't tune gas
- `blockNumber` on an NFT detail page — irrelevant to collectors' jobs
- `txHash` on a balance summary — only relevant during audit (move to `on_demand`)

**Improvement direction**:
1. Re-check Phase 3 JTBD analysis — did the functional/emotional/social jobs actually demand this field?
2. If field has audit value but no current-job value, demote to `on_demand`
3. If field has zero job value, mark `hidden`

---

## 3. `pure_aesthetic_over_utility`

**Definition**: Field is present **only** for visual completeness or symmetry, with no decision-making value.

| Trigger | Severity | Reason |
|---------|----------|--------|
| Rationale boils down to "looks better with it shown" or "fills the column" | `warning` | Zero JTBD anchor + zero CLT justification |
| Field exists to balance a layout grid only | `info` | Layout concern, not information concern |

**Examples**:
- A truncated wallet address shown next to a friendly alias because "the page felt empty without it"
- Decorative status emoji that duplicates a text status label
- Numeric ID badges in a list where rows are already uniquely identified

**Improvement direction**:
1. Remove the field; layout balance is `frontend-design`'s job, not information architecture
2. If genuinely needed, demote to `on_demand` and document that the trade is layout-only
3. Combine with related field if it was present for "context" only

---

## 4. `hidden_critical_info`

**Definition**: A field that the user **must** see to make a correct decision is in `on_demand` (or `hidden`) zone.

| Trigger | Severity | Reason |
|---------|----------|--------|
| Field directly affects irreversible action (destination, signed amount) but is collapsed | `warning` | Users may proceed without verifying |
| Field is required by emotional job (trust, certainty) but hidden | `warning` | Defeats the emotional-job intervention |
| Field is critical for advanced users only (debug context) | `info` | `on_demand` may be acceptable |

**Examples**:
- "Send" confirmation page with destination address inside an "Advanced details" expand
- Phishing-warning banner conditional on hover
- Real settlement amount (after fees) hidden behind "see breakdown"

**Improvement direction**:
1. Promote to `primary` — users cannot defer reading what they cannot un-do after acting
2. If the screen has too many primaries (`too_many_primary` co-trigger), remove a less-critical primary instead of hiding the critical one
3. Consider redesign — sometimes the screen does too much

---

## 5. `redundant_fields`

**Definition**: Two or more fields carry the **same semantic information** without distinct decision value.

| Trigger | Severity | Reason |
|---------|----------|--------|
| Same value in two forms with no derivation rationale | `warning` | Doubles cognitive cost without doubling information |
| Derived field shown alongside raw with no need for raw in this scenario | `info` | Raw should be `on_demand` only |
| Same datum surfaced under two names (synonym fields) | `warning` | Implies API design issue worth flagging in Gap report |

**Examples**:
- Both `from` (raw address) and `fromAlias` (ENS / saved-name) shown as primary; raw should be `on_demand`
- `amount` (in wei) and `amountFormatted` (in ETH) both primary
- `created_at` and `createdAtRelative` ("3 days ago") both at the same level
- API returns both `recipient` and `to` carrying identical data

**Improvement direction**:
1. Choose the form that best serves the scenario's JTBD; demote the other to `on_demand` (typically the raw form)
2. If the API truly returns synonyms, surface as Gap report `api_provides_but_ui_ignores` candidate for cleanup
3. Use a tooltip or expand on the chosen form to reveal the alternative on demand

---

## What v1 Does NOT Catch

By design, v1 omits these (candidates for v2):
- `premature_error_state` — error UI shown before user has actually erred
- `missing_empty_state` — no design for "no data yet" condition
- `inconsistent_terminology` — same concept named differently across fields
- `density_overload` — fields too tightly packed (visual layout, not IA)

If your analysis would benefit from a v2 ID, **note it in your report's prose section** but do not invent the ID — Phase 7 enforces the v1 whitelist and would soft-block.

---

## Cross-References

- Phase 5b detection guidance: `references/output-template.md` § Anti-Pattern Findings
- Phase 7 validation: `scripts/skills/ui-first-principles/validate-report.js` Rule 5
- JTBD anchors driving anti-pattern detection: `references/jtbd-framework.md`
