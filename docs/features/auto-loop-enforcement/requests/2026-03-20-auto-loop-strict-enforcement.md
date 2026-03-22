# Auto-Loop Strict Enforcement

> **Tech Spec**: [Auto-Loop Strict Enforcement Technical Spec](../2-tech-spec.md)

## Status: Completed

## Problem

1M context model 下，模型越來越頻繁違反 auto-loop 規則 —— 問「要繼續嗎？」而非直接執行下一步。現有 `stop-guard.sh` 預設 `warn` mode，模型停止時僅 log 警告但不阻擋。Compact 後 auto-loop 規則記憶消失，進一步加劇 drift。

## Root Cause

| 原因 | 說明 |
|------|------|
| Stop guard 預設 warn | 模型可以自由停止，hook 只 log 不 block |
| Compact 後無 re-injection | 長 session compact 後核心規則被壓縮掉 |
| Behavior-layer 規則被稀釋 | 1M context 中 prompt 規則權重降低 |

## Solution

三層強化：

1. **P0**: Stop guard 預設改 strict（`.claude/settings.json`）
2. **P1**: SessionStart (compact) re-injection hook（compact 後重新注入核心規則；不用 PostCompact 因其 stdout 不注入 context）
3. **P2**: Stop guard block message 加入禁止行為引用

## Acceptance Criteria

- [x] AC1: `.claude/settings.json` 包含 `env.STOP_GUARD_MODE: "strict"` — `.claude/settings.json:2-4`
- [x] AC2: 新增 `SessionStart` (matcher: `compact`) hook — `hooks/post-compact-auto-loop.sh` (94 lines)
- [x] AC3: SessionStart compact hook 僅在有 pending 步驟時注入 — lines 70-91 + 11 tests
- [x] AC4: Stop guard block description 包含核心禁止行為引用 — `stop-guard.sh:274` (command list); SessionStart compact hook 負責完整規則 re-injection
- [x] AC5: `hooks/hooks.json` 註冊 SessionStart compact entry — `hooks.json:13-21`
- [x] AC6: `/install-hooks` 包含 SessionStart compact hook — `commands/install-hooks.md:89, 150-152`
- [x] AC7: `/project-setup` hook mapping 包含 SessionStart compact — `skills/project-setup/SKILL.md:274, 297-300`
- [x] AC8: SessionStart compact hook 包含 plugin-defers-to-local arbitration — lines 9-33
- [x] AC9: 既有測試全部通過 — CI green `6717290`
- [x] AC10: 新增 SessionStart compact hook 的測試 — `test/hooks/post-compact-auto-loop.test.js` (11 tests)

## Progress

| # | Task | Status |
|---|------|--------|
| 1 | Tech spec | Done |
| 2 | P0: strict mode 設定 | Done — `.claude/settings.json` |
| 3 | P1: SessionStart compact hook | Done — `hooks/post-compact-auto-loop.sh` |
| 4 | P2: block message 強化 | Done — command in stop-guard + rules in SessionStart compact |
| 5 | Tests | Done — 11 tests `post-compact-auto-loop.test.js` + 49 tests `stop-guard.test.js` |
