# Phase C: Clean Distribution — Skills-Only npm Package

> **Created**: 2026-04-01
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [Commands-to-Skills Migration Tech Spec](../2-tech-spec.md)
> **Depends On**: [Phase B: Commands Removal](./2026-04-01-phase-b-commands-removal.md)

## Background

Phase B 已刪除 `commands/` 目錄。Phase C 從 `package.json files` array 移除 `commands/`，執行 major version bump（v3.0），並提供 downstream user 遷移指引。

## Requirements

- 從 `package.json files` array 移除 `commands/`
- Major version bump（v3.0）+ CHANGELOG
- 撰寫 downstream user migration guide

## Scope

| Scope | Description |
|-------|-------------|
| In | C1-C3 tasks: config + version bump + migration guide |
| Out | 實際 skill 功能開發（已在 Phase A 完成） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | 從 `files` array 移除 `commands/` |
| `.claude-plugin/plugin.json` | Modify | Version bump to 3.0.0 |
| `CHANGELOG.md` | Modify | v3.0 release notes |

## Acceptance Criteria

- [ ] `package.json files` 不含 `commands/`
- [ ] Version bumped to 3.0.0（package.json + plugin.json）
- [ ] CHANGELOG 包含 breaking change 說明和遷移指引
- [ ] `npm pack` 輸出不含 `commands/` 檔案
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | Config changes |
| Testing | - | npm pack verification |
| Acceptance | - | Release |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md) § 3.4
- Phase B: [phase-b-commands-removal.md](./2026-04-01-phase-b-commands-removal.md)
