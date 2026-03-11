# R1: Foundation — Config 擴充與閘門腳本

> **Created**: 2026-03-11
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Parent Request**: [dual-reviewer-parallel-architecture.md](./2026-03-11-dual-reviewer-parallel-architecture.md)

## Background

雙 Reviewer 並行架構的基礎層：擴充 command/skill 的 `allowed-tools` 以啟用 `Task` tool、解耦 `strict-reviewer` 的循環相依、建立 `emit-review-gate.sh` 閘門發射腳本。此需求單無前置相依，可立即開工。

## Requirements

| 需求 | 說明 |
|------|------|
| allowed-tools 擴充 | 3 個 command + 1 個 skill 加入 `Task` |
| strict-reviewer 解耦 | 移除 `skills: codex-code-review` 避免 fallback 遞迴 |
| emit-review-gate.sh | 新建 PENDING/READY/BLOCKED 閘門發射腳本 |

## Scope

| Scope | Description |
|-------|-------------|
| In | `commands/*.md` allowed-tools 擴充、`SKILL.md` allowed-tools 擴充、`strict-reviewer.md` 解耦、`emit-review-gate.sh` 腳本建立 + 測試 |
| Out | Hook 修改（見 R2）、SKILL.md 工作流邏輯（見 R3）、review-common 彙整規則（見 R3） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `commands/codex-review-fast.md` | Modify | `allowed-tools` 加入 `Task` |
| `commands/codex-review.md` | Modify | `allowed-tools` 加入 `Task` |
| `commands/codex-review-branch.md` | Modify | `allowed-tools` 加入 `Task` |
| `skills/codex-code-review/SKILL.md` | Modify | `allowed-tools` 加入 `Task` |
| `.claude/agents/strict-reviewer.md` | Modify | 移除 `skills: codex-code-review` |
| `scripts/emit-review-gate.sh` | New | PENDING/READY/BLOCKED 閘門發射腳本 |
| `test/scripts/emit-review-gate.test.js` | New | 閘門腳本測試 |

## Acceptance Criteria

### AC1: allowed-tools 擴充

- [ ] `commands/codex-review-fast.md` 的 `allowed-tools` 包含 `Task`
- [ ] `commands/codex-review.md` 的 `allowed-tools` 包含 `Task`
- [ ] `commands/codex-review-branch.md` 的 `allowed-tools` 包含 `Task`
- [ ] `skills/codex-code-review/SKILL.md` 的 `allowed-tools` 包含 `Task`

### AC2: strict-reviewer 解耦

- [ ] `.claude/agents/strict-reviewer.md` 不再包含 `skills: codex-code-review`
- [ ] strict-reviewer 仍可獨立運作（手動測試）

### AC3: emit-review-gate.sh

- [ ] `scripts/emit-review-gate.sh` 建立且可執行（`chmod +x`）
- [ ] `bash scripts/emit-review-gate.sh PENDING` 輸出 `REVIEW_GATE=PENDING`
- [ ] `bash scripts/emit-review-gate.sh READY` 輸出 `REVIEW_GATE=READY`
- [ ] `bash scripts/emit-review-gate.sh BLOCKED` 輸出 `REVIEW_GATE=BLOCKED`
- [ ] 無參數時回傳 usage 錯誤
- [ ] 無效參數時回傳錯誤（非 PENDING/READY/BLOCKED）

### Quality Gates

- [ ] `test/scripts/emit-review-gate.test.js` 通過
- [ ] 現有測試全數通過（無破壞性）
- [ ] Pass `/codex-review-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech Spec §3.3.5, §W1, §W2 |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md) §3.3.5 閘門發射腳本、§5 W1/W2
- 後續: [R2 Hook Infrastructure](./2026-03-11-r2-hook-infrastructure.md)、[R3 Skill Workflow](./2026-03-11-r3-skill-workflow.md)
