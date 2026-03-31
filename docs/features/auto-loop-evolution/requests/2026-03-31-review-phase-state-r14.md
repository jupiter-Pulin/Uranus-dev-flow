# Review Phase State (D-4)

> **Created**: 2026-03-31
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [Tech Spec](../2-tech-spec.md) <- Phase D, Section D-4
> **Depends On**: [Changed Files Tracking](./2026-03-31-changed-files-tracking-r13.md)

## Background

State file 只追蹤 review 是否執行過，不追蹤當前 review cycle 階段。stop-guard 無法區分「尚未開始 review」和「review 正在進行中」。

## Requirements

- 新增 `review_phase` 欄位：idle | pending_review | addressing_findings | precommit_pending
- `post-edit-format.sh` 設為 `pending_review`
- `emit-review-gate.sh` 根據 gate 結果轉換 phase
- `stop-guard.sh` 根據 phase 產生更精準的 MISSING 訊息

## Scope

| Scope | Description |
|-------|-------------|
| In | review_phase 狀態機、hook 轉換邏輯、stop-guard 增強 |
| Out | Phase escalation protocol（warn → confirm → block）、new hook events |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `hooks/post-tool-review-state.sh` | Modify | Phase transition on gate emit |
| `hooks/post-edit-format.sh` | Modify | Set phase to pending_review |
| `hooks/stop-guard.sh` | Modify | Phase-aware MISSING detection |
| `test/hooks/review-phase.test.js` | New | State machine transition tests |

## Acceptance Criteria

- [ ] Code edit → phase = `pending_review`
- [ ] Emit READY → phase = `precommit_pending`
- [ ] Emit BLOCKED → phase = `addressing_findings`
- [ ] Precommit pass → phase = `idle`
- [ ] stop-guard 根據 phase 產出正確 MISSING hint
- [ ] Pass /codex-review-fast
- [ ] Pass /precommit-fast

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [auto-loop-evolution](../2-tech-spec.md) Phase D, D-4
- Source: hamelsmu/claude-review-loop two-phase state machine
