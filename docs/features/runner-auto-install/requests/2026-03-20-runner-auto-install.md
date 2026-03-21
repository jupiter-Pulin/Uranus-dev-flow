# Runner Auto-Install + Generation

## Status: In Progress

## Background

Plugin 提供通用 precommit-runner.js，但使用者在 `/project-setup` 後不會自動擁有 runner。
`/precommit-fast` 的 fallback path 讓模型有自由度跳過 lint，導致 CI 頻繁失敗。

## Acceptance Criteria

### Phase 1: Auto-Install

- [ ] AC1: `/project-setup` 新增 scripts 安裝 phase（Phase 6.5），自動安裝 `precommit-runner.js` + `verify-runner.js` + `lib/utils.js`
- [ ] AC2: `/precommit-fast` 偵測到 runner 不存在時，自動從 plugin 複製 runner 並執行（僅限 Node.js 專案）
- [ ] AC3: `/precommit`（full mode）同上行為
- [ ] AC4: Auto-install 時輸出明確 log（`> auto-installing missing runner...`）
- [ ] AC5: Auto-install 不使用 `--force`，遇到衝突 skip + warn
- [ ] AC6: 測試覆蓋：project-setup scripts phase + precommit auto-install fallback

### Phase 2: Harden Generic Runner

- [ ] AC7: lint globs 可從 `.claude/runner-config.json` 或 package.json `sd0x` field 讀取，有預設 fallback
- [ ] AC8: 移除 hardcoded Jest recipe block，改為從 package.json scripts 推導
- [ ] AC9: 測試覆蓋：config-driven lint globs + dynamic test recipes

### Phase 3: Generate Runner (optional, eject pattern)

- [ ] AC10: 新 `/generate-runner` skill，分析目標專案產生客製化 runner
- [ ] AC11: 生成的 runner 標記 `generated_at` + `plugin_version` header
- [ ] AC12: Per-ecosystem templates（Node.js, Python, Rust, Go）
- [ ] AC13: 測試覆蓋：generate-runner schema + template validation

## Priority

Phase 1: P0 — 解決 80% 的問題（使用者忘記安裝 runner）
Phase 2: P1 — 改善通用 runner 的彈性
Phase 3: P2 — 提供 non-Node 支援和客製化能力

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | 🔲 Not started | |
| Phase 2 | 🔲 Not started | |
| Phase 3 | 🔲 Not started | |
