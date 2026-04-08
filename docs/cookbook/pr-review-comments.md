# Resolve PR Review Comments

## Use this when

Your PR has review comments and you need to triage them, decide which to fix, and update the PR without thrashing.

## Core skills

| Skill | Role |
|-------|------|
| `/load-pr-review` | Load PR comments into session — analyze and triage (includes verdict triage) |
| `/seek-verdict` | Re-run independent verification on disputed findings |
| `/codex-review-fast` | Re-review after fixes |
| `/precommit` | Final quality gate |
| `/pr-comment` | Post reply comments to the PR |
| `/push-ci` | Push fixes and monitor CI |

## Command flow

1. `/load-pr-review <pr-url>` — loads all review comments in `plan` mode (default); includes mandatory per-thread verdict triage via `/seek-verdict`
2. Review the triage: each comment gets a verdict-backed action (fix / dismiss / discuss)
3. If you want to override a verdict: `/seek-verdict <finding>` — re-run independent verification
4. `/load-pr-review <pr-url> --mode fix` — switch to fix mode to start addressing comments
5. `/codex-review-fast` — re-review your fixes (auto-loop)
6. `/precommit` — run quality gates
7. `/pr-comment` — post responses to each review comment (preview before submitting)
8. `/push-ci` — push fixes and watch CI

## Decision points

| Situation | Choice |
|-----------|--------|
| Reviewer's finding seems like false positive? | `/seek-verdict` for independent verification |
| Architectural concern raised? | Discuss with reviewer before changing; may need `/codex-architect` |
| Many nit-level comments? | Batch fix all nits in one pass |
| Comment needs code sample in reply? | `/pr-comment` supports inline code suggestions |

## Gates

| Gate | Enforced by | Sentinel |
|------|------------|----------|
| Code review (re-review) | Hook + behavior | `✅ Ready` / `⛔ Blocked` |
| Precommit | Hook | `✅ PASS` / `❌ FAIL` |
| CI after push | GitHub Actions | Pass / Fail |

## Expected outcome

- All review comments addressed (fixed or responded to with reasoning)
- Code re-reviewed and precommit passed
- PR comments posted with friendly, constructive responses
- CI green after push

## Related scenarios

- [Implement a new feature](new-feature.md) — the workflow that created the PR
- [Finish and ship a change](ship-change.md) — merge after review approval
