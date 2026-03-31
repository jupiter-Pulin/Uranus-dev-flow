# Changed Files Tracking (D-3)

> **Created**: 2026-03-31
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [Tech Spec](../2-tech-spec.md) <- Phase D, Section D-3
> **Depends On**: [Session Lifecycle Reset](./2026-03-31-session-lifecycle-reset-r12.md)

## Background

State file 只記錄 `has_code_change` boolean，不追蹤哪些 files 變了。stop-guard 無法判斷 review 是否覆蓋所有已變更檔案，delta review 不可行。

## Requirements

- 在 `post-edit-format.sh` 維護 `changed_files_since_review` 陣列
- 每次 Edit/Write 觸發時 append（unique）
- code_review pass 時 reset 為 `[]`
- State schema 升級為 v3（additive field）

## Scope

| Scope | Description |
|-------|-------------|
| In | changed_files array tracking, schema v3 migration, reset on review pass |
| Out | Delta-only review prompt injection（future work）、stop-guard 使用 changed_files |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `hooks/post-edit-format.sh` | Modify | 新增 `_track_changed_file()` function |
| `hooks/post-tool-review-state.sh` | Modify | 新增 `_reset_changed_files()` on review pass |
| `test/hooks/changed-files.test.js` | New | Unit tests for tracking + reset |

## Acceptance Criteria

- [x] Edit 觸發後 `changed_files_since_review` 包含該 file path
- [x] 重複 edit 同一 file 不產生 duplicate（unique array）
- [x] code_review pass 後 array reset 為 `[]`
- [x] Schema v3 backward compatible（v2 state file 自動升級）
- [x] Pass /codex-review-fast
- [x] Pass /precommit-fast

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | |
| Development | Done | `_track_changed_file()` + `_reset_changed_files()` |
| Testing | Done | 120/120 hook tests pass |
| Acceptance | Done | Codex review ✅ Ready + precommit ✅ Pass |

## References

- Tech Spec: [auto-loop-evolution](../2-tech-spec.md) Phase D, D-3
- Source: O'Reilly "Auto-Reviewing Claude's Code"
