# README 多語系同步 — Skills-Only Architecture

> **Created**: 2026-04-05
> **Status**: Candidate Complete
> **Priority**: P2
> **Tech Spec**: [Commands-to-Skills Migration Tech Spec](../2-tech-spec.md)
> **Depends On**: [Phase C: Clean Distribution](./2026-04-01-phase-c-clean-distribution.md)

## Background

Commands-to-skills 遷移已完成（Phase A-C，commit `b59aec3`）。6 個 README 檔案已同步更新：移除過時的 command 計數、合併 What's Included 表格、重命名 Commands Reference 為 Skill Reference。

## Requirements

- 更新英文 `README.md` 移除所有 command-centric 區段，改為 skills-only 描述
- 同步更新 5 個多語系 README（zh-TW、zh-CN、ja、ko、es）
- 更新 hero 計數行：移除 "76 commands"，更新 skills/agents 計數（以 `ls skills/ | wc -l` 和 `ls agents/ | wc -l` 為準）
- 更新 Quick Start 安裝表格中的 "76 commands" 引用
- 更新 `What's Included` 計數表格（Commands | 76 → 移除或合併）
- 更新 `Commands Reference` heading 和展開區塊（各語系使用翻譯標題）
- 確保無殘留的 command 計數或 command-centric heading

## Scope

| Scope | Description |
|-------|-------------|
| In | 6 個 README 的 commands 引用清理 + 計數更新 |
| Out | 功能性內容新增（新 skill 介紹等）、README 結構重構 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `README.md` | Modify | 英文版：更新計數、移除 commands 引用 |
| `README.zh-TW.md` | Modify | 繁體中文版同步 |
| `README.zh-CN.md` | Modify | 簡體中文版同步 |
| `README.ja.md` | Modify | 日文版同步 |
| `README.ko.md` | Modify | 韓文版同步 |
| `README.es.md` | Modify | 西班牙文版同步 |

## Acceptance Criteria

- [x] 所有 6 個 README 不含 "76 commands" 或過時的 command 計數
- [x] Hero 計數行更新為實際 skill/agent 數量（驗證方式：`ls skills/ | wc -l`、`ls agents/ | wc -l`）
- [x] Quick Start 安裝表格不含 command 引用
- [x] `What's Included` 計數表格已更新（移除 Commands 列或合併為 skills-only）
- [x] Command-centric 展開區塊（各語系翻譯標題）已更新或移除
- [x] 多語系 README 與英文版結構一致
- [x] Pass `/codex-review-doc`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Explored all 6 READMEs, identified 4 sections × 6 locales to update |
| Development | Done | Hero count, install table, What's Included, Skill Reference — all 6 locales updated |
| Testing | Done | `grep` verification: 0 residual "76 commands" / "60 skills"; 440 tests / 0 fail; `/precommit-fast` ✅ |
| Acceptance | Done | 8/8 AC checked; `/codex-review-doc` ✅ Mergeable |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Phase C: [phase-c-clean-distribution.md](./2026-04-01-phase-c-clean-distribution.md)
- Brainstorm 結論：先更新英文 README，再同步多語系
