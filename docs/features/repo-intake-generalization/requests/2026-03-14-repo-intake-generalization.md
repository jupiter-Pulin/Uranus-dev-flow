# repo-intake Generalization — MidwayJS 耦合移除

> **Created**: 2026-03-14
> **Status**: Completed
> **Priority**: P1

## Background

`repo-intake` skill 的掃描腳本硬編碼 MidwayJS 框架邏輯（isMidwayProject、MidwayJS 固定權重、@midwayjs/mock 偵測等）。sd0x-dev-flow 是通用 Claude Code plugin，不綁定特定框架。需重寫為 framework-agnostic config-driven scanner。

## Requirements

1. Framework-agnostic：掃描任意語言/框架專案都能產出有意義的報告
2. Config-driven：Entry patterns、topology rules 外部化為 JSON config
3. Pattern alignment：與 `project-audit` 等 skill 共用 `file-classification.json`
4. Backward compatible：Legacy cache 遷移不會無提示失效
5. Test coverage：補齊 contract tests

## Related Files

| File | Role |
|------|------|
| `skills/repo-intake/scripts/scan_repo.js` | 通用 full scanner |
| `skills/repo-intake/scripts/scan_delta.js` | 通用 delta scanner |
| `skills/repo-intake/scripts/intake_cached.js` | Cache layer + orchestrator |
| `scripts/config/repo-intake.json` | Entry patterns + topology config |
| `scripts/config/file-classification.json` | Shared file classification |
| `test/scripts/repo-intake.test.js` | Contract tests |

## Acceptance Criteria

| # | Criteria | Status |
|---|---------|--------|
| AC1 | scan_repo.js 無 MidwayJS 引用 | ✅ Verified |
| AC2 | Entry scoring 從 repo-intake.json 讀取 | ✅ Verified |
| AC3 | detectEcosystems() 回傳 string[] | ✅ Verified |
| AC4 | Legacy cache path 遷移正確 | ✅ Verified |
| AC5 | Tests 覆蓋 P0 cases | ✅ Verified |
| AC6 | MIDWAY_HEURISTICS.md 歸檔 | ✅ Verified（archived reference retained in SKILL.md）|

## Progress

| Task | Status | Notes |
|------|--------|-------|
| T1: repo-intake.json config | ✅ Complete | 46 lines |
| T2: scan_repo.js | ✅ Complete | 655 lines, config-driven |
| T3: scan_delta.js | ✅ Complete | 235 lines |
| T4: intake_cached.js update | ✅ Complete | v2.0.0, legacy migration |
| T5: repo-intake.test.js | ✅ Complete | Contract tests |
| T6: SKILL.md update | ✅ Complete | No active Midway runtime logic; archived reference retained |
| T7: commands/repo-intake.md | ✅ Complete | Cache path fixed |
| T8: Archive MIDWAY_HEURISTICS | ✅ Complete | references/archived/ |
| T9: Delete scan_midway_*.js | ✅ Complete | Files removed |

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| 方案 B+（簡化重寫） | MidwayJS 邏輯佔比 >40%，重構不如重寫 |
| 手寫 pattern matcher | 零依賴，只需 `{a,b}` 和 `*` |
| Legacy cache 不複製 | v1 payload 格式不同（isMidway），觸發 rescan 產生 v2 |
