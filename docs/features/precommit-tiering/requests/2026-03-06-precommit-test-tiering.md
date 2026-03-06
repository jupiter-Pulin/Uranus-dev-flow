# Precommit Test Tiering

> **Created**: 2026-03-06
> **Status**: In Development
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

Auto-loop 每次 fix iteration 執行完整測試套件（369 tests, ~8 min），integration tests 佔 95% 時間。建立 fast/full 分層，auto-loop 迭代改用 fast tier，PR gate 維持 full tier。

## Requirements

- 新增 `test:fast`（unit + schema, <2s）和 `test:ci`（全套）npm scripts
- Runner test selection 依 mode 使用不同 preference chain（fast: `test:fast -> test:unit -> test`、full: `test:ci -> test -> test:fast -> test:unit`）
- Command docs（precommit-fast.md / precommit.md）更新 preferred list 對齊 runner
- Auto-loop routing 從 `/precommit` 改為 `/precommit-fast`
- 通用專案 fast mode graceful degradation 到現有行為；full mode intentionally 偏好 `test` 以獲得更完整覆蓋

## Scope

| Scope | Description |
|-------|-------------|
| In | package.json scripts、runner preference chain、command docs、auto-loop routing、CLAUDE.md 更新、runner 測試 |
| Out | PR-boundary full precommit enforcement（獨立 enhancement）、非 Node runner fallback（獨立 enhancement）、jq process spawning 優化 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | 新增 `test:fast`, `test:ci` scripts |
| `scripts/precommit-runner.js` | Modify | Test preference chain by mode |
| `commands/precommit-fast.md` | Modify | 更新 intent preferred list + description + output table |
| `commands/precommit.md` | Modify | 更新 intent preferred list + description + output table |
| `rules/auto-loop.md` | Modify | Iterative route -> `/precommit-fast` |
| `CLAUDE.md` | Modify | 更新 auto-loop 表格 |
| `.claude/CLAUDE.md` | Modify | 更新 auto-loop 表格 |
| `CLAUDE.template.md` | Modify | 更新 auto-loop 表格 |
| `test/scripts/precommit-runner.test.js` | Modify | 新增 tier preference 測試 |

## Acceptance Criteria

- [x] `npm run test:fast` 執行 unit + schema tests（<2s）— 實測 ~1.3s, 39 tests
- [x] `npm run test:ci` 執行全部測試
- [x] Runner fast mode 選擇 `test:fast -> test:unit -> test`
- [x] Runner full mode 選擇 `test:ci -> test -> test:fast -> test:unit`
- [x] Full mode 覆蓋 >= fast mode — chain 包含 `test:fast` 防止 edge case
- [x] 無 `test:fast` 的專案 fast mode fallback 到 `test:unit`（現有行為）— 有測試驗證
- [x] Auto-loop iterative route 改為 `/precommit-fast`
- [x] CLAUDE.md auto-loop 表格已更新（CLAUDE.md + .claude/CLAUDE.md + CLAUDE.template.md）
- [x] Runner 測試驗證 tier preference chain — 5 個新測試
- [x] 所有現有 precommit-runner 測試繼續通過 — 10/10 pass
- [x] Pass `/codex-review-fast` — ✅ Ready (threadId: 019cc1e6-7094-74b3-b3de-6a1d6d172ad9)
- [x] Pass `/precommit` — ✅ PASS (fast mode, lint 0 errors + 39 tests pass)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Best practices audit + codex-brainstorm 5-round debate 完成 |
| Development | Done | 7-item fix set 全部實作：runner tiering + CI=1 env + PM-agnostic scripts + command docs + auto-loop routing + CLAUDE.md |
| Testing | Done | 10/10 precommit-runner tests pass（含 5 個 tier preference chain 測試）|
| Acceptance | Done | 12/12 AC 全部通過 |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Debate threadId: `019cc1c7-ff0a-74e3-af38-a9e1e3160018`
- Nash Equilibrium: 7-item fix set（auto-loop + runner + commands + package.json + CLAUDE.md + tests）
