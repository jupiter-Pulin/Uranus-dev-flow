# Hook-Based Proactive Event Dispatcher

> **Created**: 2026-03-21
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: N/A (new feature, pending design)
> **Depends On**: [Platform Governance Integrity](../../cross-tool-portability/requests/2026-03-21-platform-governance-integrity.md)

## Background

gstack 的 proactive skill suggestion 在每個 SKILL.md 定義 contextual trigger，自動偵測工作階段並建議相關 skill。sd0x-dev-flow 已有 `/next-step`（16 個 deterministic heuristics）和 hooks（auto-loop 強制），但都是 reactive 或 enforcement-only。

Codex 辯論結論：不應模仿 gstack 的 per-skill trigger（需修改 56 個 SKILL.md），而是在現有 hook event layer 上建立 proactive dispatcher，利用 `/next-step` 的 heuristic 資料來源，在 phase transition 時推送 top-1 高信心建議。

## Requirements

- 在 hook event layer（PostToolUse 或新 lifecycle event）加入 phase transition 偵測
- 利用 `next-step/scripts/analyze.js` 的 heuristic 輸出作為建議資料來源
- 僅在 P0/P1 finding 時主動推送建議（P2/Nit 不觸發）
- 提供 opt-in 控制機制（預設關閉或可設定）
- Throttle：每次 phase transition 最多 1 則建議，建議間有 cooldown

## Scope

| Scope | Description |
|-------|-------------|
| In | Hook event dispatcher、phase transition 偵測、heuristic-based suggestion、opt-in 控制、throttle |
| Out | Per-skill contextual trigger（不採用 gstack 做法）、NL 偵測（不做自然語言分析）、gstack 式 "stop suggesting" 跨 session 記憶 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `hooks/post-tool-review-state.sh` | Modify | 加入 phase transition event 發射 |
| `skills/next-step/scripts/analyze.js` | Verify | 確認 heuristic 輸出可供 dispatcher 使用 |
| `hooks/hooks.json` | Modify | 註冊新 event handler（如需） |
| `.claude_review_state.json` | Modify | 加入 last_suggestion_ts 欄位（throttle） |

## Acceptance Criteria

- [ ] Phase transition 時自動偵測並推送 top-1 高信心建議（confidence >= 0.8）
- [ ] 僅 P0/P1 heuristic finding 觸發主動推送
- [ ] Opt-in 控制：使用者可透過環境變數或設定關閉/開啟
- [ ] Throttle：同一 phase 不重複推送，建議間 cooldown 至少 2 個 tool call
- [ ] 不修改任何 SKILL.md frontmatter（純 hook layer 實作）
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

- gstack proactive suggestion: [gstack docs/skills.md](https://github.com/garrytan/gstack/blob/main/docs/skills.md)
- Existing mechanism: `skills/next-step/SKILL.md` (16 heuristics + --go auto-dispatch)
- Codex Brainstorm threadId: `019d0e3a-8d86-7ac1-b613-dbedfaf5f1c3`
- Source: Best-practices audit — proactive suggestion analysis (2026-03-21)
