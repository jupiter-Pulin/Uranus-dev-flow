# Fix a Bug from Issue or Report

## Use this when

A user report, GitHub issue, or failing test points to a bug, and you need to investigate, fix, and verify with a regression test.

## Core skills

| Skill | Role |
|-------|------|
| `/issue-analyze` | Deep analysis of the issue with Codex blind verdict |
| `/bug-fix` | Guided bug fix workflow |
| `/debug` | Interactive hypothesis-driven debugging |
| `/verify` | Run tests after fix |
| `/codex-test-review` | Mandatory test adequacy review (regression test must pass) |
| `/codex-review-fast` | Code review (auto-loop) |
| `/precommit` | Final quality gate |

## Command flow

1. `/issue-analyze <issue-url>` — analyze the issue, classify the problem, plan investigation
2. `/bug-fix` — start the guided fix workflow, or investigate manually
3. If root cause is unclear: `/debug` — hypothesis → probe → narrow down
4. Implement the fix + write a regression test
5. `/verify` — ensure the fix works and nothing else broke
6. `/codex-test-review` — **mandatory** test adequacy review (regression test must be adequate)
7. `/codex-review-fast` — code review (auto-loop until pass)
8. `/precommit` — final gate

## Decision points

| Situation | Choice |
|-----------|--------|
| Issue is a GitHub issue? | `/issue-analyze <url>` for structured analysis |
| Root cause unclear? | `/debug` with hypothesis-driven probes |
| Need to trace code history? | `/git-investigate` to find when the bug was introduced |
| Fix touches multiple modules? | `/code-investigate` for dual-perspective analysis |

## Gates

| Gate | Enforced by | Sentinel |
|------|------------|----------|
| Code review | Hook + behavior | `✅ Ready` / `⛔ Blocked` |
| Precommit | Hook | `✅ PASS` / `❌ FAIL` |

## Expected outcome

- Root cause identified and documented
- Bug fixed with regression test preventing recurrence
- Code review and precommit passed
- Ready to commit

## Related scenarios

- [Resolve PR review comments](pr-review-comments.md) — if the fix gets review feedback
- [Close testing gaps](close-test-gaps.md) — if the bug reveals broader test gaps
