# Implement a New Feature Safely

## Use this when

You have a clear feature to build and want the full development workflow with enforced quality gates — from code to review to precommit.

## Core skills

| Skill | Role |
|-------|------|
| `/feature-dev` | Orchestrate the full development cycle |
| `/verify` | Run lint + typecheck + unit + integration tests |
| `/codex-test-review` | Review test adequacy (mandatory) |
| `/codex-review-fast` | Dual code review (Codex + secondary) |
| `/precommit` | Final quality gate: lint + build + test |
| `/update-docs` | Sync docs with code changes |

## Command flow

1. `/feature-dev` — starts the orchestrated workflow (or work manually step by step)
2. Write code + tests for the feature
3. `/verify` — run all tests, fix failures
4. `/codex-test-review` — **mandatory** test adequacy review; close gaps if needed with `/codex-test-gen` or `/post-dev-test`
5. `/codex-review-fast` — dual code review (auto-loop: fix issues → re-review → pass)
6. If code changed from review fixes: re-run `/verify` → `/codex-test-review --continue` (freshness rule)
7. `/precommit` — final gate after review passes
8. `/update-docs` — sync tech spec and request docs (`/create-request --update` + `/codex-review-doc` if docs changed)
9. `/smart-commit --execute` — commit when ready
10. `/push-ci` — push and monitor CI

## Decision points

| Situation | Choice |
|-----------|--------|
| Test review finds gaps? | `/codex-test-gen` for unit tests, `/post-dev-test` for integration |
| Code review finds P0/P1? | Fix immediately → auto-loop re-reviews |
| Need architecture advice first? | Start with `/codex-architect` before coding |
| Feature needs a tech spec? | See [Turn a request into a tech spec](request-to-spec.md) first |

## Gates

| Gate | Enforced by | Sentinel |
|------|------------|----------|
| Code review | Hook + behavior | `✅ Ready` / `⛔ Blocked` |
| Precommit | Hook | `✅ PASS` / `❌ FAIL` |
| Doc review (auto-triggered via doc-sync) | Behavior | `✅ Mergeable` / `⛔ Needs revision` |

## Expected outcome

- Feature implemented with tests
- Code review passed (dual reviewer)
- Precommit passed (lint + build + test)
- Documentation synced
- Ready to commit and push

## Related scenarios

- [First day in a repo](first-day.md) — if you need to understand the project first
- [Close testing gaps](close-test-gaps.md) — if test coverage is insufficient
- [Finish and ship a change](ship-change.md) — the commit → push → PR flow
