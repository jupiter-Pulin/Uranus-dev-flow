# Source Collection Guide

Multi-source collection strategy for `/tech-brief`. Three stages executed sequentially.

## Stage 1: Document Collection

Read feature docs from resolver output. All sources are optional.

| Source | Discovery Method | Extract |
|--------|-----------------|---------|
| `2-tech-spec.md` | `canonical_docs.tech_spec` | Problem, Goals, Architecture, Design Decisions, Risks, Open Questions |
| `3-architecture.md` | `canonical_docs.architecture` | Architecture diagram, AD-N decisions, Trade-offs |
| `0-feasibility-study/` | `canonical_docs.feasibility` | Alternative comparison, Rejection reasons |
| `4-implementation.md` | `doc_inventory` filter `type === 'implementation'` | Implementation notes, Lessons learned |

**Note**: `canonical_docs` only provides 4 roles: `tech_spec`, `architecture`, `feasibility`, `requirements`. Implementation docs are discovered via `doc_inventory` array.

### Feature Resolver Invocation

```bash
node scripts/resolve-feature-cli.js [--feature <key>]
```

Parse JSON output for `canonical_docs` and `doc_inventory`. If resolver fails or returns null key, Gate: Need Human.

## Stage 2: Code & Git Evidence

Collect implementation evidence from git history and source files.

| Step | Command | Cap | Output |
|------|---------|-----|--------|
| 1. Commit history | `git log --oneline -20 -- docs/features/<key>/ skills/<key>/ scripts/` | 20 commits | Timeline, change summary |
| 2. Diff stats | `git diff --stat HEAD~20..HEAD -- <feature-paths>` | Summary only | File-level change magnitude |
| 3. Changed file list | `git diff --name-only HEAD~20..HEAD -- <feature-paths>` | All | File paths for next step |
| 4. File reading | Read top 5 changed **source files** (exclude docs/test/config) | 5 files, 100 lines each | `file:line` references, code context |

### File Selection for Reading

From the changed file list (step 3):

1. Exclude: `docs/**`, `test/**`, `*.json` config, `*.md`
2. Sort by: change frequency (files appearing in more commits first)
3. Take top 5
4. For each: Read targeted sections (function definitions, key logic) up to 100 lines

If no source files remain after filtering (docs-only change), skip file reading and note in provenance: `[Implementation section based on git log only]`.

## Stage 3: Request Selection

Collect request doc metadata (AC status, progress, references).

### Selection Rules

Unlike forward-looking skills (e.g. `/create-request --update`), tech-brief is a **post-development** tool — completed features are its primary use case. Therefore, include **all** request docs regardless of status.

| Condition | Action |
|-----------|--------|
| 0 request docs | `[Source unavailable — no request docs found for this feature]` |
| 1 request doc | Use it |
| 2-3 request docs | Use all, sorted by date desc |
| >3 request docs | Use top 3 by date desc, note `[N additional request docs omitted]` |

**No status filter**: All request docs are included (Completed, In Progress, Candidate Complete, Pending, etc.). This is intentional — tech-brief needs the canonical implementation record from completed requests for Background, References, and Next Steps sections.

### Extraction Targets

From each selected request doc:

| Section | Extract |
|---------|---------|
| `## Acceptance Criteria` | Checked/unchecked items for Limitations section |
| `## Progress` | Phase statuses for Next Steps section |
| `## References` | Codex threadIds, PR links for Discussion section |
| `> **Status**:` | Current status for Background section |

### PR Link Fallback

| Priority | Source | Pattern |
|----------|--------|---------|
| 1 | Request `## References` | Direct links |
| 2 | Git log | `Merge pull request #N` patterns |
| 3 | None found | `[No PR links found]` |

## Missing Source Handling

When any source is unavailable:

```markdown
[Source unavailable — no <type> found for this feature]
```

When partial data:

```markdown
[Partial — <type> exists but lacks data for this subsection]
```

Never fabricate content. If all sources for a section are missing, the section still appears in output with the missing source marker (never omit sections).

## Section-to-Source Priority Mapping

| Section | Primary | Secondary | Fallback |
|---------|---------|-----------|----------|
| 1. Background | tech-spec §1 | request doc status/background | git log first commit |
| 2. Design Decisions | tech-spec §3 + architecture AD-N | feasibility study | tech-spec §3 only |
| 3. Implementation | Changed files + git diff | tech-spec §2 | git log + diff stat |
| 4. Limitations | tech-spec §4 + §7 | request AC unchecked | tech-spec §7 only |
| 5. Discussion | request `## References` | git merge commits | `[No references found]` |
| 6. Next Steps | request `## Progress` | tech-spec §5 | `[No roadmap available]` |
