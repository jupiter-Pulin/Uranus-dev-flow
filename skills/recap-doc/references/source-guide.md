# Recap Source Collection Guide

Multi-stage collection strategy for `/recap-doc`. Three stages executed sequentially. **Focus**: this round of changes (as defined by the ScopeReport), **not** the entire feature.

## Relationship to `/tech-brief`

`/recap-doc` reuses the collection pattern from `@skills/tech-brief/references/source-guide.md` (Stages 2 and 3), but scope and intent differ:

| Aspect | `/tech-brief` | `/recap-doc` |
|--------|--------------|--------------|
| Input | `feature-key` (resolver output) | `ScopeReport` JSON (file-level diff) |
| Paths surveyed | All files under `docs/features/<key>/` + `skills/<key>/` + `scripts/` | Only paths listed in `ScopeReport.files[].path` |
| Git range | `HEAD~20..HEAD` per feature path | `scope.base_ref..HEAD` per scope file (or uncommitted diff) |
| Goal | Stable narrative for teammates | Time-boxed recap of the current round |
| Missing doc handling | `[Source unavailable]` markers | Same markers; blind-spot bullet instead of Gate: Need Human |

Reuse the commands — reinterpret the scope.

## Stage 1: ScopeReport Load

Already produced by `scripts/detect-scope.js` (T1). `/recap-doc` consumes it rather than regenerating.

| Field | Usage |
|-------|-------|
| `source` (`uncommitted` / `branch` / `session`) | Metadata header; decides diff commands in Stage 2 |
| `base_ref` | Left side of `git diff` and `git log` ranges |
| `files[].path` | Primary file list (do not widen scope) |
| `files[].change_type` | Drives §2 Changed Files column |
| `files[].lines_changed` | Sort key for top-N file selection |
| `feature_context.key` / `docs_path` / `has_tech_spec` | Stage 3 + §4 Drift trigger |
| `confidence` / `fallback_trace` | Metadata header + §5 Blind Spots heuristics |

**Guard**: If `files.length === 0` or `source === null`, stop before Stage 2 and return the same error produced by Phase 1 (see `SKILL.md`). Do not fabricate evidence.

## Stage 2: Code & Git Evidence

Collect implementation evidence for the scope files only.

| Step | Command | Cap | Output |
|------|---------|-----|--------|
| 1. Commit history | `git log --oneline <base-ref>..HEAD -- <path>` per scope file | 20 commits total (dedup across files) | Timeline for §7 Evidence |
| 2. Diff stats | `git diff --stat <base-ref>..HEAD -- <path>` per scope file | Summary only | Cross-check with `ScopeReport.files[].lines_changed` |
| 3. Changed hunks | `git diff <base-ref>..HEAD -- <path>` per scope file | Hunks only; cap per-file output at 200 lines | Input for `/codex-explain` in Phase 4a |
| 4. File reading | `Read` tool on top-N **source files** (exclude docs/test/config) | top-N by depth; 100 lines each | `file:line` references for §2 and §3 |

**Uncommitted layer special case**: when `source === 'uncommitted'`, replace `git diff <base>..HEAD` with `git diff HEAD -- <path>` (working tree vs HEAD), matching T1's collection behavior.

### Top-N File Selection (§2 Changed Files row count)

| Depth | Top-N rows | Sort key | Code snippets |
|-------|-----------|----------|---------------|
| brief | 5 | `lines_changed.total` desc | No |
| normal | 10 | `lines_changed.total` desc | No |
| deep | 15 | `lines_changed.total` desc | Yes (inline per §2.row) |

Ties broken by `change_type` priority (`added` > `modified` > `deleted` > `renamed`) then alphabetical path.

### Exclusion Filter (file reading only, not row counting)

Applied at step 4 (Read) to keep `/codex-explain` focused on source logic:

1. Exclude: `*.md`, `*.json` config, `*.lock`, `*.snap`, paths under `test/**`
2. If zero source files remain after filtering → skip step 4, annotate §2 rows with `[Reading skipped — doc/test-only change]`, and flag a blind spot (heuristic `Test without source` or `Config change`, see `output-template.md`).

## Stage 3: Feature Doc Cross-reference (conditional)

Runs only when `feature_context.has_tech_spec === true`.

| Step | Command | Output |
|------|---------|--------|
| 1 | `Read <docs_path>/2-tech-spec.md` | Section map (§1 Background through §7 Open Questions) |
| 2 | Extract Work Breakdown / Roadmap items | Rows for §4 Drift table |
| 3 | `Read <docs_path>/1-requirements.md` (if exists) | AC list for blind-spot heuristic `Missing request ticket link` |
| 4 | `Glob <docs_path>/requests/*.md` | Latest request doc for §5 heuristic (no status filter) |

**No resolver invocation**: `/recap-doc` trusts `feature_context.docs_path` from the ScopeReport. If the tech-spec cannot be read (missing file, permission), log `[Partial — tech-spec unreadable]` in §4 and add a blind spot.

## Missing Source Handling

Follow the same markers as `/tech-brief`:

| Situation | Marker |
|-----------|--------|
| Source file missing | `[Source unavailable — <path> not found]` |
| Partial data | `[Partial — <type> exists but lacks data for this subsection]` |
| Section fully empty | Still emit the heading, add marker + blind spot |

Never fabricate content. Blind spots are preferred over silence (FR-9 Must).

## Section-to-Source Priority

| Recap section | Primary | Secondary | Fallback |
|---------------|---------|-----------|----------|
| §1 Overview | `ScopeReport.focus_hint` + top-file intents | Git log subjects | `[Partial — synthesized from diff stats only]` |
| §2 Changed Files | `ScopeReport.files[]` | Stage 2 diff stats | n/a (always available) |
| §3 Design Decisions | `/codex-explain` outputs | Tech-spec AD-N | `[Source unavailable]` + blind spot |
| §4 Drift | Tech-spec Work Breakdown vs `ScopeReport.files[]` | request doc AC | Section omitted if `has_tech_spec === false` |
| §5 Blind Spots | Heuristics in `output-template.md` | n/a | Fallback wording «本輪未偵測到明顯盲點» |
| §6 Anticipated Questions | LLM synthesis from §1-§4 | n/a | Omitted at `brief` |
| §7 Evidence | Stage 2 step 1-3 outputs + `ScopeReport.base_ref` | n/a | `[No commits in range]` (rare — blind spot) |

## Performance Budget

Stages 1-3 must finish in ≤ 10 s (Stage 4a `/codex-explain` consumes the rest of NFR-2's 30 s budget). Use parallel `Promise.all` for per-file `git log` / `git diff --stat` calls; do not serialize.
