# Output Template

## Per-Target Result Table

```markdown
## Refactoring Results

| # | Target | Type | Catalog | Dispatch | Gate | Result |
|---|--------|------|---------|----------|------|--------|
| 1 | src/utils.ts | code | R01 | /simplify | PRESERVED + /precommit-fast ✅ | ✅ Committable |
| 2 | docs/guide.md | doc-ai | R08 | /de-ai-flavor | — | ✅ Committable |
| 3 | src/config.ts | code | R03 | /simplify | BEHAVIOR_CHANGED | ⚠️ Skipped |

**Applied**: N | **Skipped**: N | **Blocked**: N | **Total**: N
```

## Skip/Block Log Format

| Log Tag | Meaning | Example |
|---------|---------|---------|
| `[REFACTOR_SKIPPED]` | Target skipped (gate failure or baseline failing) | `[REFACTOR_SKIPPED] src/config.ts: behavioral regression detected` |
| `[REFACTOR_BLOCKED]` | Target blocked (review gate failure after max rounds) | `[REFACTOR_BLOCKED] src/api.ts: codex-review-fast not passing after 3 rounds` |

## Delta Report (`--auto` mode only)

```markdown
## Delta Report

| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| overall | 72 | 78 | +6 |
| robustness | 65 | 75 | +10 |
| stability | 80 | 80 | ±0 |

Source: `/project-audit` (Phase 0 baseline vs Phase 3 post-refactor)
```

## Committable Batches

```markdown
## Ready to Commit

Files that passed all gates (behavioral + review + precommit):
- `src/utils.ts` (R01: Remove dead code) — PRESERVED + `/codex-review-fast` ✅ + `/precommit-fast` ✅
- `docs/guide.md` (R08: Remove AI artifacts) — /codex-review-doc ✅

Suggested: `/smart-commit --execute` (user-initiated, no auto-commit)
```

## Summary Line

```markdown
Refactoring complete: N applied, N skipped, N blocked out of N targets.
```
