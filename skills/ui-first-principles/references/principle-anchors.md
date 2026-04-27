# 5 Core UI First-Principles

Authoritative definition of the 5 principles used by `/ui-first-principles` Phase 4 evaluation.

> **Tech spec**: docs/features/ui-first-principles/2-tech-spec.md §3.4 Phases 3–6
> **Whitelist (Phase 7 enforced)**: `JTBD` | `CognitiveLoadTheory` | `HicksLaw` | `MillersLaw` | `ProgressiveDisclosure`

## Reasoning Chain Order

The 5 principles are applied in a deliberate order that mirrors the user's cognitive sequence:

```
JTBD                  → What is the user trying to accomplish?
  ↓
CognitiveLoadTheory   → How much can they process before overload?
  ↓
HicksLaw              → How fast can they decide given N options?
  ↓
MillersLaw            → How many primary items fit in working memory?
  ↓
ProgressiveDisclosure → What can be deferred until they ask?
```

> **Why this order**: every later principle assumes the earlier one's answer. You cannot rank fields by Miller's 7±2 if you have not first asked "what is the job?" (JTBD).

---

## 1. Jobs-to-be-Done (JTBD)

**Anchor ID**: `JTBD`

**Challenge question**: What **functional**, **emotional**, and **social** jobs is the user hiring this screen to do, in this scenario?

> See `references/jtbd-framework.md` for full three-dimension framework. This section summarises **how the principle drives field decisions**.

| Decision lever | Action |
|----------------|--------|
| Field directly serves the functional job | → `primary` |
| Field reduces emotional friction (anxiety, trust gap) | → `primary` (often the difference between "works" and "feels right") |
| Field signals social identity / status | → `primary` if scenario is identity-driven (NFT detail, profile); else `on_demand` |
| Field neither serves a job nor reduces friction | → `hidden` (candidate for `pure_aesthetic_over_utility` anti-pattern) |

**Typical rationale phrasing**:
- "Serves the functional job of `<verb>` by exposing `<state>`."
- "Reduces emotional friction (`<concern>`) by surfacing `<reassurance>`."

**Anti-pattern triggers**: `scenario_field_mismatch`, `pure_aesthetic_over_utility`.

---

## 2. Cognitive Load Theory (CLT)

**Anchor ID**: `CognitiveLoadTheory`

**Challenge question**: Will rendering this field add **intrinsic** (essential), **extraneous** (avoidable), or **germane** (learning-supporting) load — and is the trade worth it?

| Load type | Field disposition |
|-----------|-------------------|
| Intrinsic (cannot be reduced without losing the job) | Keep — but minimise visual noise |
| Extraneous (presentation-only, distracts from the job) | `hidden` or restructure |
| Germane (helps user build a mental model of the system) | `secondary` |

**Heuristic**: if a field requires **interpretation** (raw hex address, base-unit token amount), prefer surfacing a derived friendly form (alias, formatted decimal) and demoting the raw value to `on_demand`.

**Typical rationale phrasing**:
- "Raw `<form>` adds extraneous load; surfaced `<derived>` instead and demoted raw to on_demand."
- "Intrinsic to the job; cannot be removed without losing decision-making capacity."

**Anti-pattern triggers**: `pure_aesthetic_over_utility`, `redundant_fields`.

---

## 3. Hick's Law

**Anchor ID**: `HicksLaw`

**Challenge question**: How many **simultaneous decisions** does this layout demand, and does that latency match the scenario's urgency?

> Decision time grows logarithmically with the number of choices. A confirmation dialog with 8 buttons takes far longer than 2.

| Scenario urgency | Recommended primary-action count |
|------------------|---------------------------------|
| Critical / time-pressured (e.g., transaction confirm, error recovery) | 1–2 |
| Standard (dashboard, list view) | 3–5 |
| Exploratory (NFT collection, settings) | 5–7 (with grouping) |

**Application**: when ranking actions or filters, demote secondary CTAs to `secondary` zone or `on_demand` (overflow menu).

**Typical rationale phrasing**:
- "Critical-path scenario — limit to 1 primary action; secondary actions moved to overflow menu."
- "Decision count above Hick threshold for time-pressured tasks; demoted to on_demand."

**Anti-pattern triggers**: `too_many_primary`, `hidden_critical_info` (if over-aggressive demotion).

---

## 4. Miller's Law

**Anchor ID**: `MillersLaw`

**Challenge question**: Does the `primary` zone exceed **7 ± 2** items? If yes, can items be **chunked** into named groups?

| Primary count | Action |
|---------------|--------|
| 1–7 | OK |
| 8–9 | Chunk into 2 named groups (e.g., "Identity" / "Activity") |
| 10+ | Demote weakest items to `secondary`; hard limit 7 visible |

**Heuristic**: chunking restores capacity. Five fields under "Counterparty" + three under "Status" reads as two chunks (within Miller), not eight items.

**Typical rationale phrasing**:
- "8 primaries triggered Miller violation; chunked into Identity (3) + Activity (5)."
- "Within Miller; no chunking required."

**Anti-pattern triggers**: `too_many_primary` (direct trigger).

---

## 5. Progressive Disclosure

**Anchor ID**: `ProgressiveDisclosure`

**Challenge question**: Can this field be **deferred until the user explicitly asks** without breaking the primary job?

| Deferability test | Disposition |
|-------------------|-------------|
| User must see it to complete the job | `primary` |
| User would scan to it second (after primary) | `secondary` |
| Useful for a minority (advanced / debug / audit) | `on_demand` (collapsed by default; reveal via "More details") |
| Never useful in this scenario | `hidden` |

**Anti-rule**: progressive disclosure is **not** a license to hide critical information. If the user needs the field to make a correct decision, it cannot be `on_demand`.

**Typical rationale phrasing**:
- "Useful only for audit; deferred to on_demand expand panel."
- "Critical to decision — must be primary; cannot defer."

**Anti-pattern triggers**: `hidden_critical_info` (over-aggressive deferral), `redundant_fields` (when same info appears in primary AND on_demand).

---

## Mask Semantics (LLM Reading Contract)

When you encounter `<redacted:{type}>` placeholders in `ScenarioBundle.fields[].sampleValue`, treat them as **opaque markers** that:
- **Indicate field PII class** (`email`, `phone`, `address`, `account_id`, `national_id`, `credential`)
- **Do not** reveal the underlying value
- **Must not** be expanded into invented sample values in your rationale text (Phase 7 will fingerprint-scan and may emit `pii_leak_regex` if you fabricate plausible-looking PII)

When rationalising a redacted field, refer to its **class semantic** ("email address used for login notifications"), never to a value or pattern.

---

## How Phase 5 Cites These Principles

Each row in the **Field Decision Table** must cite **exactly one** principle anchor. Choose the principle whose challenge question most directly drove the disposition:

```
| Field | Priority | Principle Anchor | Rationale |
|-------|----------|------------------|-----------|
| txHash | secondary | ProgressiveDisclosure | Useful for audit but not critical; deferrable. |
| amount | primary | JTBD | Core to the functional job: confirming transferred value. |
| confirmations | primary | JTBD | Reduces emotional friction (settlement anxiety) — emotional-job intervention. |
```

Multi-principle rationale ("JTBD + Miller") is allowed in prose but the **Anchor column** must hold a single ID for Phase 7 whitelist enforcement.
