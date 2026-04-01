# sd0x-dev-flow

![sd0x-dev-flow banner](https://raw.githubusercontent.com/sd0xdev/sd0x-dev-flow/main/banner.jpg)

**Language**: English | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

> AI can ship fast. But without guardrails, velocity is terrifying.

**Quality gates that AI can't skip.** A [Claude Code](https://claude.com/claude-code) plugin with hook-enforced dual review, auto-fix loops, and fail-closed semantics — so your code ships fast *and* ships right.

76 commands · 60 skills · 15 agents — ~4% of Claude's context window

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![npm](https://img.shields.io/badge/npx-skills%20add-blue)](https://www.npmjs.com/package/skills)

## Why sd0x-dev-flow?

| Without guardrails | With sd0x-dev-flow |
|---|---|
| AI skips review when context is long | **Hook-enforced**: stop-guard blocks incomplete reviews |
| Single reviewer misses issues | **Dual dispatch**: Codex + secondary in parallel |
| "Fixed it" without re-verification | **Auto-loop**: fix → re-review → pass → continue |
| Review state lost after compact | **State tracking**: SessionStart hook re-injects |

## Quick Start

```bash
# Install plugin
/plugin marketplace add sd0xdev/sd0x-dev-flow
/plugin install sd0x-dev-flow@sd0xdev-marketplace

# Configure your project
/project-setup
```

One command auto-detects framework, package manager, database, entrypoints, and scripts. Installs 12 rules + 5 hooks.

Use `--lite` to only configure CLAUDE.md (skip rules/hooks).

## How It Works

```mermaid
flowchart LR
    P["🎯 Plan"] --> B["🔨 Build"]
    B --> G["🛡️ Gate"]
    G --> S["🚀 Ship"]

    P -.- P1["/codex-brainstorm<br/>/feasibility-study<br/>/tech-spec"]
    B -.- B1["/feature-dev<br/>/bug-fix<br/>/codex-implement"]
    G -.- G1["/codex-review-fast<br/>/precommit<br/>/codex-test-review"]
    S -.- S1["/smart-commit<br/>/push-ci<br/>/create-pr<br/>/pr-review"]
```

The **auto-loop engine** enforces quality gates automatically — after code edits, the review command dispatches **dual review** (Codex MCP + secondary reviewer in parallel) in the same reply. Findings are deduplicated, severity-normalized, and aggregated into a single gate. In strict mode, hooks enforce fail-closed semantics: if the aggregate gate is incomplete, stop-guard blocks. See [docs/hooks.md](docs/hooks.md) for mode and dependency details.

<details>
<summary>Detailed: Dual-Review Sequence Diagram</summary>

```mermaid
sequenceDiagram
    participant D as Developer
    participant C as Claude
    participant X as Codex MCP
    participant T as Secondary Reviewer
    participant H as Hooks

    D->>C: Edit code
    H->>H: Track file change
    C->>H: emit-review-gate PENDING
    par Dual Review
        C->>X: Codex review (sandbox)
    and
        C->>T: Task(code-reviewer)
    end
    X-->>C: Findings (primary)
    T-->>C: Findings (secondary)
    C->>C: Aggregate + dedup + gate
    C->>H: emit-review-gate READY/BLOCKED

    alt Issues found
        C->>C: Fix all issues
        C->>X: --continue threadId
        X-->>C: Re-verify
    end

    C->>C: /precommit (auto)
    C-->>D: ✅ All gates passed

    Note over H: Strict mode: incomplete gate → blocked
```

</details>

## Feature Spotlight: Dual-Reviewer Architecture

v2.0 dispatches two independent reviewers in parallel — dual-review by default with degraded fallback modes:

| Reviewer | Role | Fallback |
|----------|------|----------|
| Codex MCP | Primary (sandbox, full diff) | Single-reviewer mode if unavailable |
| Secondary (pr-review-toolkit) | Confidence-scored review | strict-reviewer → single mode |

Findings are **severity-normalized** (P0-Nit), **deduplicated** (file + issue key, ±5 line tolerance), and **source-attributed** (`codex` | `toolkit` | `both`).

Gate: `✅ Ready` or `⛔ Blocked` — in strict mode, incomplete gate = blocked.

## How We Compare

| Capability | sd0x-dev-flow | gstack | Generic prompts |
|---|---|---|---|
| Enforced review gates | Hook + behavior layer | Suggestion only | None |
| Dual-reviewer | Codex + secondary (parallel) | Single /review | None |
| Auto-fix loop | Fix → re-review → pass | Manual | None |
| Multi-agent research | /deep-research (3 agents) | None | None |
| Adversarial validation | Nash equilibrium debate | None | None |
| Self-improvement | Lesson log + rule promotion | /retro stats only | None |
| Cross-tool support | Codex/Cursor/Windsurf | Claude/Codex/Gemini/Cursor | N/A |

## When to Use

| Good Fit | Not Ideal |
|----------|-----------|
| Solo or small-team projects with Claude Code | Teams not using Claude Code |
| Projects needing automated review gates | One-off scripts with no CI |
| Codex CLI / Cursor / Windsurf users (skills subset) | Projects requiring custom LLM providers |
| Repos where quality gates prevent regressions | Repos with no test infrastructure |

## Install

### Codex CLI / Other AI Agents

```bash
# Install individual skills via Agent Skills standard
npx skills add sd0xdev/sd0x-dev-flow

# Generate AGENTS.md + install hooks (in Claude Code)
/codex-setup init
```

| Method | Tools | Coverage |
|--------|-------|----------|
| Plugin install | Claude Code | Full (76 commands, hooks, rules, auto-loop) |
| `npx skills add` | Codex CLI, Cursor, Windsurf, Aider | Skills only (60 skills) |
| `/codex-setup init` | Codex CLI | AGENTS.md kernel + git hooks |

**Requirements**: Claude Code 2.1+ | [Codex MCP](https://github.com/openai/codex) (optional — `/codex-*` commands require it; without it, review falls back to single-reviewer mode)

## Workflow Tracks

| Workflow | Commands | Gate | Enforced By |
|----------|----------|------|-------------|
| Feature | `/feature-dev` → `/verify` → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook + Behavior |
| Bug Fix | `/issue-analyze` → `/bug-fix` → `/verify` → `/precommit` | ✅/⛔ | Hook + Behavior |
| Auto-Loop | Code edit → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook |
| Doc Review | `.md` edit → `/codex-review-doc` | ✅/⛔ | Hook |
| Planning | `/codex-brainstorm` → `/feasibility-study` → `/tech-spec` | — | — |
| Onboarding | `/project-setup` → `/repo-intake` | — | — |

<details>
<summary>Visual: Workflow Flowcharts</summary>

```mermaid
flowchart TD
    subgraph feat ["🔨 Feature Development"]
        F1["/feature-dev"] --> F2["Code + Tests"]
        F2 --> F3["/verify"]
        F3 --> F4["/codex-review-fast"]
        F4 --> F5["/precommit"]
        F5 --> F6["/update-docs"]
    end

    subgraph fix ["🐛 Bug Fix"]
        B1["/issue-analyze"] --> B2["/bug-fix"]
        B2 --> B3["Fix + Regression test"]
        B3 --> B4["/verify"]
        B4 --> B5["/codex-review-fast"]
        B5 --> B6["/precommit"]
    end

    subgraph docs ["📝 Docs Only"]
        D1["Edit .md"] --> D2["/codex-review-doc"]
        D2 --> D3["Done"]
    end

    subgraph plan ["🎯 Planning"]
        P1["/codex-brainstorm"] --> P2["/feasibility-study"]
        P2 --> P3["/tech-spec"]
        P3 --> P4["/codex-architect"]
        P4 --> P5["Implementation ready"]
    end

    subgraph ops ["⚙️ Operations"]
        O1["/project-setup"] --> O2["/repo-intake"]
        O2 --> O3["Develop"]
        O3 --> O4["/project-audit"]
        O3 --> O7["/best-practices"]
        O3 --> O5["/risk-assess"]
        O4 --> O6["/next-step --go"]
        O5 --> O6
        O7 --> O6
    end
```

</details>

## What's Included

| Category | Count | Examples |
|----------|-------|---------|
| Commands | 76 | `/project-setup`, `/codex-review-fast`, `/verify`, `/smart-commit`, `/deep-research` |
| Skills | 60 | project-setup, code-explore, smart-commit, contract-decode, deep-research, sharingan |
| Agents | 15 | strict-reviewer, verify-app, coverage-analyst, architecture-designer |
| Hooks | 8 | pre-edit-guard, auto-format, review state tracking, stop guard, namespace hint, post-compact-auto-loop, post-skill-auto-loop, user-prompt-review-guard |
| Rules | 14 | auto-loop, auto-loop-project, codex-invocation, security, testing, git-workflow, self-improvement, context-management |
| Scripts | 12 | precommit runner, verify runner, dep audit, namespace hint, skill runner, commit-msg guard, pre-push gate, utils (shared lib), emit-review-gate, build-codex-artifacts, resolve-feature, feature-resolver |

### Minimal Context Footprint

~4% of Claude's 200k context window — 96% remains for your code.

| Component | Tokens | % of 200k |
|-----------|--------|-----------|
| Rules (always loaded) | 5.1k | 2.6% |
| Skills (on-demand) | 1.9k | 1.0% |
| Agents | 791 | 0.4% |
| **Total** | **~8k** | **~4%** |

Skills load on-demand. Idle skills cost zero tokens.

## Commands Reference

| Command | Description |
|---------|-------------|
| `/project-setup` | Auto-detect and configure project |
| `/feature-dev` | Feature development workflow |
| `/bug-fix` | Bug/Issue fix workflow |
| `/codex-review-fast` | Quick review (diff only) |
| `/codex-review-doc` | Document review |
| `/precommit` | lint:fix → build → test |
| `/precommit-fast` | lint:fix → test (no build) |
| `/verify` | Full verification chain |
| `/smart-commit` | Smart batch commit |
| `/push-ci` | Push + CI monitor |
| `/create-pr` | Create GitHub PR |
| `/codex-brainstorm` | Adversarial brainstorm (Nash equilibrium) |
| `/tech-spec` | Generate tech spec |
| `/pr-review` | PR self-review |
| `/codex-security` | OWASP Top 10 audit |

<details>
<summary>All 76 commands</summary>

### Development

| Command | Description |
|---------|-------------|
| `/project-setup` | Auto-detect and configure project |
| `/repo-intake` | One-time project intake scan |
| `/install-rules` | Install plugin rules to `.claude/rules/` |
| `/install-hooks` | Install plugin hooks to `.claude/` |
| `/install-scripts` | Install plugin runner scripts |
| `/codex-setup` | Initialize Codex CLI infrastructure (AGENTS.md + hooks) |
| `/bug-fix` | Bug/Issue fix workflow |
| `/codex-implement` | Codex writes code |
| `/codex-architect` | Architecture advice (third brain) |
| `/code-explore` | Fast codebase exploration |
| `/git-investigate` | Track code history |
| `/issue-analyze` | Deep issue analysis |
| `/post-dev-test` | Post-dev test completion |
| `/feature-dev` | Feature development workflow (design → implement → verify → review) |
| `/feature-verify` | System diagnosis (read-only verification with dual-perspective) |
| `/load-pr-review` | Load GitHub PR review comments into session |
| `/pr-comment` | Post friendly review comments to a GitHub PR |
| `/code-investigate` | Dual-perspective code investigation (Claude + Codex independent) |
| `/next-step` | Context-aware next step advisor |
| `/smart-commit` | Smart batch commit (group + message + commands) |
| `/git-profile` | Git identity and GPG signing profile manager |
| `/push-ci` | Push (with approval) + CI monitor |
| `/create-pr` | Create GitHub PR from branch |
| `/merge-prep` | Pre-merge analysis and preparation |
| `/smart-rebase` | Smart partial rebase for squash-merge repos |
| `/deep-explore` | Multi-wave parallel code exploration |
| `/remind` | Lightweight model correction with rule loading |
| `/bump-version` | Bump package + plugin version in sync |
| `/watch-ci` | Monitor GitHub Actions CI runs |
| `/jira` | Jira integration (view/branch/transition) |

### Review (Codex MCP)

| Command | Description | Loop Support |
|---------|-------------|--------------|
| `/codex-review-fast` | Quick review (diff only) | `--continue <threadId>` |
| `/codex-review` | Full review (lint + build) | `--continue <threadId>` |
| `/codex-review-branch` | Full branch review | - |
| `/codex-cli-review` | CLI review (full disk read) | - |
| `/codex-review-doc` | Document review | `--continue <threadId>` |
| `/codex-security` | OWASP Top 10 audit | `--continue <threadId>` |
| `/codex-test-gen` | Generate unit tests | - |
| `/codex-test-review` | Review test coverage | `--continue <threadId>` |
| `/codex-explain` | Explain complex code | - |
| `/seek-verdict` | Independent finding verification (dismiss/confirm/clarify) | - |

### Verification

| Command | Description |
|---------|-------------|
| `/verify` | lint -> typecheck -> unit -> integration -> e2e |
| `/precommit` | lint:fix -> build -> test:unit |
| `/precommit-fast` | lint:fix -> test:unit |
| `/dep-audit` | Dependency security audit |
| `/project-audit` | Project health audit (deterministic scoring) |
| `/best-practices` | Industry best practices audit with adversarial debate |
| `/risk-assess` | Uncommitted code risk assessment |
| `/pre-pr-audit` | Pre-PR confidence audit (5-dimension scoring) |
| `/test-deep` | Context-aware test orchestration |

### Planning

| Command | Description |
|---------|-------------|
| `/codex-brainstorm` | Adversarial brainstorm (Nash equilibrium) |
| `/feasibility-study` | Feasibility analysis |
| `/tech-spec` | Generate tech spec |
| `/review-spec` | Review tech spec |
| `/deep-analyze` | Deep analysis + roadmap |
| `/architecture` | Architecture design + 3-architecture.md |
| `/project-brief` | PM/CTO executive summary |
| `/deep-research` | Multi-agent deep research orchestration |
| `/fp-brief` | First-principles briefing from technical documents |

### Documentation & Tooling

| Command | Description |
|---------|-------------|
| `/update-docs` | Sync docs with code |
| `/check-coverage` | Test coverage analysis |
| `/create-request` | Create/update request docs |
| `/doc-refactor` | Simplify documents |
| `/simplify` | Code simplification |
| `/de-ai-flavor` | Remove AI-generated artifacts from documents |
| `/generate-runner` | Generate customized precommit runner for any ecosystem |
| `/safe-remove` | Safely remove plugin assets |

| `/pr-review` | PR self-review |
| `/pr-summary` | PR status summary (grouped by ticket) |
| `/contract-decode` | EVM contract error/calldata decoder |
| `/skill-health-check` | Validate skill quality and routing |
| `/sharingan` | Analyze external repos and generate equivalent skills |
| `/statusline-config` | Customize statusline segments and themes |
| `/claude-health` | Claude Code config health check |
| `/op-session` | Initialize 1Password CLI session (avoids repeated biometric prompts) |
| `/obsidian-cli` | Obsidian vault integration via official CLI |
| `/zh-tw` | Rewrite in Traditional Chinese |

</details>

## Rules & Hooks

14 rules (always-loaded conventions) + 8 hooks (automated guardrails).

> **Customization**: Edit `auto-loop-project.md` to override auto-loop behavior per project. Plugin updates won't conflict — see [Rule Override Pattern](docs/features/rule-override-pattern/2-tech-spec.md).

For full rules, hooks, and environment variable reference, see [docs/rules.md](docs/rules.md) and [docs/hooks.md](docs/hooks.md).

## Customization

Run `/project-setup` to auto-detect and configure all placeholders, or manually edit `.claude/CLAUDE.md`:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{PROJECT_NAME}` | Your project name | my-app |
| `{FRAMEWORK}` | Your framework | MidwayJS 3.x, NestJS, Express |
| `{CONFIG_FILE}` | Main config file | src/configuration.ts |
| `{BOOTSTRAP_FILE}` | Bootstrap entry | bootstrap.js, main.ts |
| `{DATABASE}` | Database | MongoDB, PostgreSQL |
| `{TEST_COMMAND}` | Test command | yarn test:unit |
| `{LINT_FIX_COMMAND}` | Lint auto-fix | yarn lint:fix |
| `{BUILD_COMMAND}` | Build command | yarn build |
| `{TYPECHECK_COMMAND}` | Type checking | yarn typecheck |

## Showcase: Multi-Agent Research

Run `/deep-research` to orchestrate 2-3 parallel researcher agents across web sources, codebase, and community knowledge — with claim registry synthesis and conditional adversarial debate.

| Feature | Details |
|---------|---------|
| Agents | 2-3 parallel (web + code + community) |
| Synthesis | Claim registry with consensus detection |
| Validation | Conditional /codex-brainstorm debate |
| Scoring | 4-signal completeness model |

[Full documentation](docs/features/deep-research/)

## Architecture

```
Command (entry) → Skill (capability) → Agent (environment)
```

- **Commands**: User-triggered via `/...`
- **Skills**: Knowledge bases loaded on demand
- **Agents**: Isolated subagents with specific tools
- **Hooks**: Automated guardrails (format, review state, stop guard)
- **Rules**: Always-on conventions (auto-loaded)

For advanced architecture details (agentic control stack, control loop theory, sandbox rules), see [docs/architecture.md](docs/architecture.md).

## Contributing

PRs welcome. Please:

1. Follow existing naming conventions (kebab-case)
2. Include `When to Use` / `When NOT to Use` in skills
3. Add `disable-model-invocation: true` for dangerous operations
4. Test with Claude Code before submitting

## License

MIT

## Star History

<a href="https://www.star-history.com/?repos=sd0xdev%2Fsd0x-dev-flow&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
 </picture>
</a>
