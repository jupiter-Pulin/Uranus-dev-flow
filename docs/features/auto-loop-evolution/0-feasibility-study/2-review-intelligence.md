# Batch 2: Review Intelligence

## 1. Problem Essence

### 1.1 Surface Requirement

提升 auto-loop review 的品質與效率：降低盲點率、引入規格驅動審查、量化收斂度量。

### 1.2 Underlying Problem (5 Why)

1. **Why** — Review 品質依賴 probabilistic AI，存在 64.5% 自我修正盲點
2. **Why** — Reviewer 缺乏「正確答案」參照，只能從 diff 反推意圖
3. **Why** — 無收斂度量，模型靠直覺決定何時停止
4. **Why** — 原始設計假設 AI review 接近人類審查，但研究顯示 AI 存在 self-preference bias
5. **Root cause** — Review pipeline 缺乏 **外部參照信號** 和 **量化反饋**

### 1.3 Success Criteria

| Criterion | Target |
|-----------|--------|
| Review 盲點率降低 | >= 50% reduction（Wait prompt baseline: 89.3%） |
| Spec-driven AC coverage | 每次 review 輸出 AC mapping table |
| 收斂可視化 | `findings_per_round` chart 可自動生成 |
| False positive 率 | < 10% (industry baseline: 5-15%) |

## 2. Constraints

| Type | Constraint | Source | Flexibility |
|------|-----------|--------|-------------|
| Technical | Review prompt template 不可超過 ~2000 tokens（Codex input limit） | Codex CLI | Low |
| Technical | Spec detection 依賴 3-level behavior fallback（context -> git diff -> Need Human）；底層 `scripts/lib/feature-resolver.js` 為 5-level resolution | `auto-loop.md:223`, `feature-resolver.js` | None |
| Resource | Wait prompt 增加 ~100 tokens/review（成本可忽略） | Token budget | High |
| Business | 不可降低 review 速度超過 2x | UX | Medium |

## 3. Existing Capability Inventory

### 3.1 Related Modules

| File | Reusable Logic |
|------|---------------|
| `skills/codex-code-review/references/review-common.md` | Review prompt template, dimensions |
| `skills/seek-verdict/SKILL.md` | Independent verification framework |
| `skills/test-review/SKILL.md` | AC trace mode（已有 spec-aware 邏輯） |
| `rules/testing.md:23-31` | Evidence model（automated test > runtime > manual） |
| `scripts/resolve-feature.sh` | Feature doc detection logic |

### 3.2 Design Patterns

- **Dual dispatch** — 已有 Codex + secondary parallel 架構，可加入 deliberation step
- **AC trace** — `/codex-test-review --ac-trace` 已從 request doc 讀取 AC
- **Sentinel parsing** — 標準化 gate sentinels 可擴展為收斂 sentinels

### 3.3 Tech Debt

- Review prompt 無 deliberation section
- AC 僅在 test review 使用，未注入 code review
- 無 `findings_per_round` 歷史記錄（依賴 Batch 1 #1）

## 4. Possible Solutions

### Item #2: "Wait" Prompt Injection

#### Option A: Static Deliberation Block

**Core idea**: 在 review prompt template 結尾加入固定 deliberation block，強制 reviewer 重新檢視自己的 findings。

**Implementation path**:
1. 在 `skills/codex-code-review/references/review-common.md` 的 review dimensions 之後加入：

   ```
   ## Before finalizing: Deliberation
   Wait. Re-examine each finding independently.
   1. Could this be a false positive? What evidence proves it's real?
   2. Did you miss anything in the surrounding context?
   3. Is there a more severe issue you overlooked?
   ```

2. 不需要 hook 或 state file 修改
3. 測試：比較有無 deliberation block 的 review 品質（A/B test on recent PRs）

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 單純 prompt 修改，無程式碼變更 |
| Effort | Green | < 1 person-day |
| Risk | Green | 最壞情況：無效果（不會惡化） |
| Extensibility | Green | 可逐步擴展 deliberation 內容 |
| Maintenance Cost | Green | 與 prompt template 維護一致 |

#### Option B: Dynamic Confidence Gating

**Core idea**: Reviewer 對每個 finding 輸出 confidence score，低 confidence findings 自動觸發 `/seek-verdict`。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Yellow | 需要修改 review output format + seek-verdict 自動觸發 |
| Effort | Yellow | ~5 person-days |
| Risk | Yellow | Confidence calibration 不穩定 |
| Extensibility | Green | 可用於 alert fatigue reduction |
| Maintenance Cost | Yellow | 維護 confidence threshold |

---

### Item #10: Specification-Driven Review

#### Option A: AC Injection into Code Review

**Core idea**: Code review 自動偵測 request doc 的 AC，注入 review prompt 作為 verification checklist。

**Implementation path**:
1. 偵測 request doc：behavior-layer 3-level fallback（context -> git diff -> Need Human）+ 底層 `scripts/lib/feature-resolver.js` 5-level resolution（cli -> branch -> changed paths -> docs scan -> none）
2. 解析 `## Acceptance Criteria` section
3. 在 review prompt 加入 `## Specification Checklist` section
4. Review 輸出包含 AC coverage mapping table
5. 無 AC 時退化為現有行為（graceful degradation）

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 複用現有 resolve-feature + AC parsing |
| Effort | Yellow | ~3 person-days（detection + injection + output format） |
| Risk | Yellow | AC 品質直接影響 review 品質（garbage in, garbage out） |
| Extensibility | Green | 可擴展到 tech spec sections |
| Maintenance Cost | Green | 與現有 spec detection 一致 |

#### Option B: Standalone Spec Compliance Skill

**Core idea**: 新增 `/spec-compliance` skill，獨立於 code review，專門比對 code vs spec。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 新 skill，無相容風險 |
| Effort | Yellow | ~5 person-days（新 skill + prompt + output） |
| Risk | Green | 不影響現有 review pipeline |
| Extensibility | Green | 可獨立演化 |
| Maintenance Cost | Yellow | 多一個 skill 要維護 |

---

### Item #7: Convergence Metrics Dashboard

#### Option A: `/review-metrics` Skill

**Core idea**: 新增 read-only skill，從 state file 讀取 `findings_per_round` 並輸出收斂圖表。

**Implementation path**:
1. 依賴 Batch 1 #1 的 `findings_per_round[]` 欄位
2. Skill 讀取 state file + history，計算 convergence rate
3. 輸出 markdown table + recommendation（continue/stop/need-human）
4. 可選：注入 auto-loop 決策（自動 stop 在 plateau 時）

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | Read-only skill，pattern 已有（`/check-coverage`） |
| Effort | Green | ~2 person-days（依賴 Batch 1 完成） |
| Risk | Green | Read-only，零副作用 |
| Extensibility | Green | 可加入 historical trend |
| Maintenance Cost | Green | 最小維護 |

#### Option B: Inline Convergence in Review Output

**Core idea**: 在每次 review 結果底部自動附加收斂指標，無需獨立 skill。

**Feasibility**:

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | Green | 修改 review prompt，要求附加 convergence section |
| Effort | Green | ~1 person-day |
| Risk | Yellow | 增加 review output 長度，可能被 compact 截斷 |
| Extensibility | Yellow | 混在 review output 中，不易獨立分析 |
| Maintenance Cost | Green | 與 prompt 維護一致 |

## 5. Codex Discussion

> Deferred — 將在此批次獨立探討時執行 `/codex-brainstorm`。

## 6. Solution Comparison

| Dimension | #2-A Static | #2-B Dynamic | #10-A Inject | #10-B Standalone | #7-A Skill | #7-B Inline |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Technical | Green | Yellow | Green | Green | Green | Green |
| Effort | Green (<1d) | Yellow (5d) | Yellow (3d) | Yellow (5d) | Green (2d) | Green (1d) |
| Risk | Green | Yellow | Yellow | Green | Green | Yellow |
| Extensibility | Green | Green | Green | Green | Green | Yellow |
| Maintenance | Green | Yellow | Green | Yellow | Green | Green |

## 7. Initial Recommendation

| Item | Recommended | Rationale |
|------|------------|-----------|
| #2 Wait Prompt | Option A (Static) | 最低成本、最高回報，零風險 pilot |
| #10 Spec-Driven | Option A (AC Injection) | 複用現有 infra，與 adequacy gate 對齊 |
| #7 Convergence | Option A (Skill) + B (Inline) | 先做 B 作為 quick win，再建 A 做完整 dashboard |

**Execution order**: #2 (immediate) -> #7-B (quick win) -> #10-A (with Batch 1) -> #7-A (after Batch 1)

## 8. Open Questions

- [ ] "Wait" prompt 的最佳位置：review dimensions 之前 or 之後？
- [ ] AC injection 的 token budget：多少 AC 項目會導致 prompt 過長？
- [ ] 收斂 recommendation 是否應自動觸發 stop（vs 僅建議）？
- [ ] Spec-driven review 是否應在 dual mode 下對雙方 reviewer 都注入？
- [ ] 如何 A/B test "Wait" prompt 效果？（需定義 quality metric）

## 9. Next Steps

1. `/codex-brainstorm` — Wait prompt wording optimization
2. Pilot #2-A on next 5 PRs，量測 false positive rate delta
3. `/tech-spec` — Spec-driven review integration
