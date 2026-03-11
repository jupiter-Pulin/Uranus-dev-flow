# R3: Skill Workflow — 雙重分派與結果彙整

> **Created**: 2026-03-11
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Parent Request**: [dual-reviewer-parallel-architecture.md](./2026-03-11-dual-reviewer-parallel-architecture.md)
> **Depends On**: [R1 Foundation](./2026-03-11-r1-foundation-config.md)

## Background

在 `SKILL.md` 實作雙 reviewer 並行分派工作流，並在 `review-common.md` 定義 severity mapping 與結果彙整規則。此為雙 reviewer 架構的核心行為層。

## Requirements

| 需求 | 說明 |
|------|------|
| 雙重分派 | Step 0 發射 PENDING → Step 3 並行 Codex + Task(secondary) → Step 3.5 等待 → Step 4 彙整 → Step 4.5 發射 gate |
| Reviewer 選擇 | `pr-review-toolkit:code-reviewer` (優先) → `strict-reviewer` (fallback) → Codex-only (降級) |
| Severity mapping | toolkit confidence 90-100+P0 關鍵字→P0、90-100→P1、80-89→P2 |
| 結果彙整 | 正規化 → 去重（file + canonical_issue, ±5 lines） → 取最高 severity → 標記 source |
| 降級處理 | 任一失敗 → 單源結果 + 警告；都失敗 → `⛔ Blocked` + `⚠️ Need Human` |

## Scope

| Scope | Description |
|-------|-------------|
| In | `SKILL.md` 雙重分派工作流（Step 0/3/3.5/4/4.5）、`review-common.md` 彙整規則 + severity mapping + 降級表、reviewer 可用性偵測（30s timeout） |
| Out | Hook 修改（見 R2）、emit-review-gate.sh 腳本（見 R1）、Codex MCP prompt 格式不變 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/codex-code-review/SKILL.md` | Modify | 新增 Step 0/3/3.5/4/4.5 雙重分派工作流 |
| `skills/codex-code-review/references/review-common.md` | Modify | 新增「雙 Reviewer 彙整」section：severity mapping、去重演算法、降級表、source 標記 |

## Acceptance Criteria

### AC1: SKILL.md 工作流

- [ ] Step 0: 雙 reviewer 模式下呼叫 `bash scripts/emit-review-gate.sh PENDING`
- [ ] Step 3: 並行啟動 Codex MCP + `Task(pr-review-toolkit:code-reviewer)`
- [ ] 若 `pr-review-toolkit:code-reviewer` 不可用（30s timeout），fallback 至 `Task(strict-reviewer)`
- [ ] 若兩者皆不可用，退回 Codex-only 行為（`review_mode=single`）
- [ ] Step 3.5: 等待雙方結果返回
- [ ] Step 4: 正規化 + 去重 + 彙整為統一 findings
- [ ] Step 4.5: 呼叫 `bash scripts/emit-review-gate.sh READY|BLOCKED`

### AC2: Severity Mapping

- [ ] toolkit confidence 90-100 + P0 關鍵字（crash, data loss, security vulnerability, injection, auth bypass）→ P0
- [ ] toolkit confidence 90-100（無 P0 關鍵字）→ P1
- [ ] toolkit confidence 80-89 → P2
- [ ] `strict-reviewer` 已使用 P0/P1/P2/Nit，無需對應

### AC3: 結果彙整

- [ ] 雙方 findings 正規化為 `[severity] file:line description → fix`
- [ ] 去重 key = `file + canonical_issue_text`（忽略 line number ±5 差異）
- [ ] 衝突解決：同一 key 取最高 severity（P0 > P1 > P2 > Nit）
- [ ] 標記 `source = codex | toolkit | both`
- [ ] 排序：P0 → P1 → P2 → Nit
- [ ] 閘門：任一 P0/P1 → BLOCKED；否則 → READY

### AC4: 降級處理

- [ ] Codex 成功 + 次要成功 → 聯集彙整（`source=codex+toolkit`）
- [ ] Codex 成功 + 次要失敗 → Codex-only + 降級警告（`source=codex-only`）
- [ ] Codex 失敗 + 次要成功 → 次要-only + 降級警告（`source=toolkit-only`）
- [ ] 都失敗 → `⛔ Blocked` + `⚠️ Need Human`（`source=none`）

### AC5: Review Loop 整合

- [ ] Codex MCP: `mcp__codex__codex-reply(threadId)` 延續先前上下文
- [ ] 次要 reviewer: 每輪重新啟動，帶最新 diff
- [ ] 彙整閘門在每輪 loop 結尾重新計算並發射

### Quality Gates

- [ ] Pass `/codex-review-fast`
- [ ] P2/Nit Quality Sweep 對統一格式 findings 正常運作

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech Spec §3.3.1-§3.3.4, §3.4, §W6/W7 |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md) §3.3.1 Reviewer 選擇、§3.3.2 Severity Mapping、§3.3.3 彙整演算法、§3.3.4 降級處理、§3.4 SKILL.md 工作流、§5 W6/W7
- 前置: [R1 Foundation](./2026-03-11-r1-foundation-config.md)
- 後續: [R4 Testing](./2026-03-11-r4-testing.md)
