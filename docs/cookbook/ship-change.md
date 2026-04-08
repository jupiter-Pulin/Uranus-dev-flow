# Finish and Ship a Change Cleanly

## Use this when

Your code is reviewed and tested, and you need to commit, push, create a PR, and get it merged — the "last mile" of the development cycle.

## Core skills

| Skill | Role |
|-------|------|
| `/pr-review` | Self-review checklist before committing |
| `/smart-commit` | Group changes into cohesive commits with good messages |
| `/push-ci` | Push with safety gates + CI monitoring (delegates to `/watch-ci`) |
| `/create-pr` | Create GitHub PR with auto-generated summary |

## Command flow

1. `/pr-review` — run through self-review checklist (code quality, test coverage, docs)
2. `/smart-commit --execute` — group uncommitted changes by cohesion, generate messages, commit
3. `/push-ci` — push to remote with safety confirmation, then monitor CI (foreground — waits for verdict)
4. `/create-pr --execute` — create PR with auto-generated title and summary (default is `--dry-run` preview)
5. Share PR URL for review

## Decision points

| Situation | Choice |
|-----------|--------|
| Multiple logical changes mixed? | `/smart-commit` auto-groups by cohesion |
| Want AI co-author attribution? | `/smart-commit --execute --ai-co-author` |
| CI fails after push? | Read failing logs, fix, re-push |
| Need to merge multiple PRs? | `/merge-prep` for pre-merge analysis |
| Pushing to protected branch? | `/push-ci` warns and requires terminal confirmation |

## Gates

| Gate | Enforced by | Sentinel |
|------|------------|----------|
| Pre-push safety | git hook (`pre-push-gate.sh`) | Terminal `/dev/tty` confirmation |
| CI | GitHub Actions | Pass/Fail |

## Expected outcome

- Clean, well-grouped commits with descriptive messages
- Pushed to remote with CI passing
- PR created and ready for team review
- Clean working tree

## Related scenarios

- [Implement a new feature](new-feature.md) — the development flow before shipping
- [Resolve PR review comments](pr-review-comments.md) — if the PR gets feedback
