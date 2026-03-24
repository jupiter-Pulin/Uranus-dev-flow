# Auto-Loop Evolution — Feasibility Study Overview

## Origin

Deep Research (2026-03-24) 識別出 10 個 auto-loop 進化方向，依據學術論文、程式碼分析、社群實務三重交叉驗證。本文件為總覽索引，各批次詳見獨立文件。

## Grouping Rationale

按**影響域**分為 4 批，每批可獨立推進 `/tech-spec`：

| Batch | Focus | Items | Priority |
|-------|-------|-------|----------|
| [1 — State Persistence](./1-state-persistence.md) | 防止無限循環、跨 session 持久化 | #1 迭代計數器、#3 Nit 歷史、#8 Dual Review 時序 | Critical |
| [2 — Review Intelligence](./2-review-intelligence.md) | 提升 review 品質與效率 | #2 Wait Prompt、#10 Spec-Driven Review、#7 收斂度量 | High |
| [3 — Infra Hardening](./3-infra-hardening.md) | 可靠性與 DX 改善 | #4 Adequacy Gate Hook、#6 Lesson Re-injection、#9 Diagnose Hooks | High |
| [4 — Formal Verification](./4-formal-verification.md) | 數學保證層 | #5 形式化驗證整合 | Medium (longer-term) |

## Master Timeline

```
Phase 1 (immediate)     Phase 2 (near-term)        Phase 3 (medium-term)
Batch 1 + Batch 2.#2    Batch 2 + Batch 3          Batch 4
State + Wait Prompt      Intelligence + Infra        Formal Methods
```

## Item Cross-Reference

| # | Item | Batch | Key Evidence |
|---|------|-------|-------------|
| 1 | Iteration Counter Persistence | 1 | Nature 2025: debugging decay; Blueprint2Code: 5-round cap |
| 2 | "Wait" Prompt Injection | 2 | Self-Correction Bench: 64.5% blind spot, 89.3% reduction |
| 3 | P2/Nit History Persistence | 1 | CodeAnt: 5-15% FPR causes alert fatigue |
| 4 | Adequacy Gate Hook Upgrade | 3 | SWE-agent: guardrails are key to success |
| 5 | Formal Verification Integration | 4 | LEMUR/Quokka: LLM+verifier, 4/delta bound |
| 6 | Lesson Re-injection Post-Compact | 3 | ICLR 2026 MemAgents: short+long-term memory |
| 7 | Convergence Metrics Dashboard | 2 | Review-fix loop math model: findings-per-round |
| 8 | Dual Review Timeout & Recovery | 1 | Cursor Bugbot: isolated VM with timeout |
| 9 | Diagnose Hooks Skill | 3 | SWE-agent ACI: informative feedback principle |
| 10 | Specification-Driven Review | 2 | Thoughtworks SDD: 80% fewer defects |

## Codex Discussion Plan

Each batch will have its own `/codex-brainstorm` session when individually explored. This overview skips Codex discussion per `--no-codex` (organizational document, not decision document).

## Next Steps

1. Pick a batch to explore in depth
2. `/feasibility-study` (with Codex) on selected batch
3. `/tech-spec` for approved items
4. Implementation via `/feature-dev` or `/codex-implement`
