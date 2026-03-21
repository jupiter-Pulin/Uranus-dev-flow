# Delivery Outcome Dashboard

> **Created**: 2026-03-21
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: N/A (new feature, pending design)
> **Depends On**: [Platform Governance Integrity](../../cross-tool-portability/requests/2026-03-21-platform-governance-integrity.md)

## Background

gstack 提供 Human vs AI 壓縮率表（Boilerplate 100x, Tests 50x），但研究顯示 LOC 在 AI 時代是有害指標（METR study: AI 使開發者慢 19% 但自認快 20%；GitClear: code churn 翻倍）。Codex 辯論結論：不採用 LOC-based 壓縮率，改用 delivery outcome 指標。但 Codex 也指出，延遲度量到 P4 會導致無法驗證 P0-P2 改善是否有效。

策略：P0 的 gate-event schema 提供資料來源，此 request 在其上建立 dashboard 以量化品質結果。

## Requirements

- 定義 baseline metrics：gate pass lead time、re-review rounds、escaped defects、doc sync lag
- 基於 P0 gate-event schema 設計 metrics aggregation
- 設計 dashboard 輸出格式（CLI-friendly markdown report）
- 整合 `/project-audit` 作為 metrics 呈現入口

## Scope

| Scope | Description |
|-------|-------------|
| In | Metrics 定義、aggregation 邏輯、dashboard 報告格式、CLI 呈現 |
| Out | LOC-based 壓縮率表、Web UI dashboard、Supabase/外部 telemetry 後端 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude_review_state.json` | Read | Gate-event schema 資料來源（P0 產出） |
| `skills/project-audit/SKILL.md` | Modify | 整合 metrics 呈現 |
| `scripts/` (new) | New | Metrics aggregation script |

## Acceptance Criteria

- [ ] 定義至少 4 個 baseline metrics 且有明確計算公式
- [ ] Metrics aggregation 從 gate-event schema 正確提取資料
- [ ] Dashboard 輸出為 CLI-friendly markdown（table 格式）
- [ ] 不使用 LOC/day 或 compression ratio 作為任何指標
- [ ] Pass `/codex-review-doc`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | 競爭分析 + 業界研究完成 |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- METR Study: [metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
- Zylos Developer Productivity Metrics 2026: [zylos.ai/research/2026-02-07-developer-productivity-metrics](https://zylos.ai/research/2026-02-07-developer-productivity-metrics)
- DORA + SPACE framework
- Codex Brainstorm threadId: `019d0e3a-8d86-7ac1-b613-dbedfaf5f1c3`
- Source: Best-practices audit — efficiency metrics analysis (2026-03-21)
