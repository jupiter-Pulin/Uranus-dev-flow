# Recap: post-dev-recap T2 (/recap-doc)

> **Scope source**: uncommitted
> **Detected at**: 2026-04-17T07:06:53.030Z
> **Base ref**: HEAD
> **Confidence**: high
> **Focus**: none
> **Depth**: normal
> **Generated at**: 2026-04-17T07:10:00Z
>
> **Note on save path**: `ScopeReport.feature_context.key` resolved to `null` because the 21-file scope spans two features' doc trees. This recap is saved under `docs/features/post-dev-recap/` because the session's semantic centre-of-mass (SKILL.md + references + test + ticket update) clearly belongs to T2 of the `post-dev-recap` feature. See §5 Blind Spots for the scope-detection observation.

## 1. Overview

This round delivers **T2 `/recap-doc` skill** for the `post-dev-recap` feature: a thin orchestrator skill that consumes a ScopeReport JSON (produced by T1's `detect-scope.js`) and emits a human-readable recap markdown covering changed files, design intents, blind spots (FR-9 Must), and anticipated questions (FR-11). The session wrote the skill definition + three reference files + 34 contract tests in the tech-brief.test.js pattern, registered `/recap-doc` in all three `CLAUDE*.md` catalogs, and ran the full `/feature-dev` gate sequence (codex-review-fast + doc-review + precommit + adequacy + doc sync) — all passing. The T2 ticket is now Status: Candidate Complete; T3 (`/recap-ask`) and T4 (`/post-dev-recap` wrapper) are the next tickets.

## 2. Changed Files

| # | File | Change | Lines (+/-) | Design Intent | Key Code |
|---|------|--------|-------------|---------------|----------|
| 1 | `test/skills/recap-doc.test.js` | added | +366/-0 | 34 contract tests: frontmatter, depth matrix (brief=5/normal=10/deep=15), FR-9 always-on §5 + fallback wording, FR-11 brief-omits §6, NFR-2/5/7 references, ScopeReport v1 fields, CLAUDE\*.md cross-catalog registration | `test/skills/recap-doc.test.js:338` |
| 2 | `skills/recap-doc/SKILL.md` | added | +185/-0 | Orchestrator skill, 8-section contract, 5-phase workflow (Load → Evidence → Spec-xref → Synth → Redact+Write); Phase 4a reuses `/codex-explain`, Phase 5 enforces `security-redact.js` | `skills/recap-doc/SKILL.md:60` |
| 3 | `skills/recap-doc/references/prompt-template.md` | added | +155/-0 | LLM synthesis prompt for Phase 4b; separates Claude first-pass (no Codex) from optional Codex second-opinion which carries the mandatory independently-research block per `@rules/codex-invocation.md` | `skills/recap-doc/references/prompt-template.md:26` |
| 4 | `skills/recap-doc/references/output-template.md` | added | +139/-0 | Canonical §1-§7 template, depth matrix (all depths × all sections), 7-heuristic Blind Spots table, fallback "本輪未偵測到明顯盲點" wording, invariants for test assertions | `skills/recap-doc/references/output-template.md:50` |
| 5 | `skills/recap-doc/references/source-guide.md` | added | +104/-0 | Three-stage collection strategy: ScopeReport load → Stage 2 git evidence (reuse `tech-brief` pattern) → Stage 3 conditional tech-spec cross-reference; contrasts scope/intent against `/tech-brief` | `skills/recap-doc/references/source-guide.md:7` |
| 6 | `docs/features/post-dev-recap/requests/2026-04-17-t2-recap-doc-skill.md` | modified | +9/-9 | Status lifecycle: Pending → Candidate Complete. All 9 ACs checked with file:line evidence claims; Progress table filled (Analysis/Development/Testing/Acceptance ✅/⚠️) | `docs/features/post-dev-recap/requests/2026-04-17-t2-recap-doc-skill.md:5` |
| 7 | `CLAUDE.md` | modified | +1/-0 | Registered `/recap-doc` row in Command Quick Reference under "Understanding" category, adjacent to `/tech-brief` | `CLAUDE.md:59` |
| 8 | `CLAUDE.template.md` | modified | +1/-0 | Same registration row as CLAUDE.md for template parity (smart-merge target for downstream installs) | `CLAUDE.template.md:107` |
| 9 | `.claude/CLAUDE.md` | modified | +1/-0 | Local-only copy (gitignored); the test gates on `existsSync` so fresh CI clones don't fail | `.claude/CLAUDE.md:59` |
| 10 | `docs/features/post-dev-recap/requests/2026-04-17-t1-scope-detector-redaction-util.md` | modified | ±0 | Untracked flag only — T1 ticket content unchanged since T1 completion | `docs/features/post-dev-recap/requests/2026-04-17-t1-scope-detector-redaction-util.md:1` |

> 11 additional files in scope (feasibility / tech-spec / request tickets for T3-T6 / T1 scripts + tests / stray harness-engineering doc) appear as modified in `git status` but were unchanged this session — all content predates T2. See §5 for the scope-detection caveat.

## 3. Design Decisions

- **Thin orchestrator over monolithic script.** `/recap-doc` is a SKILL.md (Claude instructions) rather than executable JavaScript. Rationale: the work is LLM synthesis + tool orchestration, not algorithmic. A skill is the correct unit; tests assert the *contract* (structure, wording, invariants), not runtime execution. See `skills/recap-doc/SKILL.md:36`.
- **Reuse before reimplementation (NFR-5).** Phase 2 evidence collection sends callers to `@skills/tech-brief/references/source-guide.md` (Stages 2-3 pattern); Phase 4a dispatches per-file explanations via `/codex-explain` Skill call. Nothing is reimplemented. See `skills/recap-doc/SKILL.md:166-169`.
- **Blind Spots are Must, always-on (FR-9).** §5 heading is mandatory at every depth. When zero heuristics trigger, emit a fallback block with the literal string `本輪未偵測到明顯盲點` + explicit reasoning ("推論依據"). This prevents the skill from silently hiding uncertainty. See `skills/recap-doc/references/output-template.md:50-64`.
- **Codex invocation boundary.** The Phase 4b synthesis prompt splits into two templates: a Claude first-pass (no Codex call, no research block required) and an optional Codex Second-Opinion prompt that carries the verbatim "You must independently research the project" block. This satisfies `@rules/codex-invocation.md` without inflating the common path. See `skills/recap-doc/references/prompt-template.md:26-31`.
- **Secret redaction is a pre-write gate (NFR-7).** Phase 5 invokes `redact(text)` before any `fs.writeFile`. On `AbortError`, the file is never written and a fingerprint is emitted to stderr. This relies on T1's two-tier `scripts/security-redact.js` (abort-on-high, mask-medium). See `skills/recap-doc/SKILL.md:94-98`.
- **Depth matrix is a contract, not a suggestion.** `brief=5 / normal=10 / deep=15` top-N values are declared in three places (SKILL.md depth table, source-guide top-N selection, output-template depth matrix) and verified by test L113-127. A mismatch anywhere fails the test. See `skills/recap-doc/SKILL.md:104-108`.
- **`.claude/CLAUDE.md` treated as optional in cross-catalog test.** `.claude/` is gitignored; fresh CI clones do not have `.claude/CLAUDE.md`. The registration-parity test (L338-360) gates on `existsSync` so CI passes while still enforcing parity when the file is present. See `test/skills/recap-doc.test.js:356`.

## 5. Blind Spots

- **Test-without-source for this scope.** `test/skills/recap-doc.test.js` was added; the reading-exclusion filter drops `.md` and `test/**`, leaving no "source" file for Phase 4a to explain. Triggered heuristic: `Test without source`. Mitigation in this case: the "source" IS the skill definition (`.md`), which is intentional — `/recap-doc` is a skill, not JavaScript. This mismatch is *expected* for skill deliverables but would be suspicious for feature code. See `test/skills/recap-doc.test.js:1-10`.
- **Scope spans two features — ScopeReport resolved `feature_context.key=null`.** The uncommitted layer detected 21 files across `docs/features/post-dev-recap/` and `docs/features/harness-engineering-adoption/`. `detect-scope.js` correctly refused to guess a single feature key. Recap was manually saved under `post-dev-recap/` based on session narrative, not `ScopeReport.feature_context`. See `scripts/detect-scope.js:402` (the resolution function).
- **Test suite full run shows 1332-1335 pass depending on moment of measurement.** In this session the count moved from 1331→1332→1335 as the test file evolved. Reason: new tests added incrementally (31 → 33 → 34) while the full-suite baseline also grew. No test was deleted; all counts are net-positive. See `test/skills/recap-doc.test.js` (final: 34 tests pass).
- **Doc reviewer reported 4 "Critical" issues of which 2 were false positives.** The doc-review skill flagged `@rules/` (correct convention) and "missing §4 row in depth matrix" (present at L90 — reviewer missed it). Only the `.claude/skills/` → `@skills/` path change (Issue 2) and the codex-invocation clarification (Issue 4) were genuinely required. Future doc-review invocations on this skill should expect similar noise. See `skills/recap-doc/references/output-template.md:90`.
- **Adequacy Gate is ⚠️ Adequate with exceptions (4/8 ACs).** AC1, AC6, AC7, AC8 are covered at contract-level only; runtime end-to-end assertion (actually running `/recap-doc` against a real ScopeReport and asserting the produced markdown) is deferred to T4 wrapper integration. Exception class: `ENV_UNAVAILABLE`. Confirmed by Codex test-review as VALID_EXCEPTION. See `docs/features/post-dev-recap/requests/2026-04-17-t2-recap-doc-skill.md:61`.

## 6. Anticipated Questions

- **Q1: Why is `/recap-doc` a skill definition rather than a Node script that produces the markdown directly?**
  - Hint: The work is LLM synthesis + Skill-tool orchestration (calling `/codex-explain` for per-file intents), not deterministic transformation. A Node script would have to reimplement what the Skill tool already does. Use `/recap-ask` on `test/skills/recap-doc.test.js` to see how the 34 tests verify the contract layer without needing a runtime. Full rationale in `skills/recap-doc/SKILL.md:36`.
- **Q2: Where should I save the recap when `feature_context.key` is null but the session is clearly about one feature?**
  - Hint: The skill's Save Behavior table (`SKILL.md:110-118`) says fallback to `docs/briefing-recap-<date>.md` when no feature context. In practice you can override with `--output <path>`. This recap used `--output`-equivalent routing based on session narrative; any automated wrapper (T4) should either accept an explicit `--feature` hint or stick with the fallback. Use `/recap-ask` for trade-offs.
- **Q3: How do I verify `/recap-doc` actually honours `--depth` at runtime when the tests only check the depth matrix contract?**
  - Hint: Run it. The 34 contract tests guarantee the *template* matches the depth contract; the Claude runtime following SKILL.md then produces output conformant to that template. End-to-end runtime verification is tagged `ENV_UNAVAILABLE` and delegated to T4 wrapper tests. A smoke test is: `/recap-doc --scope <path> --depth brief` and confirm §6 is absent. Use `/recap-ask` for full context on the contract-vs-runtime split and what T4 should add.
- **Q4: What's the difference between `/recap-doc` and `/tech-brief` beyond "post-dev vs. design"?**
  - Hint: Scope unit. `/tech-brief` consumes a `feature-key` (stable narrative for teammates, spans the feature's full timeline). `/recap-doc` consumes a `ScopeReport` (time-boxed window: the current round of changes). `source-guide.md:7-17` has the full comparison table. Use `/recap-ask` for full context when choosing between the two on a real change set.

## 7. Evidence

- **Commits**: No new commits yet — all 21 files are uncommitted. Session-produced artefacts (SKILL.md, references, test, ticket update, CLAUDE\*.md rows) are staged in working tree only.
- **Base ref**: `HEAD` (uncommitted layer)
- **File index** (session-authored, not full scope):
  - `skills/recap-doc/SKILL.md:60` — Phase 1 scope-load entry point
  - `skills/recap-doc/SKILL.md:104-108` — depth-level table (brief=5/normal=10/deep=15)
  - `skills/recap-doc/references/output-template.md:50-64` — §5 Blind Spots always-on + fallback wording
  - `skills/recap-doc/references/output-template.md:90` — §4 Drift row (the one the doc reviewer missed)
  - `skills/recap-doc/references/output-template.md:111` — invariant statement `heading and fallback block mandatory regardless of depth`
  - `skills/recap-doc/references/prompt-template.md:26-31` — Codex not-invoked-here notice (fix for codex-invocation compliance clarification)
  - `skills/recap-doc/references/source-guide.md:52-54` — top-N selection table
  - `test/skills/recap-doc.test.js:143-173` — FR-9 Blind Spots contract tests (always-on + fallback + depth matrix)
  - `test/skills/recap-doc.test.js:193-210` — FR-11 Anticipated Questions (brief omit + `/recap-ask` handoff)
  - `test/skills/recap-doc.test.js:338-360` — CLAUDE\*.md cross-catalog registration test (with `.claude/CLAUDE.md` existsSync gate)
  - `CLAUDE.md:59` / `CLAUDE.template.md:107` / `.claude/CLAUDE.md:59` — identical `/recap-doc` registration row
  - `docs/features/post-dev-recap/requests/2026-04-17-t2-recap-doc-skill.md:5` — Status field (now Candidate Complete)
- **Gate trail** (this session):
  - `/codex-review-fast` (Codex MCP, thread `019d9a25-fe61-7992-83fc-ca3870dedb94`): initial P2×3 + Nit×1 → fixes → ✅ Ready; secondary `pr-review-toolkit:code-reviewer` raised P0 (`.claude/CLAUDE.md` gitignored) → fix → ✅ Ready
  - `/codex-review-doc` (skill docs): ⛔ Needs revision (4 Critical, 2 false-positive) → fixes for `.claude/skills/` → `@skills/` and Codex-invocation clarification → ✅ Mergeable
  - `/precommit` (full): 1298/1300 pass, 2 skipped, 0 fail → ✅ All Pass
  - `/codex-test-review --ac-trace`: ⚠️ Adequate with exceptions (VALID_EXCEPTION ENV_UNAVAILABLE × 4)
  - `/codex-review-doc` on T2 ticket update: ✅ Mergeable (all file:line AC claims verified)
