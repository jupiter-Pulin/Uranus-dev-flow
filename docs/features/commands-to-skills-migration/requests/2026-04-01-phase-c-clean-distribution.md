# Phase C: Clean Distribution — Skills-Only npm Package

> **Created**: 2026-04-01
> **Status**: In Progress
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

- [x] `package.json files` 不含 `commands/`
- [x] Version bumped to 3.0.0（package.json + plugin.json）
- [x] CHANGELOG 包含 breaking change 說明和遷移指引
- [x] `npm pack` 輸出不含 `commands/` 檔案
- [x] Pass `/codex-review-fast`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Phase B complete (commit `086743b`), scope confirmed per tech spec §3.4 |
| Development | Done | `package.json` files array cleaned + version 3.0.0, `plugin.json` 3.0.0, `CHANGELOG.md` created (pending commit) |
| Testing | Done | `npm pack --dry-run` verified 0 commands/ entries; `npm test` 1194/0 fail; `/precommit-fast` ✅ All Pass (session verification, pre-commit) |
| Acceptance | In Progress | 6/6 AC checked; CHANGELOG.md passed `/codex-review-doc` ✅ Mergeable; awaiting commit |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md) § 3.4
- Phase B: [phase-b-commands-removal.md](./2026-04-01-phase-b-commands-removal.md)
