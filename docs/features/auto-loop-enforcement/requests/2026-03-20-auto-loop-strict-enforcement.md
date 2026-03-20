# Auto-Loop Strict Enforcement

> **Tech Spec**: [Auto-Loop Strict Enforcement Technical Spec](../2-tech-spec.md)

## Status: In Progress

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

- [ ] AC1: `.claude/settings.json` 包含 `env.STOP_GUARD_MODE: "strict"`
- [ ] AC2: 新增 `SessionStart` (matcher: `compact`) hook，compact 後自動注入 auto-loop 核心規則
- [ ] AC3: SessionStart compact hook 僅在有 pending 步驟時注入（非無條件）
- [ ] AC4: Stop guard strict mode 的 block description 包含核心禁止行為引用
- [ ] AC5: `hooks/hooks.json` 註冊 SessionStart compact entry
- [ ] AC6: `/install-hooks` 安裝後自動包含 SessionStart compact hook
- [ ] AC7: `/project-setup` hook mapping 包含 SessionStart compact
- [ ] AC8: SessionStart compact hook 包含 plugin-defers-to-local arbitration
- [ ] AC9: 既有測試全部通過
- [ ] AC10: 新增 SessionStart compact hook 的測試

## Progress

| # | Task | Status |
|---|------|--------|
| 1 | Tech spec | In Progress |
| 2 | P0: strict mode 設定 | Planned |
| 3 | P1: SessionStart compact hook | Planned |
| 4 | P2: block message 強化 | Planned |
| 5 | Tests | Planned |
