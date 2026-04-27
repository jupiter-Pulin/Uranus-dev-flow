# Feasibility Study: Handoff Document Generator (`/handoff-doc`)

> **Doc class**: Lifecycle — Phase 0（可行性研究主索引）
> **Status**: In progress — best-practices research done；完整可行性分析待 `/feasibility-study handoff-doc` 執行時補齊
> **Created**: 2026-04-22

## Scope

本階段文件群探討 `/handoff-doc` skill 的可行性。目前僅完成業界最佳實踐研究一項；未來可能擴充的子研究包含：生成策略（LLM 策展 vs 規則抽取 vs 混合）、Node/JS 整合表面偵測器可行性、多 receiver 受眾差異驗證、v2 bundle 模式之 taxonomy 擴充等（對應 `1-requirements.md` OQ-7）。

## Sub-Studies

| # | Topic | Status | File |
|---|-------|--------|------|
| 1 | Industry best practices + adversarial debate | ✅ Done | [`1-best-practices-research.md`](./1-best-practices-research.md) |
| (後續) | Generation strategy（LLM vs rule-based vs hybrid）、Integration surface detector 可行性、v2 bundle 模式等 | ⏳ Pending | 由 `/feasibility-study` 觸發補齊 |

## Key Outcomes So Far

- **Verdict**: ⚠️ WARN — 既有類比 skills 覆蓋約 60%；須建 `skills/handoff-doc/` 新 skill 並擴充特定能力
- **Architecture thesis**: *New section contract + reused engine primitives*（Nash equilibrium from Round 2 debate）
- **V1 scope boundary**（摘自 sub-study）：
  - **IN v1**: 6 必填 sections、contract-index anchor（`<!-- handoff-contract-index:v1 {...} -->`）、`--check` focused on contract drift、dual freshness metadata、`--target` audience targeting、400-line overflow advisory
  - **OUT v1 (defer to v2)**: bundle mode、`llms.txt` / MCP 等外部 AI-agent 標準、certified/standard access tiering
- **Next step**: `/tech-spec handoff-doc`（v1 scope 已收斂，可直接進設計）

## References

- [`../1-requirements.md`](../1-requirements.md) — parent requirements
- [`./1-best-practices-research.md`](./1-best-practices-research.md) — industry best practices + debate record
