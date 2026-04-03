# Target Detection

## File Extension → Type Mapping

### v1 (dispatched)

**Precedence**: Test-specific patterns (`.test.js`, `.spec.ts`) are checked before generic extensions. A file matching a v2 test pattern is classified as `test` and skipped, NOT dispatched as `code`.

| Extension Pattern | Type | Dispatch |
|------------------|------|----------|
| `.js`, `.ts`, `.mjs`, `.cjs` (excluding `*.test.*`, `*.spec.*`) | code | `/simplify` |
| `.py`, `.go`, `.rs`, `.java` | code | `/simplify` |
| `.md` (non-AI) | doc-structure | `/doc-refactor` |
| `.md` (AI artifacts detected) | doc-ai | `/de-ai-flavor` |

### v2 (classified, not dispatched)

| Extension Pattern | Type | Status |
|------------------|------|--------|
| `.json`, `.yaml`, `.yml`, `.toml` | config | Classified only (v2) |
| `.sh`, `.bash`, `.zsh` | shell | Classified only (v2) |
| `.test.js`, `.spec.ts`, `.test.ts` | test | Classified only (v2) |

v2 types: log `[REFACTOR_SKIPPED] {target}: type not yet dispatched (v2)` and continue.

## AI Artifact Heuristic

Scan `.md` files for 6 pattern types (sourced from `/de-ai-flavor` detection rules):

| Pattern Type | Examples |
|-------------|----------|
| Tool names | Claude, Codex, GPT, AI assistant |
| Boilerplate | "Let me...", "First...then...", "In conclusion" |
| Over-structuring | One sentence per heading, excessive #### levels |
| Service tone | "Hope this helps", "If you have questions..." |
| Self-description | "Next I will...", "I will proceed to..." |
| Iteration leaks | "Round 1/Round 2/Round N" |

**Threshold**: 3+ matches of distinct pattern types → classify as `doc-ai`; fewer → `doc-structure`.

**Exclusions** (per `/de-ai-flavor` SKILL.md When NOT to Use):
- Documents discussing AI technology as the subject (e.g., tech specs about AI features)
- Co-Authored-By in CHANGELOG (Git convention)
- Variable/function names in code files
When in doubt, prefer `doc-structure` over `doc-ai` to avoid stripping legitimate AI-related content.

## Path Validation

`--target <path>` must be repo-relative. Validation rules:

| Rule | Check | Rejection |
|------|-------|-----------|
| No absolute paths | Path starts with `/` | `[REFACTOR_BLOCKED] {path}: absolute path not allowed` |
| No traversal | Path contains `..` | `[REFACTOR_BLOCKED] {path}: path traversal not allowed` |
| No symlink escape | Resolved path outside repo root | `[REFACTOR_BLOCKED] {path}: symlink escape detected` |
| File exists | `existsSync(path)` | `[REFACTOR_BLOCKED] {path}: file not found` |

## `--auto` Mode Target Selection

Priority score formula:

```
score(target) = 0.40 × complexity + 0.35 × change_frequency + 0.25 × isolation
```

| Signal | Source | Computation |
|--------|--------|------------|
| complexity | `wc -l <file>` | Normalized 0-1 by max in scope |
| change_frequency | `git log --oneline -- <file> \| wc -l` | Normalized 0-1 by max in scope |
| isolation | Inverse of dependent file count | `1 - (grep_count / max_grep_count)` |

Sort descending → take top N (default `--max-targets 10`).
