# R2: Hook Infrastructure — 狀態更新、閘門解析與鎖定

> **Created**: 2026-03-11
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Parent Request**: [dual-reviewer-parallel-architecture.md](./2026-03-11-dual-reviewer-parallel-architecture.md)
> **Depends On**: [R1 Foundation](./2026-03-11-r1-foundation-config.md)

## Background

擴充 3 個 hook 腳本以支援雙 reviewer 模式：`post-tool-review-state.sh` 新增 `emit-review-gate` 解析分支與可攜式鎖定機制、`stop-guard.sh` 加入 dual mode fail-closed 邏輯、`post-edit-format.sh` 重置 `aggregate_gate`。

## Requirements

| 需求 | 說明 |
|------|------|
| Gate 解析分支 | `post-tool-review-state.sh` 解析 `REVIEW_GATE=` 前綴，寫入 `aggregate_gate` |
| 可攜式鎖定 | `mkdir` lockdir 機制（macOS 相容），bounded wait 5s + stale recovery |
| Fail-closed stop-guard | `review_mode=dual` 時強制 strict blocking，優先使用 `aggregate_gate` |
| Edit invalidation | `post-edit-format.sh` 編輯後重置 `aggregate_gate` |

## Scope

| Scope | Description |
|-------|-------------|
| In | `post-tool-review-state.sh` 新增 emit-review-gate 解析 + `_lock`/`_unlock` 函式 + `aggregate_gate`/`review_mode` state 欄位、`stop-guard.sh` dual mode 邏輯、`post-edit-format.sh` aggregate_gate 重置 |
| Out | SKILL.md 工作流邏輯（見 R3）、emit-review-gate.sh 腳本本身（見 R1） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `hooks/post-tool-review-state.sh` | Modify | 新增 emit-review-gate 解析分支 + `_lock`/`_unlock` + `aggregate_gate` 寫入 |
| `hooks/stop-guard.sh` | Modify | 雙模式閘門偏好 + `FORCE_STRICT` + fail-closed |
| `hooks/post-edit-format.sh` | Modify | `aggregate_gate` 重置 + 鎖定 |
| `test/hooks/post-tool-review-state.test.js` | Modify | 新增 emit-review-gate 解析、鎖定機制測試 |
| `test/hooks/stop-guard.test.js` | Modify | 新增 dual mode 測試案例 |
| `test/hooks/post-edit-format.test.js` | Modify | 新增 aggregate_gate 重置測試 |

## Acceptance Criteria

### AC1: emit-review-gate 解析分支

- [ ] `post-tool-review-state.sh` 偵測 Bash tool 執行 `emit-review-gate` 時觸發
- [ ] 解析 `REVIEW_GATE=PENDING` → 設定 `review_mode=dual`、`aggregate_gate.executed=false`、`gate=null`、`reason=null`
- [ ] 解析 `REVIEW_GATE=READY` → 設定 `aggregate_gate.executed=true`、`gate=READY`、`reason=null`
- [ ] 解析 `REVIEW_GATE=BLOCKED` → 設定 `aggregate_gate.executed=true`、`gate=BLOCKED`、`reason=null`
- [ ] 使用 `tail -1` + 行首錨定 `^REVIEW_GATE=` 取最後有效 gate

### AC2: 可攜式鎖定機制

- [ ] `_lock()` 使用 `mkdir` lockdir（POSIX 原子操作）
- [ ] Bounded wait 5 秒逾時
- [ ] Stale lock 回收：TTL 30 秒過期**或** owner PID 已死亡（任一成立即回收）
- [ ] `_unlock()` 僅在 `HAVE_LOCK=1` 時執行
- [ ] 鎖定失敗 → fail-closed：寫入 `aggregate_gate.gate=BLOCKED`、`reason=lock_failure`

### AC3: stop-guard dual mode

- [ ] `review_mode=dual` 時強制 strict blocking（`FORCE_STRICT=true`，無視 warn 設定）
- [ ] `review_mode=dual` + `aggregate_gate.executed=true` + `gate=READY` → 放行
- [ ] `review_mode=dual` + `aggregate_gate.executed=true` + `gate=BLOCKED` → 阻擋
- [ ] `review_mode=dual` + `aggregate_gate.executed=false` → 阻擋（reason: `aggregation_incomplete`）
- [ ] `review_mode` 缺失或 `"single"` → 現有邏輯不變（向後相容）

### AC4: edit invalidation

- [ ] `post-edit-format.sh` 編輯檔案後重置 `aggregate_gate.executed=false`、`gate=null`、`reason=null`
- [ ] 重置時使用鎖定機制

### Quality Gates

- [ ] 所有 hook 測試通過
- [ ] 現有測試全數通過（無破壞性）
- [ ] Pass `/codex-review-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech Spec §3.3.6-§3.3.7, §3.5, §W3/W4/W5 |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md) §3.3.6 可攜式鎖定、§3.3.7 stop-guard、§3.5 Hook 修改摘要、§5 W3/W4/W5
- 前置: [R1 Foundation](./2026-03-11-r1-foundation-config.md)
- 後續: [R4 Testing](./2026-03-11-r4-testing.md)
