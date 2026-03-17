# Request: Rule Override Pattern for Project Customization

## Meta

| Field | Value |
|-------|-------|
| Date | 2026-03-16 |
| Status | Proposed |
| Author | SD0 |
| Tech Spec | [2-tech-spec.md](../2-tech-spec.md) |
| Source | `/best-practices` audit on auto-loop customization conflict |

## Problem Statement

使用者在安裝 sd0x-dev-flow plugin 後，經常需要客製化 `auto-loop.md` 的 Auto-Trigger 行為（例如：跳過某些 review 步驟、新增 project-specific 的 review 流程）。目前的做法是直接編輯 `.claude/rules/auto-loop.md`，但 plugin 更新時若同一 section 也有變動，smart merge 會產生 `CONFLICT` 需手動解決。

## Desired Outcome

- 使用者可在獨立的 `auto-loop-project.md` 中定義客製化行為
- Plugin 更新 base rules 時不會與使用者客製化衝突
- 安裝時自動建立 template，不需手動設定
- `/claude-health` 提供 4 項 safeguard 檢查（drift, contradiction, missing, wrong-layer）

## Acceptance Criteria

- [ ] `/install-rules` 安裝 auto-loop 時同時建立 `auto-loop-project.md` template
- [ ] CLAUDE.md 引用 `@rules/auto-loop-project.md`
- [ ] Plugin 更新 `auto-loop.md` 不觸碰 project file（manifest untracked）
- [ ] `/claude-health` 檢測 4 項 safeguard
- [ ] 現有使用者（無客製化）升級後行為不變
- [ ] 現有使用者（有客製化）獲得 wrong-layer 遷移提示

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Feasibility | ✅ Done | `/best-practices` + `/codex-brainstorm` Nash equilibrium |
| Tech Spec | ✅ Done | `docs/features/rule-override-pattern/2-tech-spec.md` |
| Implementation | Pending | 7 tasks in WBS |
| Testing | Pending | Unit + integration tests |
| Review | Pending | `/codex-review-doc` |
