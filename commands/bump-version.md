---
description: Bump package and plugin version in sync
argument-hint: [patch|minor|major|<version>]
allowed-tools: Read, Edit, Grep, Glob
---

**Must read and follow the skill below before executing this command:**

@skills/bump-version/SKILL.md

## Context

- package.json version: !`grep '"version"' package.json | head -1`
- plugin.json version: !`grep '"version"' .claude-plugin/plugin.json | head -1`
- install-state version: !`grep '"plugin_version"' .sd0x/install-state.json | head -1`

## Task

Bump version based on argument:

### Arguments

```
$ARGUMENTS
```

| Argument | Description |
|----------|-------------|
| (none) | Patch bump (default) |
| `patch` | Bump patch: x.y.z → x.y.(z+1) |
| `minor` | Bump minor: x.y.z → x.(y+1).0 |
| `major` | Bump major: x.y.z → (x+1).0.0 |
| `<version>` | Set exact version |
