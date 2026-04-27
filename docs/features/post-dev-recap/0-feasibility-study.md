# Feasibility Study: Post-Development Recap

> **Doc class**: Lifecycle — Phase 0 feasibility study (per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Tier**: standard
> **Feature slug**: `post-dev-recap`
> **Requirements**: [`./1-requirements.md`](./1-requirements.md)

---

## 1. Objective

評估「post-dev-recap」功能的可行架構選項，解決 [`1-requirements.md §10.1`](./1-requirements.md) 的 6 個 solution-space open questions，為後續 `/tech-spec` 提供方向性決策。

## 2. Requirement Summary (from `1-requirements.md`)

| Key | Driver |
|-----|--------|
| Root problem | AI 代寫後使用者缺乏對成果的掌握度 —「逆向知識傳遞」 |
| Must FRs | FR-1 智慧範圍偵測 / FR-2 自由文字重點 / FR-3 靜態導覽文件 / FR-4 Q&A 階段 / FR-5 邊界明示 |
| Should FRs | FR-6 逐步互動模式 / FR-7 規格對照 / FR-8 promote 機制 |
| Critical NFRs | NFR-5 不得重複實作既有能力（必須重用） / NFR-1 偵測 ≤ 5s / NFR-3 Q&A p95 ≤ 10s |

---

## 3. Constraints & Flexibility

| Type | Constraint | Source | Flexibility |
|------|-----------|--------|-------------|
| Technical | 必須支援 3 級 fallback 的變更偵測（diff / branch / session） | `1-requirements.md` FR-1 | Medium — 順序可調整 |
| Technical | 不得重造 `/ask`、`/tech-brief`、`/git-investigate` 既有能力 | `1-requirements.md` NFR-5 | **Low** — 需求硬性 |
| Technical | 互動導覽需有確定性步進 | `1-requirements.md` FR-6 | Medium — 實作手段可選 |
| Product | 不強制取代 `/ask`（邊界保留） | User decision（2026-04-17 AskUserQuestion `vs /ask = 都保留`） | Low |
| Process | 不執行 git add/commit/push | Rule — `rules/git-workflow.md` L6 | Low |
| Process | `.md` 輸出需進 `/codex-review-doc` | Rule — `rules/auto-loop.md` L29-30 | Low |
| Resource | 開發時程無明確 deadline | — | High |

---

## 4. Code Research — 既有可重用能力

| 既有能力 | 可重用內容 | 對應 FR |
|----------|-----------|---------|
| `.claude/skills/tech-brief/` Stage 1-3 多源收集 | docs + git evidence + request docs 三階段模式 | FR-1, FR-3, FR-7 |
| `node scripts/resolve-feature-cli.js` | `canonical_docs` + `doc_inventory` JSON 輸出 | FR-1, FR-7 |
| `.claude/skills/ask/` Phase 0-2 context gathering | intent classification + 會話 context 整合 | FR-4 (Q&A) |
| `.claude/skills/next-step/scripts/analyze.js` | git state heuristics JSON 輸出 | FR-1 |
| `.claude/skills/git-investigate/` | git log / diff / blame 封裝 | FR-1, FR-7 |
| `.claude/skills/codex-explain/` | 程式碼解釋 prompt 模板 | FR-3, FR-4 |
| `.claude/skills/create-request/ --update` | promote 寫回文件 | FR-8 |
| `.claude_review_state.json` 模式 | State file JSON schema 慣例 | Q6 (state file) |
| `scripts/config/doc-taxonomy.json` ancillary 類型 | `briefing-`、`runbook-` 等既有 pattern | Q5 (doc location) |

**結論**：所有 Must FR 皆可基於既有能力組合，無 fundamental blocker。NFR-5 的「必須重用」方向是天然可行的。

### 4.1 Reuse Contract（NFR-5 可驗收矩陣）

此表在 tech-spec / implementation 階段作為「禁止重造」檢查清單：

| FR | 必須重用（Reuse） | 僅可薄封裝（Thin Wrap） | 可獨創（New Logic） |
|----|-------------------|------------------------|--------------------|
| FR-1 scope 偵測 | `resolve-feature-cli.js`、`git diff`/`status` | 3 級 fallback 順序邏輯 | — |
| FR-2 自由文字重點 | — | `$ARGUMENTS` 解析 | 重點關鍵字 → 變更過濾的映射 |
| FR-3 靜態導覽文件 | `tech-brief` Stage 2 git evidence 收集、`codex-explain` 程式碼說明 | 文件結構 template | 變更→設計理由合成 prompt |
| FR-4 Q&A | `ask` Phase 0-2 context 整合 | Q&A context binding（recap doc 為 primary） | — |
| FR-6 互動導覽 | — | Skill `AskUserQuestion` 互動 | 分段 turn control 狀態機 |
| FR-7 規格對照 | `resolve-feature-cli.js` 的 `canonical_docs` | 比對段落格式 | — |
| FR-8 promote 回寫 | `/create-request --update` | 寫回 prompt | — |
| FR-9 盲點清單 | — | 依 Must FR 衍生之 heuristics | AI 自判準則 |

**驗收方式**：tech-spec / implementation 階段檢查「必須重用」欄位的檔案/skill 是否有實際 import/call；未呼叫即違反 NFR-5。

---

## 5. Solution Exploration

4 個候選架構形狀 + 1 個合體變體，源自 Codex adversarial brainstorm（threadId `019d99a5-a4f0-7de3-93ab-83ded1a92873`，2026-04-17）。

### Shape A — Monolithic 單一 skill

| 屬性 | 評估 | Evidence / Assumption |
|------|------|-----------------------|
| Core | 單一 skill 從零建置 scope detection + doc gen + Q&A + step loop 全套 | — |
| FR 覆蓋 | **高**（all FR 集中在單一狀態機） | 假設：單檔可容納全部邏輯 |
| Effort | 🔴 8-12 person-days | Evidence：對照 `tech-brief`（約 6d）+ `ask`（約 4d）累積重建 |
| Risk | 🔴 與既有能力大量重疊 → 違反 NFR-5 | Evidence：§4.1 Reuse Contract 8 個 FR 中 6 項有既有重用對象 |
| Maintainability | 🟡 單檔複雜、難以拆測 | 假設：> 500 行 SKILL.md 將觸及 skill-health-check 警告 |
| Extensibility | 🟡 新增能力需改動單一大 skill | — |
| Fatal flaw | **直接違反 NFR-5** | Evidence：§4.1 有 6/8 FR 要求重用既有能力 |

### Shape B — Thin Orchestrator

| 屬性 | 評估 | Evidence / Assumption |
|------|------|-----------------------|
| Core | 單一 skill 作為編排器，呼叫既有 skill 完成各階段 | — |
| FR 覆蓋 | FR-1/2/3/7/10 容易；**FR-6（逐步互動）偏弱** | 假設：`ask` 非互動設計、不易擴充 turn control |
| Effort | 🟢 3-5 person-days | Evidence：主要為 glue code + prompt 模板，無狀態機 |
| Risk | 🟡 下游 skill 輸出解析脆性 | 假設：skill 間以 free-text 傳遞結果 |
| Maintainability | 🟢 薄層好維護 | — |
| Extensibility | 🟡 新能力受限於既有 skill 介面 | — |
| Fatal flaw | 若依賴 free-form 輸出解析，NFR-1（≤ 5s）/ NFR-3（p95 ≤ 10s）可能打折 | 假設：stub 驗證待 tech-spec |

### Shape C — Extend `/tech-brief --recap`

| 屬性 | 評估 | Evidence / Assumption |
|------|------|-----------------------|
| Core | 不新增 skill，改在 `/tech-brief` 加 `--recap` 模式 | — |
| FR 覆蓋 | FR-3/7 原生符合；FR-1 需大改；**FR-4/6 無互動 surface** | Evidence：`tech-brief/SKILL.md` 為 doc-gen only，無互動路徑 |
| Effort | 🟡 4-6 person-days | Evidence：改 `tech-brief` 4 個 phase 並新增 Q&A 分支 |
| Risk | 🔴 定位混淆：`tech-brief` 目標為「給同事」 | Evidence：`tech-brief/SKILL.md` L3 |
| Maintainability | 🟡 模式分支膨脹 | — |
| Extensibility | 🔴 mode creep；未來新模式都擠入 tech-brief | — |
| Fatal flaw | **違反 FR-5 邊界要求** | Evidence：`1-requirements.md` FR-5 明確要求與 `/tech-brief` 明示區隔 |

### Shape D — Two-skill split + wrapper

| 屬性 | 評估 | Evidence / Assumption |
|------|------|-----------------------|
| Core | `/recap-doc`（靜態）+ `/recap-ask`（互動）分離；`/post-dev-recap` 作為預設 wrapper | — |
| FR 覆蓋 | 最清晰：doc-gen 與 interactive 分離 → FR-6 最易落實 | — |
| Effort | 🟡 5-7 person-days | Evidence：3 skill（wrapper + 2 sub），每 skill 約 2d |
| Risk | 🟡 使用者繞過 wrapper 單跑時體驗斷裂 | 假設：可藉預設 wrapper 緩解 |
| Maintainability | 🟢 關注點分離、可獨立測試 | — |
| Extensibility | 🟢 未來新模式不影響既有 skill | — |
| Fatal flaw | 無 | — |

### Shape B+D Hybrid — **Codex 推薦**

| 屬性 | 評估 | Evidence / Assumption |
|------|------|-----------------------|
| Core | Shape D 責任分離 + Shape B thin orchestrator 哲學 —— sub-skill 本身也是薄層 | — |
| FR 覆蓋 | 全覆蓋；FR-6 因專屬 `/recap-ask` 而可靠 | — |
| Effort | 🟡 5-7 person-days | Evidence：同 Shape D，sub-skill 薄層化不額外增工 |
| Risk | 🟡 跨 skill 協定需清楚定義（JSON schema / state file） | — |
| Maintainability | 🟢 雙層薄層、高內聚 | — |
| Extensibility | 🟢 | — |
| Fatal flaw | 無 | — |

**信心分級**：所有人天估算為 Med 信心（基於既有 skill 規模類比，未做原型驗證）。

---

## 6. Quantitative Comparison

| Criterion | Shape A | Shape B | Shape C | Shape D | **B+D Hybrid** |
|-----------|---------|---------|---------|---------|----------------|
| Technical Feasibility | 🟡 | 🟢 | 🟡 | 🟢 | 🟢 |
| Effort (person-days) | 🔴 8-12 | 🟢 3-5 | 🟡 4-6 | 🟡 5-7 | 🟡 5-7 |
| Risk | 🔴 | 🟡 | 🔴 | 🟡 | 🟡 |
| Extensibility | 🟡 | 🟡 | 🔴 | 🟢 | 🟢 |
| Maintainability | 🟡 | 🟢 | 🟡 | 🟢 | 🟢 |
| NFR-5 compliance（重用） | 🔴 | 🟢 | 🟡 | 🟢 | 🟢 |
| FR-5 邊界遵循 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 |
| FR-6 互動可靠度 | 🟢 | 🟡 | 🔴 | 🟢 | 🟢 |
| **Summary** | ❌ 違反 NFR-5 | ⚠️ FR-6 風險 | ❌ 違反 FR-5 | ✅ 可行 | ✅ **推薦** |

---

## 7. Codex In-Depth Discussion Record

### 7.1 Discussion Process Summary

> 本次僅一輪 Codex 討論即達成 adversarial equilibrium；後續 review 回合屬於文件品質審視、不計入 solution discussion。

| Round | Topic | Codex Key Viewpoint | ThreadId |
|-------|-------|--------------------|----------|
| 1 | 初次 shape 枚舉 + adversarial challenge | 4 shapes 評估，推薦 Shape D + Shape B 風格合體；點出 3 項 adversarial challenge（是否需新 skill / 最高風險假設 / 最難 FR） | `019d99a5-a4f0-7de3-93ab-83ded1a92873` |

### 7.2 Solution Directions Suggested by Codex

- 避免 Monolithic —— 強調 NFR-5 重用是硬性限制
- 避免 `tech-brief --recap` —— 產品定位破壞
- 推薦 `/post-dev-recap` 作為 thin wrapper，底下 `/recap-doc` + `/recap-ask` 各自薄層 orchestrator
- 建議 v1 用 session-only state，v2 再導入 `.claude_recap_state.json`（YAGNI）
- 建議沿用既有 `briefing-` ancillary pattern，不先擴充 taxonomy

### 7.3 Risks / Issues Identified by Codex

| # | Challenge | Verdict |
|---|-----------|---------|
| C1 | 是否真的需要新 skill？ | **需要** — hook / prompt 無法可測地支援 FR-3+FR-6+FR-8 的整合工作流 |
| C2 | 最高風險假設（riskiest assumption） | 「這一輪開發」能否跨混合狀態（未提交 edit / 分支漂移 / 不完整 session）快速準確偵測（對應 FR-1 + NFR-1）|
| C3 | 最難 FR（hardest FR） | **FR-6** —— 逐步互動需要確定性 turn control + recap-grounded context，且不能退化為通用 `/ask` |

### 7.4 Differences from Claude's Initial Analysis

| Viewpoint | Claude 初判 | Codex | Adopted |
|-----------|------------|-------|---------|
| 推薦方向 | 傾向 Shape B（最省力） | Shape D + Shape B 合體（平衡重用與互動可靠度） | **Codex** —— Claude 初判低估 FR-6 互動難度 |
| FR-6 可行性 | 薄層 orchestrator 即可 | 需要獨立 `/recap-ask` 封裝 turn control | **Codex** |
| 文件命名 | 需新增 `recap-` taxonomy | 沿用既有 `briefing-` pattern | **Codex** —— 避免規則變更成本 |
| State file | v1 即引入 | v1 session-only、v2 再評估 | **Codex** —— YAGNI |

### 7.5 Integrated Conclusion

Shape B+D Hybrid 取得 Nash 均衡：
- 滿足 Claude 重視的「薄層 + 重用優先」
- 滿足 Codex 重視的「FR-6 互動獨立可靠 + 關注點分離」
- 兩方在 Shape A 與 Shape C 之否決上完全一致

---

## 8. Recommendation

### Primary: Shape B+D Hybrid

**採用理由**：
- ✅ 全部 Must / Should FR 可落實
- ✅ NFR-5（重用）滿足最佳 —— 子 skill 本身也是 orchestrator
- ✅ Maintainability / Extensibility 雙 🟢
- ✅ FR-6 透過專屬 `/recap-ask` 獨立建模，降低混用 `/ask` 的風險
- ✅ 效率合理（5-7 person-days）

**關鍵設計輪廓**：

```
User → /post-dev-recap [<重點>] [--interactive]
         │
         ├─→ Phase 1: scope detection（共用 util）
         │     └─ fallback: uncommitted diff → branch diff → session edits
         │
         ├─→ /recap-doc            產出 briefing-recap-<YYYY-MM-DD>.md
         │     ├─ 重用 tech-brief Stage 2 git evidence
         │     ├─ 重用 resolve-feature-cli.js
         │     └─ 重用 codex-explain（關鍵程式碼解說）
         │
         └─→ /recap-ask            進入 Q&A（--interactive 可逐步）
               ├─ Load recap doc 為 primary context
               ├─ Lazy-fetch 被引用的 file:line
               └─ 結束時提示 promote（call /create-request --update）
```

### Backup: Shape D 純分拆（不合體）

若後續發現 thin orchestrator 哲學與 feature-dev 現況不匹配，退回純 Shape D，兩個子 skill 各自做 own logic。

---

## 9. Resolution of §10.1 Open Questions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | Skill 命名 | `/post-dev-recap`（主入口）+ `/recap-doc` + `/recap-ask`（內部） | 與 feature slug 一致、避免與 memory recall 混淆；內部命名遵循 `verb-noun` 慣例 |
| Q2 | Scope 偵測優先序 | uncommitted diff → branch diff → session edits → ⚠️ Need Human | 與 `next-step` / `tech-brief` 既有慣例一致；從「現場」推到「歷史」 |
| Q3 | Q&A context 管理 | Recap doc 全載入為 primary context + lazy fetch 被引用檔案 | Recap doc 本身為精煉摘要、體積可控；lazy fetch 符合 context-management 三級政策 |
| Q4 | Skill 編排 | `/post-dev-recap` wrapper 串接 `/recap-doc` → `/recap-ask`；子 skill 可獨立呼叫 | Codex 推薦 Shape B+D |
| Q5 | 文件歸檔 | `briefing-recap-<YYYY-MM-DD>.md` 於 `docs/features/<key>/` 下，**沿用既有 ancillary `briefing-` 類型** | 避免擴充 `doc-taxonomy.json`；可日後升級為獨立 `recap-` taxonomy |
| Q6 | State file | v1 session-only；v2 選擇性引入 `.claude_recap_state.json` | YAGNI；先驗證核心體驗再決定 persistence |

---

## 10. Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | FR-1 scope 偵測誤判（C2） | High | 3 級 fallback + 偵測失敗時輸出偵測依據讓使用者手動指定 |
| R2 | FR-6 互動體驗退化為 `/ask`（C3） | High | `/recap-ask` 硬綁 recap doc 作為 primary context；禁止 fallback 到跨 codebase 問答 |
| R3 | 子 skill JSON 協定不穩定 | Medium | 在 tech-spec 中用 Zod/JSON Schema 明確化；加 unit test 涵蓋邊界 |
| R4 | `briefing-` 類型與既有 tech-brief 衍生 `-tech-brief.md` 命名空間衝突 | Low | 用更精確 `briefing-recap-` prefix；tech-spec 階段驗證 `doc-classifier.js` 不誤判 |
| R5 | wrapper 與子 skill 的錯誤傳遞鏈不清 | Medium | Gate sentinel 化；wrapper 對 sub-skill 失敗採「快速失敗」 |
| R6 | 使用者透過 wrapper 觸發但預期單一 skill 行為 | Low | README / SKILL.md 清楚標示「`/post-dev-recap` 為預設複合流程」 |

---

## 11. Out of Scope（轉交 `/tech-spec`）

| Item | 交付位置 |
|------|----------|
| State file JSON schema（若 v2 需要） | `2-tech-spec.md` |
| 各子 skill 間的介面協定（I/O schema） | `2-tech-spec.md` |
| 具體 prompt templates（recap-doc / recap-ask） | `2-tech-spec.md` |
| 效能驗證方法（NFR-1/3 怎麼測） | `2-tech-spec.md` |
| Anticipated questions 演算法（FR-11） | `2-tech-spec.md`（先定案；`4-implementation.md` 只承接已定案設計） |

---

## 12. Verification Checklist

- [x] 5 Why 已在 requirements 完成
- [x] Constraints 清單含 flexibility
- [x] 既有可重用能力已研究（§4）
- [x] 4 + 1 個 solution shapes 含量化評估
- [x] Codex adversarial brainstorm 完成（threadId 記錄於 §7.1）
- [x] Comparison table + recommendation + backup + open questions 解析

---

## 13. References

- Requirements: [`./1-requirements.md`](./1-requirements.md)
- Codex brainstorm threadId: `019d99a5-a4f0-7de3-93ab-83ded1a92873`（2026-04-17）
- Reused skill patterns:
  - `.claude/skills/tech-brief/references/source-guide.md` L26-46（Stage 2 git evidence pattern）
  - `.claude/skills/ask/SKILL.md` L29-76（Phase 0-2 context gathering）
  - `.claude/skills/next-step/SKILL.md` L16-45（JSON heuristics + findings 模式）
  - `.claude/skills/create-request/SKILL.md`（promote 寫回示例）
- Doc taxonomy reference: `scripts/config/doc-taxonomy.json` L94-99（`briefing-` ancillary pattern）
- Rules: `@rules/auto-loop.md`, `@rules/docs-numbering.md`, `@rules/context-management.md`
- Next step: `/tech-spec post-dev-recap`（採 Shape B+D Hybrid）
