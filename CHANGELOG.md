# Changelog

## 3.0.0 (2026-04-05)

### Breaking Changes

- **Removed `commands/` from npm distribution**: The `commands/` directory
  is no longer included in the published package. Skills are now the only
  distributed and maintained entry points.
  - If you previously referenced `commands/<name>.md` in custom tooling,
    update to `skills/<name>/SKILL.md`.
  - Locally copied command files in `.claude/commands/` may still function
    but are unsupported and no longer updated.

### Migration Guide

1. **No action needed** for normal `/command-name` usage — Claude Code's
   skill-first resolution (introduced in v2.2) handles routing automatically.
2. **Custom scripts** referencing `commands/*.md` paths must update to
   `skills/*/SKILL.md`.
3. **Test files** have moved from `test/commands/` to `test/skills/`.

### Internal Changes

- Phase A (v2.2.x): Created 23 new skill entry points for N/N parity
- Phase B (v2.2.x): Deleted 79 command files, migrated 29 tests
  (2 removed), updated 25+ runtime/doc files
- Phase C (v3.0.0): Removed `commands/` from `package.json` files array,
  major version bump
