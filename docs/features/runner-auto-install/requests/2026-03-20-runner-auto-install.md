# Runner Auto-Install + Generation

## Status: Completed

## Background

Plugin 提供通用 precommit-runner.js，但使用者在 `/project-setup` 後不會自動擁有 runner。
`/precommit-fast` 的 fallback path 讓模型有自由度跳過 lint，導致 CI 頻繁失敗。

## Acceptance Criteria

### Phase 1: Auto-Install

- [x] AC1: `/project-setup` 新增 scripts 安裝 phase（Phase 6.5） — `skills/project-setup/SKILL.md:334`
- [x] AC2: `/precommit-fast` 偵測到 runner 不存在時自動安裝 — `commands/precommit-fast.md:34-54`
- [x] AC3: `/precommit`（full mode）同上行為 — `commands/precommit.md:40-60`
- [x] AC4: Auto-install 時輸出明確 log — 兩個 command 都包含 log string
- [x] AC5: Auto-install 不使用 `--force`，遇到衝突 skip + warn — conflict handling table
- [x] AC6: 測試覆蓋 — `test/commands/runner-auto-install.test.js` (10/10 pass)

### Phase 2: Harden Generic Runner

- [x] AC7: lint globs 可從 `.claude/runner-config.json` 或 package.json `sd0x` field 讀取，有預設 fallback — `scripts/lib/utils.js:loadLintGlobs()`
- [x] AC8: 移除 hardcoded Jest recipe block，改為從 package.json scripts 推導 — `scripts/lib/utils.js:buildRecipes()`
- [x] AC9: 測試覆蓋：config-driven lint globs + dynamic test recipes — `test/scripts/lib/utils.test.js` (10 tests)

### Phase 3: Generate Runner (optional, eject pattern)

- [x] AC10: 新 `/generate-runner` skill，分析目標專案產生客製化 runner — `skills/generate-runner/SKILL.md`
- [x] AC11: 生成的 runner 標記 `generated_at` + `plugin_version` header — `skills/generate-runner/references/templates.md` eject header contract
- [x] AC12: Per-ecosystem templates（Node.js, Python, Rust, Go）— `skills/generate-runner/references/templates.md` 4 templates
- [x] AC13: 測試覆蓋：generate-runner schema + template validation — `test/commands/generate-runner.test.js` (8 tests)

## Priority

Phase 1: P0 — 解決 80% 的問題（使用者忘記安裝 runner）
Phase 2: P1 — 改善通用 runner 的彈性
Phase 3: P2 — 提供 non-Node 支援和客製化能力

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | ✅ Completed | commit `3fd9630`, 10 tests pass |
| Phase 2 | ✅ Completed | `444a549` — loadLintGlobs + buildRecipes, 10 tests |
| Phase 3 | ✅ Completed | `b23544f` — /generate-runner skill + 4 ecosystem templates, 8 tests |
