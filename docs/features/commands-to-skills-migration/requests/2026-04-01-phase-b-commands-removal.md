# Phase B: Commands Removal — 刪除 commands/ 目錄

> **Created**: 2026-04-01
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [Commands-to-Skills Migration Tech Spec](../2-tech-spec.md)
> **Depends On**: [Phase A: Skill Parity](./2026-04-01-phase-a-skill-parity.md)

## Background

Phase A 達成 N/N name parity 後，所有 command 名稱都有對應的 skill entry point。Claude Code 的 skill-first resolution 已事實上接管所有功能。Phase B 刪除 `commands/` 目錄，消除雙軌維護稅。

## Requirements

- 完成 repo-wide dependency sweep（runtime scripts、tests、docs 中的 `commands/` 路徑引用）
- 遷移 `test/commands/` 測試至 `test/skills/`
- 刪除 `commands/` 目錄（78 files）
- 更新 `package.json` test scripts
- 更新所有文件（CLAUDE.md、README）

## Scope

| Scope | Description |
|-------|-------------|
| In | B1-B5 tasks: dependency sweep + test migration + commands deletion + config + docs |
| Out | `package.json files` array 移除（Phase C）、major version bump（Phase C） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `commands/*.md` | Delete | 刪除全部 78 個 command 檔案 |
| `test/commands/*.test.js` | Migrate | 28 個測試遷移至 `test/skills/` |
| `scripts/lib/feature-resolver.js` | Modify | 移除 `commands/` 路徑解析 |
| `skills/next-step/scripts/analyze.js` | Modify | 改為 `skills/` 目錄掃描 |
| `skills/skill-health-check/scripts/skill-lint.js` | Modify | 移除 command 交叉驗證邏輯 |
| `package.json` | Modify | 更新 test scripts |
| `CLAUDE.md` | Modify | 移除 commands 相關說明 |
| `.claude/CLAUDE.md` | Modify | 同上 |

## Acceptance Criteria

- [ ] Dependency sweep checklist 全部完成（tech spec 3.3.1 表格）
- [ ] `test/commands/` 全部遷移至 `test/skills/`，測試邏輯保留
- [ ] `commands/` 目錄已刪除
- [ ] `npm test` 全部 pass
- [ ] `grep -r "commands/" skills/ scripts/ test/ rules/ CLAUDE*.md README*` 無殘留路徑引用
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | Dependency sweep |
| Development | - | Test migration + deletion |
| Testing | - | Regression verification |
| Acceptance | - | Zero residual refs |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md) § 3.3
- Phase A: [phase-a-skill-parity.md](./2026-04-01-phase-a-skill-parity.md)
