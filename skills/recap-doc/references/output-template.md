# Recap Doc Output Template

Output template for `/recap-doc`. Produces `briefing-recap-<YYYY-MM-DD>.md` — **ephemeral by default** (written to `<tmp>/sd0x-dev-flow-recap/`); callers that want the recap committed with the feature docs opt in via `--output`. See the Save Behavior section at the bottom of this file (and `SKILL.md` Save Behavior) for the canonical rule.

The template aligns with tech-spec §3.2.2 and is classified as `ancillary/briefing` per `scripts/config/doc-taxonomy.json` L94-99 (pattern `^briefing-`).

## Metadata Header

```markdown
# Recap: <feature-key | "session">

> **Scope source**: uncommitted | branch | session
> **Detected at**: <ISO 8601 from ScopeReport.detected_at>
> **Base ref**: <ScopeReport.base_ref>
> **Confidence**: high | medium | low
> **Focus**: <user-provided keyword or "none">
> **Depth**: brief | normal | deep
> **Generated at**: <ISO 8601>
```

## Section Template

```markdown
## 1. Overview

{2-4 sentences summarizing the purpose of this round of changes.
Use `ScopeReport.focus_hint` if present to bias framing.}

## 2. Changed Files

| # | File | Change | Lines (+/-) | Design Intent | Key Code |
|---|------|--------|-------------|---------------|----------|
| 1 | `{path}` | added/modified/deleted/renamed | +{a}/-{d} | {one-sentence intent from /codex-explain} | `{path}:{line}` |

> Limit rows to top-N per depth (see Depth Matrix below).

## 3. Design Decisions

{List of N decisions inferred from the diff + explanations.
Each decision: 1-line statement + rationale + affected file:line.}

- **{Decision}** — {rationale}. See `{path}:{line}`.

## 4. Spec vs Implementation Drift        <!-- only if feature_context.has_tech_spec === true -->

| Spec Item | Implementation | Match? | Notes |
|-----------|----------------|--------|-------|
| {WBS item from 2-tech-spec.md §5} | {changed files that cover it} | ✅ / ⚠️ / ❌ | {what is off, if anything} |

## 5. Blind Spots                        <!-- ALWAYS present (FR-9 Must) -->

{Items listed per heuristics below. If no items qualify, emit the fallback block.}

- **{Heuristic name}** — {observation} (ref: `{path}:{line}`)

### Fallback (when no items qualify)

> **本輪未偵測到明顯盲點。**
>
> 推論依據：
> - 變更範圍 {N} 檔案，皆有 file:line 引用
> - {其他啟發式回報的正向訊號，例如「規格對照表全為 ✅」「安全關鍵路徑 0 檔案」}
>
> 若你仍感到不安，可用 `/recap-ask` 追問特定檔案或決策。

## 6. Anticipated Questions              <!-- normal/deep only; omitted at brief -->

- **Q1: {question phrased from user perspective}**
  - Hint: {short answer direction}; use `/recap-ask` for full context.
- **Q2: ...**
- **Q3: ...**

## 7. Evidence

{Machine-readable evidence table.}

- **Commits**: {SHA + subject, from git log}
- **Base ref**: `{ScopeReport.base_ref}`
- **File index**:
  - `{path}:{line}` — {what it demonstrates}
```

## Depth Matrix

| Section | brief | normal | deep |
|---------|-------|--------|------|
| §1 Overview | 2 sentences | 3-4 sentences | 3-4 sentences + context |
| §2 Changed Files | top-5, no code | top-10, no code | top-15 + inline snippets |
| §3 Design Decisions | top-3 decisions | full list | full list + alternatives considered |
| §4 Drift | only ❌ / ⚠️ rows | all rows | all rows + explanation of matches |
| §5 Blind Spots | **top-3 items** or fallback block | **full list** or fallback block | **full list** or fallback block |
| §6 Anticipated Questions | **omitted** | **≥ 3 questions** | **≥ 3 questions** + hint answers |
| §7 Evidence | commit SHAs only | commits + file index | commits + file index + diff stats |

## Blind Spots Heuristics (FR-9 Must)

Emit a blind-spot bullet under §5 when any of these conditions match the scope:

| Heuristic | Trigger Condition | Bullet wording |
|-----------|-------------------|----------------|
| Test without source | Test file changed, corresponding source not in scope | "Tests changed without matching source file — verify behavior intent." |
| Source without test | Source file changed, no test file in scope | "Source changed without test coverage — consider regression risk." |
| Config change | Config file touched (`*.json`, `*.yml`, `*.toml`) without accompanying code | "Config-only change — confirm consumers read the new value." |
| Secret near boundary | Security-sensitive path changed (`*secret*`, `*auth*`, `*token*`) | "Security-sensitive change — recommend `/codex-security` before merge." |
| Large deletion | File with `lines_changed.deleted > 50` | "Substantial deletion in `{file}` — verify no dead-code miss." |
| Rename without update | Rename detected but callers not in scope | "Rename may have orphan callers outside this scope." |
| Missing request ticket link | Feature has `has_requirements=true` but no request doc evidence | "Change affects a feature with requirements but no request ticket touched — status may drift." |

**Priority cap**: at `brief`, keep the top-3 by heuristic order above. At `normal`/`deep`, include all triggered heuristics.

**No-item case**: if zero heuristics trigger, emit the §5 fallback block (see Section Template above). The heading and the fallback block are **mandatory** regardless of depth.

## ScopeReport Field Mapping

| Recap section | ScopeReport field |
|---------------|-------------------|
| Metadata header | `source`, `confidence`, `detected_at`, `base_ref`, `focus_hint` |
| §2 Changed Files table | `files[].path`, `files[].change_type`, `files[].lines_changed` |
| §4 Drift trigger | `feature_context.has_tech_spec`, `feature_context.docs_path` |
| §5 Blind Spots | `files[]` against heuristics above |
| §7 Evidence | `base_ref`, git log on `files[].path` |

## Save Behavior

Default output is **ephemeral** — recap files land in the OS temp dir, not the user's project. See `SKILL.md ## Save Behavior` for the authoritative rule.

| Condition | Output Path |
|-----------|-------------|
| Default (no `--output`) | `<tmp>/sd0x-dev-flow-recap/briefing-recap-<YYYY-MM-DD>.md` |
| `--output <path>` given | Explicit path; canonical (realpath-resolved) target must lie inside either the repo root or `<tmp>`. Paths that escape both roots are rejected. |

`<tmp>` resolves via `$TMPDIR` → `os.tmpdir()` → `/tmp`. If the target path already exists, append `-r2`, `-r3`, ... before `.md`. Callers that want the recap committed with the feature docs must opt in with `--output docs/features/<key>/briefing-recap-<YYYY-MM-DD>.md`. See `SKILL.md ## Path Security` for the full boundary rule (both sections stay in sync).

## Invariants (verified by test/skills/recap-doc.test.js)

- §5 Blind Spots heading appears in template output regardless of depth.
- §5 fallback block includes the literal string `本輪未偵測到明顯盲點`.
- §6 Anticipated Questions is absent under `brief` depth.
- Depth matrix defines top-N values `5`, `10`, `15` for brief / normal / deep respectively.
- Every `Changed Files` row carries at least one `file:line` reference.
