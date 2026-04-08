# First Day in an Existing Repo

## Use this when

You just cloned a repo and need to understand the project structure, configure your environment, and figure out what to work on first.

## Core skills

| Skill | Role |
|-------|------|
| `/project-setup` | Auto-detect framework, package manager, and configure CLAUDE.md |
| `/repo-intake` | One-time scan of project structure, conventions, and tech stack |
| `/next-step` | Context-aware suggestion for what to do next |
| `/code-explore` | Explore unfamiliar areas of the codebase |

## Command flow

1. `/project-setup` — auto-detects framework, database, test commands, and configures `.claude/CLAUDE.md` with correct placeholders
2. `/repo-intake` — scans the full project: entrypoints, directory layout, key modules, dependencies, test infrastructure
3. Browse the output — understand the project's architecture and conventions
4. `/code-explore <area>` — deep-dive into specific modules you'll be working on
5. `/next-step` — get a suggestion for your first task based on current state (open issues, pending PRs, dirty worktree)

## Decision points

| Situation | Choice |
|-----------|--------|
| Project uses Codex CLI too? | Run `/codex-setup init` to generate AGENTS.md |
| Want to understand a complex module? | Use `/codex-explain <file>` for detailed walkthrough |
| Repo has many open issues? | Use `/issue-analyze <issue-url>` to triage |

## Gates

None enforced — this is an exploration workflow. No code changes means no review gates.

## Expected outcome

- `.claude/CLAUDE.md` configured with correct project settings
- Mental model of project architecture, key modules, and conventions
- Clear first task identified via `/next-step`

## Related scenarios

- [Implement a new feature](new-feature.md) — after onboarding, start building
- [Turn a rough request into a tech spec](request-to-spec.md) — if your first task needs planning
