---
description: First-principles briefing from technical documents. Extract reasoning chains, assumptions, and decision sensitivity from completed docs.
argument-hint: <doc-path> [--depth brief|normal|deep] [--verify off|codex] [--output <path>] [--no-save]
allowed-tools: Read, Grep, Glob, Write, mcp__codex__codex, mcp__codex__codex-reply
---

## Must read and follow the skill below before executing this command:

@skills/fp-brief/SKILL.md
@skills/fp-brief/references/output-template.md
@skills/fp-brief/references/detection-rules.md
@skills/fp-brief/references/extraction-guide.md
@skills/fp-brief/references/codex-verify-prompt.md

## Context

- Project root: !`git rev-parse --show-toplevel`

## Task

Generate a first-principles briefing from the specified technical document.

### Input

```
$ARGUMENTS
```

| Parameter | Description |
|-----------|-------------|
| `<doc-path>` | Required — path to source markdown document |
| `--depth brief\|normal\|deep` | Output detail level (default: `normal`) |
| `--verify off\|codex` | Independent reasoning verification (default: `off`) |
| `--output <path>` | Custom output path |
| `--no-save` | Print to stdout instead of saving file |

### Workflow

```
Validate path → Read doc → Redaction scan → Auto-detect format → Extract 6 sections → Assemble output → [Optional: Codex verify] → Save
```

1. **Validate**: Normalize path, reject `..` traversal, enforce repo boundary
2. **Read**: Load source document content
3. **Redact**: Scan for secret patterns (fail-safe: high-confidence → abort, medium → mask)
4. **Detect**: Auto-detect document format using `references/detection-rules.md`
5. **Extract**: Build 6 sections per `references/extraction-guide.md` heuristics
6. **Assemble**: Apply depth filter + source citations per `references/output-template.md`
7. **Verify** (optional): If `--verify codex`, dispatch per `references/codex-verify-prompt.md`
8. **Save**: Write to `*-fp-brief.md` (or stdout if `--no-save`)

### Key Rules

- **Not a summary** — extract reasoning chains, not compress content
- **Source citations required** — every Decision must cite source section (`Source: §<ref>`)
- **Evidence Insufficient Rule** — never fabricate content; use `[Evidence insufficient]` marker
- **Length caps** — brief ~500w, normal ~1500w, deep ~2500w (upper bounds, not targets)
- **Long docs (>500 lines)** — split by `##` headings, extract per-section, merge + dedup

## Output

See `references/output-template.md` for full template.

```markdown
# First-Principles Briefing: <title>

> Source: <path> | Depth: <level> | Format: <type> | Generated: <timestamp>

## 1. Root Problem
## 2. Assumptions Register
## 3. Reasoning Chain
## 4. Alternative Rejection Log
## 5. Decision Sensitivity
## 6. Open Unknowns
## 7. Verification Delta (optional, --verify codex only)
```

## Save

By default, save to the same directory as the source document with `-fp-brief.md` suffix.
Example: `docs/features/auth/2-tech-spec.md` → `docs/features/auth/2-tech-spec-fp-brief.md`

If `$ARGUMENTS` contains `--output <path>`, save to the specified location.
If `$ARGUMENTS` contains `--no-save`, print to stdout only.

## Examples

```bash
/fp-brief docs/features/seek-verdict/2-tech-spec.md
/fp-brief docs/features/auth/2-tech-spec.md --depth brief
/fp-brief docs/features/auth/2-tech-spec.md --depth deep --verify codex
/fp-brief notes/design-decisions.md --no-save
```
