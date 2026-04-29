# Handoff Output Template — `handoff-ui-first-principles.md`

Authoritative markdown schema for the report Phase 6 produces and Phase 7 validates.

> **Tech spec**: docs/features/ui-first-principles/2-tech-spec.md §3.4 Phases 5–7
> **Validation**: structural rules enforced by `scripts/skills/ui-first-principles/validate-report.js`

## Schema (Required Sections)

Sections are listed in **required output order**. Section headings (`##` level) and table headers must match exactly so the validator can locate them.

```markdown
# UI First-Principles Analysis: <scenario>

> Scenario: <scenario>
> Domain: <crypto | none>
> Generated: <ISO-8601 timestamp>
> Input format: <json_sample | manual_list>

## 1. JTBD Analysis

### Functional Job
<one or two sentences using action verbs>

### Emotional Job
<one or two sentences naming feelings + their friction source — or `"none in this scenario"`>

### Social Job
<one or two sentences — or `"none in this scenario"`>

## 2. Field Decision Table

| Field | Priority | Principle Anchor | Rationale |
|-------|----------|------------------|-----------|
| <fieldName> | primary \| secondary \| on_demand \| hidden | JTBD \| CognitiveLoadTheory \| HicksLaw \| MillersLaw \| ProgressiveDisclosure | <1–2 sentence rationale tracing back to a job from §1> |

## 3. Anti-Pattern Findings

| Pattern | Affected Fields | Severity | Rationale |
|---------|-----------------|----------|-----------|
| `<anti_pattern_id>` | `<field1>`, `<field2>` | warning \| info | <why this constitutes the pattern + improvement direction> |

## 4. Gap Report

**UI needs but API missing**: <field1, field2 — or `none`>

**API provides but UI ignores**: <field3, field4 — or `none`>

## 5. Information Hierarchy

### Primary Zone
- <field>: <one-line job justification>

### Secondary Zone
- <field>: <one-line>

### On-Demand Zone
- <field>: <one-line — what triggers reveal>

### Hidden (not surfaced)
- <field>: <one-line — why omitted from UI>
```

> All four §2 priorities map to a zone. **Hidden** lists fields the UI deliberately drops; if no field is `hidden`, write a single dash item (`- (none)`).

---

## Field-by-Field Rules

### Section 1: JTBD Analysis (required)

- All three subsections (Functional / Emotional / Social) must be present.
- Empty dimensions must say `"none in this scenario"` explicitly — do not omit the heading.
- See `references/jtbd-framework.md` for elicitation guidance.

### Section 2: Field Decision Table (required, validated)

**Validator (Rule 2 `missing_decision`)**: every field name listed in the input `ScenarioBundle.fields` must appear in the `Field` column.

**Field column conventions**:
- Use the **exact** field name from the input. Backticks are allowed (`` `txHash` ``); the validator strips them. Do not rename, rewrap, or pluralise.
- Leading underscores (`_id`, `__typename`) are preserved — do not strip.

**Priority column** — closed enum:

| Value | When |
|-------|------|
| `primary` | User must see this to complete the job; central to the screen |
| `secondary` | Useful at a glance after primaries; supports the job |
| `on_demand` | Useful but deferrable; collapsed by default |
| `hidden` | Irrelevant in this scenario; do not surface |

**Principle Anchor column** — closed enum (Phase 7 Rule 3 `invalid_anchor`):

| Value | Use when |
|-------|----------|
| `JTBD` | Decision is driven by a functional / emotional / social job |
| `CognitiveLoadTheory` | Decision is driven by intrinsic vs extraneous load |
| `HicksLaw` | Decision is driven by decision-time / option-count |
| `MillersLaw` | Decision is driven by working-memory capacity |
| `ProgressiveDisclosure` | Decision is driven by deferability |

Multiple principles in the rationale prose are fine; the column itself **must hold one ID**. Empty cell → soft `invalid_anchor` violation.

**Rationale column**:
- 1–2 sentences. Trace back to a specific job from §1 or to a quantitative threshold (e.g., "exceeds Miller").
- Must NOT contain raw values from the input (Phase 7 Rules 1 / 1b will detect).
- Refer to redacted fields by **class semantic** (`"email used for login notifications"`), not by the placeholder syntax.

### Section 3: Anti-Pattern Findings (required, validated)

**Validator (Rule 5 `anti_pattern_missing`)**: section heading must exist.

**Validator (Rule 5 `anti_pattern_unstructured`)**: section must contain a **table** or a **list**. Pure prose is rejected — IDs cannot be reliably extracted.

**Validator (Rule 5 `invalid_anti_pattern_id`)**: every value in the `Pattern` column must be one of the 5 IDs in `references/anti-patterns.md`.

**No anti-patterns detected** — required structure even when clean:

```markdown
| Pattern | Affected Fields | Severity | Rationale |
|---------|-----------------|----------|-----------|
| (none detected) | — | info | All fields pass anti-pattern checks. |
```

> The `(none detected)` literal is treated as a non-matching ID and skipped by the whitelist check — it satisfies the structure requirement without polluting whitelist enforcement.

### Section 4: Gap Report (required, validated)

**Validator (Rule 4 `gap_direction_missing`)**: BOTH directions must be explicitly present, even when the value is `none`. Either bold-prose form or backticked snake_case key form is accepted:

```markdown
**UI needs but API missing**: counterparty_alias, derived_amount

**API provides but UI ignores**: rawSignature, internalSequenceNumber
```

or

```markdown
`ui_needs_but_api_missing: ["counterparty_alias"]`
`api_provides_but_ui_ignores: ["rawSignature"]`
```

When a direction has no items, write `none` explicitly: `**UI needs but API missing**: none`.

### Section 5: Information Hierarchy (required for downstream `frontend-design`)

Group fields by zone (mirrors §2 Priority column). Each entry one line. The `on_demand` zone may include the **disclosure trigger** (e.g., "expand 'Advanced details'", "tooltip on hover").

This section enables `frontend-design` to skip re-doing the IA analysis and jump straight to layout.

---

## Security Rules (Phase 7 Critical)

These are the hard PII boundaries enforced by `validate-report.js` Rules 1 and 1b. Violation here triggers retry-then-block, not a soft warning.

| Rule | Forbidden in report | Why |
|------|---------------------|-----|
| 1 `pii_leak_fingerprint` | Any string whose SHA-256 prefix matches a Phase 1 forbidden fingerprint | Re-exposes the original sensitive value |
| 1b `pii_leak_regex` | Plausible-looking PII (email, SSN, Taiwan ID, E.164 phone, eth-address/hash unless `domain=crypto`) | Catches LLM hallucination of "looks like" PII |

**Practical guidance**:
- Refer to `<redacted:email>` as `"the user's email"` — never invent `"alice@example.com"` as a placeholder.
- Refer to `<redacted:address>` by **role** (`"the recipient address"`), not by inventing a hex string.
- For `crypto` domain reports, real `0x...` addresses/hashes from the input are allowlisted — but DO NOT fabricate new hex strings in your prose.

---

## Worked Example (Skeleton — Filled Inline)

```markdown
# UI First-Principles Analysis: transaction confirmation

> Scenario: transaction confirmation
> Domain: crypto
> Generated: 2026-04-25T10:00:00Z
> Input format: json_sample

## 1. JTBD Analysis

### Functional Job
The user wants to verify the transaction destination and amount before approving an irreversible transfer.

### Emotional Job
The user needs to feel certain that the destination address belongs to the intended recipient — crypto transfers cannot be undone.

### Social Job
none in this scenario

## 2. Field Decision Table

| Field | Priority | Principle Anchor | Rationale |
|-------|----------|------------------|-----------|
| `to` | primary | JTBD | Core to the functional job: confirming destination of irreversible transfer. |
| `toAlias` | primary | JTBD | Reduces emotional friction; users cannot verify a 42-char hex string. |
| `amount` | primary | JTBD | Core to the functional job: confirming transferred value. |
| `confirmations` | secondary | JTBD | Reduces emotional friction (settlement anxiety) after submit. |
| `gasUsed` | on_demand | ProgressiveDisclosure | Useful for advanced users tuning fees; not part of confirmation job. |
| `nonce` | hidden | JTBD | No user-facing job; internal detail. |

## 3. Anti-Pattern Findings

| Pattern | Affected Fields | Severity | Rationale |
|---------|-----------------|----------|-----------|
| (none detected) | — | info | All fields pass anti-pattern checks. |

## 4. Gap Report

**UI needs but API missing**: contractRiskScore (would help emotional job — surface known-malicious contracts)

**API provides but UI ignores**: rawSignature, blockNumber

## 5. Information Hierarchy

### Primary Zone
- `to`: destination address — must verify before approving
- `toAlias`: friendly destination form — primary trust signal
- `amount`: value transferred — must verify before approving

### Secondary Zone
- `confirmations`: settlement progress — useful for emotional reassurance after submit

### On-Demand Zone
- `gasUsed`: expand "Fee details" — advanced users tuning gas

### Hidden (not surfaced)
- `nonce`: internal sequence detail — no user-facing job
```

This skeleton is structurally valid against all Phase 7 rules.
