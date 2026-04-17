# T1 — Scope Detector + Security Redaction Utility

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

`post-dev-recap` 需要偵測「這一輪開發」的變更範圍（FR-1）並對產出做 secret redaction（NFR-7/8）。兩者皆為跨 3 個 skill 共用的基礎 util，先行交付避免重複實作。

## Requirements

- 實作 `scripts/detect-scope.js`，輸出符合 tech-spec §3.2.1 的 `ScopeReport` JSON
- 實作 `scripts/security-redact.js`，實作 2-tier redaction（高信心 abort、中信心 mask）
- 3-layer fallback：uncommitted → branch → session
- 不得重造既有能力：`resolve-feature-cli.js` 必須被呼叫（NFR-5）
- 偵測時間 ≤ 5s（NFR-1）

## Scope

| Scope | Description |
|-------|-------------|
| In | `scripts/detect-scope.js` + `scripts/security-redact.js` + 對應 unit tests |
| Out | `/recap-doc`、`/recap-ask`、`/post-dev-recap` skill 本體（T2-T4 處理） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `scripts/detect-scope.js` | New | 3-layer fallback scope detector，輸出 ScopeReport JSON |
| `scripts/security-redact.js` | New | 2-tier secret redaction util |
| `test/scripts/detect-scope.test.js` | New | Unit tests：3 層 fallback、schema 驗證、timeout |
| `test/scripts/security-redact.test.js` | New | Unit tests：高/中信心 pattern、abort vs mask |

## Acceptance Criteria

- [x] `detect-scope.js` 偵測到 uncommitted diff 時回傳 `source: "uncommitted"`、`confidence: "high"`
- [x] `detect-scope.js` 無 uncommitted 但有 branch diff 時 fallback 到 `source: "branch"`、`confidence: "medium"`
- [x] `detect-scope.js` 三層皆空或偵測失敗時：stdout 輸出 ScopeReport 含 `fallback_trace`，stderr 輸出人類可讀訊息，exit code 非零
- [x] `detect-scope.js` 正確呼叫 `scripts/resolve-feature-cli.js` 以填充 `feature_context`（NFR-5 驗收）
- [x] `detect-scope.js` 在標準測試環境 ≤ 5s 完成（NFR-1）；NFR-8 路徑防護：拒絕 `..` traversal 與外部 symlink
- [x] `security-redact.js` 對高信心 pattern（RSA 私鑰 / `AKIA...` / `sk-...` / `ghp_...`）拋錯 abort
- [x] `security-redact.js` 對中信心 pattern（`password=`、hex 32+）遮罩為 `[REDACTED]`
- [x] Pass /codex-review-fast

**Status lifecycle**: Pending / In Progress / Candidate Complete / Completed（自動轉換見 `@skills/create-request/SKILL.md`）

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Spec §3.2.1 / §3.4.0 / §3.4.1 reviewed |
| Development | Done | `scripts/detect-scope.js` + `scripts/security-redact.js` implemented |
| Testing | Done | 35/35 test cases pass (detect-scope: 15, security-redact: 20). Codex-test-review: ✅ Tests sufficient. Precommit: ✅ All Pass (1264 pass / 2 skipped, total 1266) |
| Acceptance | Candidate Complete | All AC checked via Adequacy Gate (✅ Adequate). Pending `--verify-ac` for Completed status |

## References

- Tech Spec §3.2.1 ScopeReport schema / §3.4.0 Security enforcement / §3.4.1 detect-scope algorithm
- Requirements FR-1, NFR-1, NFR-5, NFR-7, NFR-8
- Reuse anchor: `.claude/skills/next-step/SKILL.md` L16-35（JSON heuristics pattern）
