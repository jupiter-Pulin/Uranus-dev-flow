# Platform Governance Integrity

> **Created**: 2026-03-21
> **Status**: In Progress
> **Priority**: P0
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

Best-practices audit（gstack 競爭分析 + Codex 辯論）發現三個 platform governance 層面的完整性問題：(1) `plugin.json` 缺少 `skills` 陣列，阻擋 `npx skills add` 跨工具分發；(2) install-state 路徑不一致（`codex-setup` 寫入 `.sd0x/install-state.json`，其他流程讀取 `.claude/.sd0x-install-state.json`）；(3) `.claude_review_state.json` 缺少標準化 gate-event schema，無法支撐跨 host 的可觀測性。此為 P1 cross-tool portability 與 P2 proactive suggestion 的前置條件。

## Requirements

- 修復 `plugin.json` 加入完整 `skills` 陣列（自動掃描 `skills/*/SKILL.md` 產出）
- 統一 install-state 至 canonical path `.sd0x/install-state.json`（對齊 `codex-setup` 寫入端），消除 `.claude/.sd0x-install-state.json` 舊路徑
- 新增 backward-compatible migration：偵測舊路徑 → 遷移至新路徑 → 清除舊檔
- 擴展 `.claude_review_state.json` 加入 gate-event schema（event_type, source, timestamp, sentinel, host）
- CI assertion 驗證 `plugin.json` skills 陣列與 `skills/` 目錄一致性

## Scope

| Scope | Description |
|-------|-------------|
| In | plugin.json skills 陣列修復、install-state path 統一、gate-event schema、migration script、CI assertion |
| Out | 跨平台 adapter 開發（Phase 2）、Windsurf adapter（Phase 3）、full metrics dashboard（P4） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude-plugin/plugin.json` | Modify | 加入 skills 陣列 |
| `skills/codex-setup/SKILL.md` | Modify | 寫入端：確認 canonical path `.sd0x/install-state.json` |
| `commands/install-rules.md` | Modify | 讀取端：從 `.claude/.sd0x-install-state.json` 遷移至 `.sd0x/install-state.json` |
| `commands/install-hooks.md` | Modify | 讀取端：從 `.claude/.sd0x-install-state.json` 遷移至 `.sd0x/install-state.json` |
| `skills/claude-health/SKILL.md` | Modify | 讀取端：從 `.claude/.sd0x-install-state.json` 遷移至 `.sd0x/install-state.json` |
| `commands/install-scripts.md` | Verify | 確認是否也讀取 install-state（如有則對齊） |
| `hooks/post-tool-review-state.sh` | Modify | 擴展 gate-event schema |
| `.claude_review_state.json` | Modify | Schema 擴展（event_type, source, timestamp, sentinel, host） |

## Acceptance Criteria

- [ ] `plugin.json` 包含 `skills` 陣列且與 `skills/*/SKILL.md` 目錄完全一致
- [ ] Install-state path 統一至 `.sd0x/install-state.json`，所有 consumer 對齊（migration: `.claude/.sd0x-install-state.json` → `.sd0x/install-state.json`）
- [ ] 舊路徑 backward-compat migration 自動偵測 + 遷移 + 清除
- [ ] `.claude_review_state.json` 包含 gate-event schema（event_type, source, timestamp, sentinel, host）
- [ ] CI assertion 在 skills 新增/刪除時自動驗證 manifest 一致性
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | Codex brainstorm 已完成（threadId: 019d0e3a-8d86-7ac1-b613-dbedfaf5f1c3） |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [cross-tool-portability/2-tech-spec.md](../2-tech-spec.md)
- Phase 1 Request (Done): [2026-03-09-phase1-skill-distribution-and-kernel-generator.md](./2026-03-09-phase1-skill-distribution-and-kernel-generator.md)
- Codex Brainstorm threadId: `019d0e3a-8d86-7ac1-b613-dbedfaf5f1c3`
- Source: Best-practices audit — gstack vs sd0x-dev-flow competitive analysis (2026-03-21)
