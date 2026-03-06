---
description: Git identity and GPG signing profile manager
argument-hint: "[doctor|list|use <profile>|remove <profile>|verify]"
allowed-tools: Bash(bash:*), Bash(git:*), Read, Grep, Glob, AskUserQuestion
---

**Must read and follow the skill below before executing this command:**

@skills/git-profile/SKILL.md

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD`
- Identity: !`git config --show-origin --show-scope --get user.name 2>/dev/null && git config --show-origin --show-scope --get user.email 2>/dev/null`
- Signing: !`git config --get commit.gpgsign 2>/dev/null || echo "unset"`
- Signing key: !`git config --get user.signingkey 2>/dev/null || echo "unset"`
- Registry: !`bash -c 'test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sd0x-dev-flow/git-profiles.json" && echo "exists" || echo "missing"' 2>/dev/null`

## Task

Follow the `git-profile` skill workflow:

1. **Parse subcommand**: Default to `doctor` if no argument given
2. **Route to workflow**: Execute the matching subcommand workflow from SKILL.md
3. **Render output**: Format script JSON output as human-readable tables
4. **Gate writes**: All config writes must pass through AskUserQuestion

Arguments:
- `doctor` (default): Run identity + signing diagnostics
- `list`: Show all registered profiles
- `use <profile>`: Switch current repo to named profile
- `remove <profile>`: Remove profile from registry
- `verify`: Deep verification of identity setup
