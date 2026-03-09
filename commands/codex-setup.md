---
description: "Initialize Codex CLI infrastructure (AGENTS.md + hooks). Setup sd0x-dev-flow for non-Claude agents."
argument-hint: [init|doctor|sync]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node:*), Bash(git:*), Bash(ls:*), Bash(mkdir:*), Bash(cp:*), Bash(chmod:*), Bash(bash:*), Bash(cat:*), Bash(wc:*)
---

⚠️ **Must read and follow the skill below before executing this command:**

@skills/codex-setup/SKILL.md

## Context

- Repo root: !`git rev-parse --show-toplevel`
- Existing AGENTS.md: !`bash -c 'test -f AGENTS.md && echo "exists ($(wc -c < AGENTS.md) bytes)" || echo "(none)"'`
- Existing state file: !`bash -c 'test -f .sd0x-codex-state.json && echo "exists" || echo "(none)"'`
- Hook mode: !`bash -c 'if [ -d .husky ]; then echo husky; elif git config core.hooksPath 2>/dev/null; then echo hooksPath; elif [ -d .git/hooks ]; then echo git-hooks; else echo fallback; fi'`

## Task

Run the codex-setup skill with the specified subcommand (default: `init`).

### Subcommands

| Command | Purpose |
|---------|---------|
| `init` | Generate AGENTS.md kernel + install git hooks + copy runner scripts |
| `doctor` | Verify installation integrity (files + hashes) |
| `sync` | Re-generate and update after skill update |
