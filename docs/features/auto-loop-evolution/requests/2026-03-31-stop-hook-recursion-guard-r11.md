# Stop Hook Recursion Guard (D-1)

> **Created**: 2026-03-31
> **Status**: Pending
> **Priority**: P0
> **Tech Spec**: [Tech Spec](../2-tech-spec.md) <- Phase D, Section D-1

## Background

Strict mode `stop-guard.sh` exit 2 可能造成 infinite loop：Claude 回應 → 再 stop → 再 exit 2。需檢查 `stop_hook_active` flag 防止遞迴。

## Requirements

- 在 `stop-guard.sh` 頂部讀取 stdin JSON 的 `stop_hook_active` flag
- 若 `true` 則立即 `exit 0`（允許 stop，中斷遞迴）
- 確保不影響正常 strict mode 行為

## Scope

| Scope | Description |
|-------|-------------|
| In | stop-guard.sh recursion guard（3 行） |
| Out | Stop mode 切換、warn/strict 策略、其他 hooks |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `hooks/stop-guard.sh` | Modify | 頂部新增 3 行 recursion guard |
| `test/hooks/stop-guard.test.js` | Modify | 新增 recursion guard test case |

## Acceptance Criteria

- [ ] `stop_hook_active=true` 時 exit 0（不觸發 review 檢查）
- [ ] `stop_hook_active=false` 或缺失時行為不變
- [ ] jq parse 失敗時 fallback 為 `false`（不中斷）
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

- Tech Spec: [auto-loop-evolution](../2-tech-spec.md) Phase D, D-1
- Source: claudefa.st + community patterns
