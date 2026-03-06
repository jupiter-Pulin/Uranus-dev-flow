# P2/Nit Quality Sweep

> **Created**: 2026-03-06
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: N/A (rule-only change)

## Background

Auto-loop 在 Gate `Ready` (No P0/P1) 後直接進入 `/precommit-fast`，P2/Nit 建議被靜默跳過。三條規則互相矛盾：

| Rule | Says | Effect |
|------|------|--------|
| `fix-all-issues.md:9` | Zero tolerance, every issue must be fixed | 要求修 P2/Nit |
| `auto-loop.md:17` | Fix P0/P1/**P2** triggers review | P2 在 fix 範圍內 |
| `review-common.md:21` | Ready = No P0/P1 | Gate 放行 P2 → 跳過 |

在 AI agent 情境下，P2/Nit 修復成本接近零，應預設修復。

## Requirements

| Condition | Action | Output |
|-----------|--------|--------|
| Gate Ready + P2/Nit exists | Batch-fix all P2/Nit（1 attempt） | 修復後的 diff |
| Fix completed | 1 batched Codex `--continue` 驗證 | 新 review result |
| P2 still unresolved | `Need Human`（行為層，非 hook sentinel） | 停止，報告原因 |
| Nit still unresolved | Continue with structured log | 繼續，log 記錄 |
| Gate Ready + no P2/Nit | 直接 `/precommit-fast`（現有行為不變） | — |
| Gate sentinel format | `Ready` / `Blocked` 不變 | Hook 相容 |

### P2/Nit 判定算法

| Step | Description |
|------|-------------|
| 1. Parse | 從 Codex review output 解析 `[P2]` / `[Nit]` 標記的 findings |
| 2. Identity | 每個 finding 以 `file + canonicalized issue text` 為 key（line number 為 approximate，fix 後可能偏移） |
| 3. Dedupe | 同一 key 在多次 review 中出現只算 1 項 |
| 4. False-positive | 若 fix attempt 後 Codex 仍報告相同 key → 標記為 possible false-positive |

### 優先序（同時存在多種 unresolved 時）

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Unresolved P2 | `Need Human` — 停止 |
| 2 | Unresolved Nit only | Continue — Nit exemption（log 記錄） |
| 3 | All resolved | `/precommit-fast` |

### Nit Log 格式

```
[NIT_DEFERRED] file:line | issue | reason: possible-false-positive | timestamp
```

Log 不記錄程式碼片段（redaction），僅記錄 issue metadata。Issue text 中若含 secret-like tokens（API key、password 等）須先 sanitize。

## Scope

| Scope | Description |
|-------|-------------|
| In | `auto-loop.md` P2 sweep 步驟、`fix-all-issues.md` Nit 例外、`review-common.md` P2 loop + re-review template、`SKILL.md` loop 說明同步 |
| Out | Hook 層面修改（gate sentinel 不變）、新增 `--strict` 模式、Codex severity 定義修改 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `rules/auto-loop.md` | Modify | 新增 P2/Nit Quality Sweep section（Gate Ready 後） |
| `rules/fix-all-issues.md` | Modify | Exceptions 表新增 Nit exemption |
| `skills/codex-code-review/references/review-common.md` | Modify | 新增 P2/Nit Post-Ready Sweep section + re-review template 擴充驗證 P2/Nit |
| `skills/codex-code-review/SKILL.md` | Modify | Review Loop 說明同步（Blocked → fix P0/P1 → Ready → P2 sweep） |
| `skills/codex-code-review/review_rubric.md` | Modify | Merge Gate 定義對齊 review-common.md（Ready = No P0/P1） |

## Acceptance Criteria

- [x] `auto-loop.md` 包含 P2/Nit Quality Sweep 步驟（Gate Ready → fix P2/Nit → verify → precommit）
- [x] `fix-all-issues.md` Exceptions 表包含 Nit exemption（AI attempted fix, Nit persists）
- [x] `review-common.md` 包含 P2/Nit Post-Ready Sweep 文件
- [x] Auto-loop 流程：Gate Ready + P2 exists → batch fix → 1 Codex `--continue` → precommit
- [x] Auto-loop 流程：Gate Ready + no P2/Nit → precommit（現有行為不變）
- [x] Unresolved P2 → `Need Human`（不靜默跳過）
- [x] Unresolved Nit → continue with log（顯式豁免）
- [x] Pass `/codex-review-doc`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Best Practices | Done | `/best-practices` audit + Codex brainstorm `019cc35c` |
| Tech Spec | - | Rule-only change, no tech spec needed |
| Development | Done | `2f1da9e` 修改 5 檔 + request doc |
| Review | Done | 4 次 `/codex-review-doc` 全數通過 + P2/Nit sweep 驗證 |
| Acceptance | Done | 8/8 AC checked |

## References

- Best Practices Audit: Codex Brainstorm `019cc35c-42f5-7351-a0cd-9c7dfd917576`
- [Google eng-practices: The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [Microsoft Engineering Playbook: Reviewer Guidance](https://microsoft.github.io/code-with-engineering-playbook/code-reviews/process-guidance/reviewer-guidance/)
- Related rules: `rules/auto-loop.md`, `rules/fix-all-issues.md`
