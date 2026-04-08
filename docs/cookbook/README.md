# Scenario Cookbook

Real-world scenarios showing which sd0x-dev-flow skills to combine and in what order. Each scenario covers a common development situation with step-by-step command flows, decision points, and quality gates.

## Scenarios

| Scenario | Description | Core Skills | Level |
|----------|-------------|-------------|-------|
| [First day in a repo](first-day.md) | Clone a repo, configure, find first task | `/project-setup` `/repo-intake` `/next-step` | Beginner |
| [Implement a new feature](new-feature.md) | Full dev cycle with enforced quality gates | `/feature-dev` `/verify` `/codex-test-review` `/codex-review-fast` `/precommit` | Intermediate |
| [Fix a bug](fix-bug.md) | Investigate, fix, and verify with regression test | `/issue-analyze` `/bug-fix` `/debug` `/verify` | Intermediate |
| [Resolve PR review comments](pr-review-comments.md) | Triage, fix, and respond to reviewer feedback | `/load-pr-review` `/seek-verdict` `/pr-comment` `/push-ci` | Intermediate |
| [Rough request to tech spec](request-to-spec.md) | Turn a vague idea into an implementable spec | `/req-analyze` `/feasibility-study` `/tech-spec` | Advanced |
| [Close testing gaps](close-test-gaps.md) | Identify and fill coverage gaps across test layers | `/check-coverage` `/codex-test-gen` `/post-dev-test` | Intermediate |
| [Security pre-merge](security-pre-merge.md) | OWASP audit + dependency scan before merge | `/codex-security` `/dep-audit` `/risk-assess` `/pre-pr-audit` | Advanced |
| [Ship a change cleanly](ship-change.md) | Commit, push, CI, and PR — the last mile | `/pr-review` `/smart-commit` `/push-ci` `/create-pr` | Beginner |

### Showcase Combos

Power combinations where skills amplify each other.

| Scenario | Description | Core Skills | Level |
|----------|-------------|-------------|-------|
| [Validate a feature direction](validate-direction.md) | Research + best practices to sharpen direction before coding | `/deep-research` `/best-practices` `/feasibility-study` `/codex-brainstorm` | Advanced |
| [Stress-test a design decision](adversarial-design.md) | Adversarial debate to pressure-test trade-offs | `/codex-brainstorm` `/codex-architect` `/deep-research` | Advanced |

## How to use

1. Find the scenario matching your situation
2. Follow the **Command flow** section step by step
3. Check **Decision points** when you hit a fork
4. Verify **Gates** pass before moving to the next stage

## Contributing

To add a scenario, create a new `.md` file in this directory following the standardized format (Use this when / Core skills / Command flow / Decision points / Gates / Expected outcome / Related scenarios).
