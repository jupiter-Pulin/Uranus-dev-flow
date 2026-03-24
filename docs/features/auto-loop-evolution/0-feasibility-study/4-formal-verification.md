# Batch 4: Formal Verification Integration (Item #5)

## 1. Problem Essence

### 1.1 Surface Requirement

在 auto-loop 中加入 deterministic verification 層，提供數學保證而非僅依賴 probabilistic AI 判斷。

### 1.2 Underlying Problem (5 Why)

1. **Why** — AI review 存在 false negative（Codex: 71% miss rate per Propel benchmark）
2. **Why** — Probabilistic review 無法保證同一輸入產生同一結果
3. **Why** — 合規場景（security, data integrity）需要 deterministic 保證
4. **Why** — 現有 precommit 只跑 lint + test（+ build if configured），缺少 property-level 驗證
5. **Root cause** — Review pipeline 只有 **probabilistic 層**，缺少 **deterministic 層**

### 1.3 Success Criteria

| Criterion | Target |
|-----------|--------|
| Type-level property 驗證 | 100% deterministic（tsc --strict） |
| Invariant 自動生成 | LLM 生成，solver 驗證 |
| False negative 降低 | Complement AI review（catch what AI misses） |
| 不影響 review 速度 | < 30s additional overhead |

## 2. Constraints

| Type | Constraint | Source | Flexibility |
|------|-----------|--------|-------------|
| Technical | 本專案是 JavaScript/Node.js（無 TypeScript strict mode） | `package.json` | Medium |
| Technical | Formal verification tools 需要每個生態系統獨立整合 | Per-project | High |
| Resource | Solver 執行時間不可預測 | SAT/SMT solvers | Medium |
| Business | 必須 opt-in（不可強制所有專案） | Plugin model | None |

## 3. Existing Capability Inventory

### 3.1 Related Modules

| File | Reusable Logic |
|------|---------------|
| `skills/security-review/SKILL.md` | Security-focused review pattern |
| `rules/testing.md` | Test pyramid + evidence model |
| `skills/codex-code-review/references/review-common.md` | Review dimensions（可加入 formal dimension） |
| `rules/testing-project.md` | Project override pattern（formal config 放這裡） |

### 3.2 Academic Foundations

| Paper | Key Insight | Applicability |
|-------|-------------|---------------|
| LEMUR (2023) | LLM proposes invariants, reasoner checks | Invariant generation |
| Quokka (2025) | 2x LEMUR performance | Faster verification |
| 4/delta Bound | E[n] <= 4/delta convergence guarantee | Theoretical backing |
| PropertyGPT (NDSS) | LLM generates smart contract properties | Property generation |
| InvBench | Reasoning models achieve single-shot verification | Future potential |

### 3.3 Ecosystem-Specific Tools

| Ecosystem | Deterministic Tools | LLM Enhancement Opportunity |
|-----------|-------------------|----------------------------|
| TypeScript | `tsc --strict`, `zod` schemas | LLM generates type assertions |
| JavaScript | ESLint rules, `node:assert` | LLM generates property-based tests |
| Solidity | Slither, Mythril, Certora | PropertyGPT-style property generation |
| Python | mypy, hypothesis | LLM generates hypothesis strategies |
| Rust | cargo clippy, miri | LLM generates `debug_assert!` |

## 4. Possible Solutions

### Option A: Deterministic Gate Layer (Pragmatic)

**Core idea**: 在 precommit 中加入 ecosystem-specific deterministic checks，作為 AI review 的 complement。

**Implementation path**:
1. `testing-project.md` 新增 `## Formal Checks` section，定義 per-project deterministic tools
2. `/precommit` 讀取配置，在 lint+test 之後跑 formal checks
3. 失敗 = precommit fail（與現有行為一致）
4. 初始支援：ESLint strict rules, `node:assert/strict`
5. 未來擴展：property-based testing（`fast-check`）

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 現有 precommit runner 可直接擴展 |
| Effort | Green | ~2 person-days（config + runner 修改） |
| Risk | Green | Opt-in，不影響現有專案 |
| Extensibility | Green | Per-ecosystem 配置 |
| Maintenance Cost | Green | 與 precommit 維護一致 |

### Option B: LLM-Assisted Property Generation (Advanced)

**Core idea**: LLM 自動從 code diff 生成 property-based tests，由 deterministic framework 執行。

**Implementation path**:
1. 新增 `/formal-check` skill
2. Skill 分析 diff，生成 `fast-check` property tests（或等價物）
3. 執行生成的 tests
4. Pass = additional confidence signal；Fail = P1 finding
5. 可整合到 auto-loop 作為 optional step

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Yellow | LLM 生成的 property 品質不穩定 |
| Effort | Red | ~10+ person-days（skill + generation + execution + integration） |
| Risk | Yellow | 生成的 tests 可能有 false failures |
| Extensibility | Green | 可擴展到所有 property-testing 框架 |
| Maintenance Cost | Yellow | Property templates 需要維護 |

### Option C: Invariant Verification (Research-Grade)

**Core idea**: 實作 LEMUR/Quokka 架構 — LLM 提出 invariants，SMT solver 驗證。

**Implementation path**:
1. 整合 Z3 solver（via npm wrapper）
2. LLM 從 code 生成 invariant candidates
3. Translate invariants to Z3 assertions
4. Solver 驗證
5. Verified invariants 作為 review evidence

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Red | Z3 integration 複雜，JS 生態系統支援有限 |
| Effort | Red | ~20+ person-days |
| Risk | Red | Academic prototype vs production 差距大 |
| Extensibility | Yellow | 綁定特定 solver |
| Maintenance Cost | Red | Solver + translation layer 維護成本高 |

## 5. Codex Discussion

> Deferred — 將在此批次獨立探討時執行 `/codex-brainstorm`。

## 6. Solution Comparison

| Dimension | A: Deterministic Gate | B: Property Gen | C: Invariant Verify |
|-----------|:-----:|:-----:|:-----:|
| Technical Feasibility | Green | Yellow | Red |
| Effort | Green (2d) | Red (10d+) | Red (20d+) |
| Risk | Green | Yellow | Red |
| Extensibility | Green | Green | Yellow |
| Maintenance Cost | Green | Yellow | Red |
| Guarantee Strength | Medium (lint-level) | High (property-level) | Highest (proof-level) |

## 7. Initial Recommendation

**Recommended**: Option A (Deterministic Gate) as v1, with Option B as v2 roadmap.

**Rationale**:
- Option A 是 **pragmatic first step** — 零風險、低成本、立即提供 deterministic complement
- Option B 是 **aspirational target** — 需要先在 Option A 上累積經驗
- Option C 目前 **不建議** — 學術 prototype 到 production 的差距太大

**Phased approach**:

```
v1 (Batch 4 scope): Option A — deterministic tools in precommit
v2 (future):        Option B — LLM property generation pilot
v3 (research):      Option C — formal proof integration (if ecosystem matures)
```

## 8. Open Questions

- [ ] 本專案（JS/Node.js）最有價值的 deterministic check 是什麼？（`node:assert/strict` types?）
- [ ] `fast-check`（property-based testing for JS）是否值得作為 v1 的一部分？
- [ ] 如何量測 deterministic layer 的 marginal value（vs 只跑 AI review）？
- [ ] Smart contract 專案是否應該有獨立的 formal check profile？
- [ ] Solver timeout 如何配置？（blocking vs background with timeout?）

## 9. Next Steps

1. `/codex-brainstorm` — Deterministic checks 的具體工具選擇
2. `/tech-spec` — Option A: testing-project.md formal checks section
3. Prototype Option B — 在一個真實 PR 上測試 LLM property generation
