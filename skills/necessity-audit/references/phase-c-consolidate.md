# Phase C — Consolidate verdicts + emit gate

## Input

- `phaseA.json` — Claude classifications
- `debate.json` — parsed Codex debate (threadId, rounds, equilibriumReached, perElementVerdicts, evidenceCitations, conclusion)
- `preflight.json` — activeDimensions, docKind, depth, greenfield
- `overrides` — optional `<id>:<rationale>[;...]`

## CLI

```bash
node scripts/skills/necessity-audit/consolidate.js \
  --phase-a <phaseA.json> \
  --debate <debate.json> \
  --preflight <preflight.json> \
  --overrides "FR-5:needed for Q3" \
  --depth normal \
  --output <report.json>
```

## Pipeline (see `consolidate.js::consolidate`)

| Step | Function | Purpose |
|------|----------|---------|
| 1 | `mergeVerdicts` | Attach Codex verdict + id-tagged citations to each Phase-A element; fall back to text-match for untagged prose citations |
| 2 | `stricter` | Pick `final` = max(Claude, Codex) on `Cut > Review > Keep` scale; unknown labels pass through unchanged |
| 3 | `applyOverrides` | Any `<id>:<reason>` in overrides → `final=Keep`, attach `user_override.{kept_reason, timestamp}` |
| 4 | `runDeterministicChecks` | 6 boolean checks below |
| 5 | `findUnderCoveredDimensions` | Narrative-only: flag active dims not mentioned in debate conclusion + rounds transcript |
| 6 | `aggregateDimensions` | Per-dim severity: Clean/Low/Med/High by Cut/Review counts |
| 7 | `selectGate` | Final gate (see below) |

## 6 Deterministic Checks (all must pass)

| Check | Pass condition |
|-------|---------------|
| `rounds_ok` | `debate.rounds >= 2` |
| `has_evidence_citation` | Any element has `codex.evidence.length > 0` |
| `has_explicit_stance` | `/\b(Challenge\|Defend\|Accept\|Reject\|Concede)\w*/i` matches in conclusion |
| `has_threadId` | `debate.threadId` non-empty |
| `equilibrium_required_met` | `depth !== 'deep' \|\| debate.equilibriumReached === true` |
| `conclusion_references_rounds` | `/\b(?:round\s+\d+\|R\d+)\b/i` matches in conclusion (SKILL.md Rule #4) |

## Gate selection

| Condition | Gate | Narrative includes |
|-----------|------|-------------------|
| Any check fails | `⛔ Needs revision` | `⚠️ Need Human: deterministic checks failed: <list>` + under-covered if any |
| Checks pass + un-overridden Cut exists | `⛔ Needs revision` | `⛔ N elements flagged for removal` + under-covered if any |
| Checks pass + only overridden Cut | `✅ Mergeable` | `ℹ️ N elements kept via --override` + under-covered if any |
| All clean | `✅ Mergeable` | (empty or Review-sweep suggestion) |

Narrative may contain `⚠️ Need Human` lines — these are advisory. The gate sentinel is always `✅ Mergeable` or `⛔ Needs revision` (hook-parseable).

## Suggested-next

- Un-overridden Cut → `Revise Cut elements: <ids>` + override hint
- `✅ Mergeable` + any Review → `Consider /simplify on Review elements`
