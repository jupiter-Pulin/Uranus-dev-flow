# Upgrade Doctor — `/claude-health` Sync Module

> **Created**: 2026-03-14
> **Status**: Completed
> **Priority**: P1

## Background

Plugin 版本更新後，host project 的 installed assets（rules, hooks, scripts）不會自動同步。用戶必須手動執行 `/install-rules`、`/install-hooks`、`/install-scripts` 才能取得新版。目前：
- `/claude-health` 只檢查結構衛生（junk files, .gitignore, naming），不檢查版本 drift
- SessionStart hook 只提示 command namespace，不偵測版本不一致
- Manifest (`.sd0x-install-state.json`) 只追蹤 rules，缺少 hooks/scripts

## Requirements

1. 擴展 `/claude-health` 加入 sync module（`--scope hygiene|sync|all`）
2. SessionStart lightweight drift sentinel（version stamp 比對，<50ms）
3. Per-component hash classification（OK / MISSING / OUTDATED / CONFLICT 等 8 種狀態，mapping to install-rules equivalents）
4. Settings semantic migration detection（legacy paths, guard mode），全部委派 `/install-hooks`
5. Tiered fix strategy（report → `--fix-safe` → `--fix`），`--fix-safe` 僅處理 MISSING + OUTDATED（不帶 `--force`）。Category-specific：rules 的 OUTDATED 可 safe auto-fix（有 smart merge）；hooks/scripts 的 OUTDATED 為 report-only（installer 缺 manifest-aware merge）。委派給現有 `/install-*` commands

## Scope

### In Scope (v1)

- Sync module S1 (version check), S2 (component classify), S3 (settings compat)
- SessionStart drift sentinel in `namespace-hint.sh`
- `--fix-safe` (auto-fix safe items) and `--fix` (guided remediation)
- Rules (11), hooks (4), core scripts (6) = 21 managed files

### Out of Scope (v2)

- Skill scripts tracking (18 files)
- `--json` machine-readable output
- CI integration
- Cross-session trend analysis

## Related Files

| File | Role |
|------|------|
| `skills/claude-health/SKILL.md` | Primary modification target |
| `commands/claude-health.md` | Command entry point |
| `scripts/namespace-hint.sh` | SessionStart hook |
| `.claude/.sd0x-install-state.json` | Manifest data source |
| `commands/install-rules.md` | Fix delegation target |
| `commands/install-hooks.md` | Fix delegation target |
| `commands/install-scripts.md` | Fix delegation target |

## Acceptance Criteria

| # | Criteria | Verification |
|---|---------|-------------|
| AC1 | `/claude-health --scope sync` 報告 manifest version vs plugin version mismatch | 手動驗證 with stale manifest |
| AC2 | S2 對 21 個 managed files 各自輸出分類狀態 | 修改一個 rule 後重跑確認 `LOCAL_MODIFIED` |
| AC3 | S3 偵測 legacy hook paths（bare `.claude/hooks/`） | 手動在 settings.json 加入 legacy path 後驗證 |
| AC4 | SessionStart sentinel 在 version mismatch 時輸出 warning | 修改 manifest version 後開新 session |
| AC5 | `--fix-safe` category-specific：rules OUTDATED → auto-fix via `/install-rules <names>`；hooks/scripts OUTDATED → report-only with suggested command；MISSING → auto-fix all categories | 檢查 rules 委派不帶 `--force`；hooks/scripts OUTDATED 只輸出建議指令 |
| AC6 | 不影響現有 hygiene module（C1-C7）行為 | 跑 `--scope hygiene` 確認 7 checks 不變 |

## Design Decisions (from Best Practices Audit)

| Decision | Rationale | Source |
|----------|-----------|--------|
| 擴展 `/claude-health` 而非獨立 `/doctor` | 避免 command surface bloat + 用戶困惑（兩者語義重疊） | Brainstorm R1 consensus |
| Hybrid detection | Manifest alone 不覆蓋 settings 語意遷移；hash-only 無法區分用戶刻意編輯 vs drift | Brainstorm R1 consensus |
| SessionStart < 50ms | 只做 version string 比對，不做 hash 計算 | Industry: brew doctor（手動 full scan）模式 |
| 不需要 per-version changelog | Runtime 計算 diff + classification labels 已足夠表達 intent | Brainstorm R2 consensus |
| Targeted delegation | `--fix-safe` 傳入具體檔案名稱而非 `--all`，不帶 `--force`，避免不必要的 churn | Codex R2 micro-attack 修正 |
| S3 全委派 `/install-hooks` | Sync module 是純診斷層，不直接操作 JSON（避免 sed-like 格式風險）| Codex review 🔴 fix |
| Version resolution from script dir | SessionStart sentinel 從 `dirname "$0"` 推導 plugin root，不 fallback 到 CWD | Codex review 🔴 fix |

## Progress

| Task | Status | Notes |
|------|--------|-------|
| Best practices audit | ✅ Complete | Phase 1-4 done, Nash equilibrium reached |
| Tech spec | ✅ Complete | `docs/features/upgrade-doctor/2-tech-spec.md` |
| Doc review | ✅ Passed | 3 rounds, 7 🔴 resolved (threadId: `019cea47-1965-7303-a52e-87607efc95d1`) |
| Implementation | ⬜ Not started | — |
| Testing | ⬜ Not started | — |

## Traceability

| Artifact | Reference |
|----------|-----------|
| Brainstorm threadId | `019cea31-bf3b-7b83-b77a-5c08cb313659` |
| Doc review threadId | `019cea47-1965-7303-a52e-87607efc95d1` |
| Tech spec | [2-tech-spec.md](../2-tech-spec.md) |
