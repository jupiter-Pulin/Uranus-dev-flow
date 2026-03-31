# Architecture Skill

> **Created**: 2026-03-26
> **Status**: In Progress
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

`docs-numbering.md` 定義 Phase 3（`3-architecture.md`）為標準架構文件，但 `/deep-analyze` 實際產出是 Implementation Roadmap，非架構設計文件。目前 0 個 `3-architecture.md` 存在。需要新的 `/architecture` skill 產出標準化架構文件，與 `2-tech-spec.md` 互補。

## Requirements

- 新建 `/architecture` skill，支援 create + update 模式
- 複用 feature context resolution（5-level cascade）
- 平行研究：Explore agent（code patterns） + tech-spec 讀取 + Codex 架構建議
- 使用 architecture-designer agent 產出組件圖 + 資料流 + 架構決策
- `/codex-brainstorm` 辯論驗證架構設計
- 輸出 `3-architecture.md`，自動觸發 `/codex-review-doc`

## Scope

| Scope | Description |
|-------|-------------|
| In | `/architecture` skill（SKILL.md + references）、output template、architecture-designer agent、command mirror、docs-numbering 更新、tests |
| Out | 修改 `/deep-analyze`、C4/arc42 formal frameworks、diagram rendering/export、auto-generation from code |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/architecture/SKILL.md` | New | Skill 主體定義（4-phase workflow） |
| `skills/architecture/references/template.md` | New | `3-architecture.md` output template |
| `skills/architecture/references/codex-prompt.md` | New | Codex 獨立架構研究 prompt |
| `agents/architecture-designer.md` | New | 架構設計 agent（derived from solution-architect） |
| `commands/architecture.md` | New | Command mirror for skill |
| `rules/docs-numbering.md` | Modify | Phase 3 command reference 更新為 `/architecture` |
| `test/commands/architecture.test.js` | New | SKILL.md structure + template + command tests |

## Acceptance Criteria

- [ ] AC1: `skills/architecture/SKILL.md` 存在，包含 4-phase workflow（Context → Research → Design → Output）
- [ ] AC2: Output template 包含 8 個必要 section（Overview, Components, Data Flow, Integration, Decisions, Deployment, Verification, Cross-References）
- [ ] AC3: Phase 0 feature context resolution 正確（create/update 模式切換）
- [ ] AC4: Phase 1 平行研究（Explore agent background + tech-spec inline + Codex sequential）
- [ ] AC5: Architecture-designer agent 定義存在於 `agents/`
- [ ] AC6: `rules/docs-numbering.md` Phase 3 command 更新為 `/architecture`
- [ ] AC7: Tests 覆蓋 SKILL.md structure + template sections + command mirror
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Related: `skills/codex-architect/SKILL.md`（現有架構諮詢，reuse as sub-step）
- Related: `skills/tech-spec/references/feature-context-resolution.md`（5-level cascade）
