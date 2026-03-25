# "Think Harder" Near-Cap Strategic Reset

> **Created**: 2026-03-25
> **Status**: Draft (needs session semantics + trigger path resolution)
> **Priority**: P2 (medium-high effort, hook + rule change)
> **Brainstorm threadId**: `019d24b5-0085-74f3-b143-ae6b35060c95`
> **Origin**: autoresearch project analysis (deep-research 2026-03-25)
> **Equilibrium**: Pure Strategy Convergence (3 rounds)

## Background

autoresearch 在偵測到 >5 次連續失敗時觸發策略重置（re-read files, try combinations, try opposites），而非停下來問用戶。sd0x-dev-flow 目前在 `max_rounds` 達到上限時直接報告 blocker 並停止，沒有「嘗試不同策略」的中間階段。

**關鍵發現**（Codex debate R2）: `current_round` 在 code edit 時會 reset（`post-edit-format.sh:226`），所以 near-cap 邏輯如果基於 `current_round` 將很少觸發。需要新的 session-scoped counter `total_rounds_session`。

## Requirements

- State file 新增 `iteration_history.total_rounds_session`（不因 edit reset）
- 在 `total_rounds_session` 接近 `max_rounds` 時（`max_rounds - 3`），注入 strategic reset checklist
- 一次性觸發（同 session 只觸發一次），避免重複延遲 human escalation
- 行為層實施（behavior-layer），opt-in via `auto-loop-project.md`

## Scope

| In | Out |
|----|-----|
| State file schema: 新增 `total_rounds_session` | `current_round` 邏輯變更 |
| `hooks/post-tool-review-state.sh`: increment `total_rounds_session` | Hook 阻擋邏輯（行為層 only） |
| `hooks/post-compact-auto-loop.sh`: 注入 strategic reset | `max_rounds` 預設值變更 |
| `rules/auto-loop.md`: 新增 strategic reset section | |
| `rules/auto-loop-project.md`: opt-in config | |

## Acceptance Criteria

- [ ] State file 含 `iteration_history.total_rounds_session`（只在 session start 時 reset）
- [ ] `total_rounds_session` 每次 review iteration 遞增，不因 edit reset
- [ ] 在 `total_rounds_session >= max_rounds - 3` 時注入 strategic reset checklist
- [ ] Strategic reset 同 session 只觸發一次（state file 記錄 `strategic_reset_fired: true`）
- [ ] `auto-loop-project.md` 可 opt-in/opt-out（`## Think Harder: enabled/disabled`）
- [ ] 預設 disabled（opt-in），避免改變現有用戶行為

## Design Decision

| Decision | Choice | Alternative | Rationale |
|----------|--------|------------|-----------|
| Counter scope | Session-only（不 persist 跨 session） | Global counter | 跨 session counter 會在長期累積，失去意義 |
| 觸發時機 | `max_rounds - 3` | 固定 round 7 | 相對值更 robust（用戶可能改 max_rounds） |
| 觸發次數 | 一次性 | 每 3 rounds | 避免重複延遲 human escalation |
| 預設 | Disabled (opt-in) | Enabled | 新行為不應自動改變所有用戶的體驗 |

## Strategic Reset Checklist (injected at near-cap)

```markdown
[STRATEGIC_RESET] Approaching iteration cap. Before escalating to human:
1. Re-read the original error/requirement from conversation start
2. Challenge your current assumption — what if the opposite is true?
3. Search for similar patterns in codebase: `grep -r "keyword" --include="*.ts" -l`
4. Try a fundamentally different approach (not incremental fix)
5. If still blocked after this reset, escalate normally at max_rounds
```

## Open Questions (blocking — must resolve before implementation)

| # | Question | Impact | Resolution Path |
|---|----------|--------|----------------|
| 1 | Session identity: `session_id` is schema-only, never written by hooks. How to define session boundary? | Counter reset semantics undefined | Options: use state file create timestamp, or require explicit session start event |
| 2 | Trigger path: behavior-layer (prompt loop) vs hook injection (post-compact)? Current scope claims both. | Architectural contradiction | Pick one authoritative path: recommend behavior-layer with hook as supplementary |
| 3 | Compact does NOT reset state file (read-only in compact hook). Is `total_rounds_session` safe across compactions? | Likely safe — validate with test case | Write integration test confirming compact preserves counter |
