# Requirements: UI First-Principles 場景化分析 Skill

> **Doc class**: Lifecycle — Phase 1 requirements (per `@rules/docs-numbering.md`). Feature-level problem-space analysis. **Not** a task tracking ticket.
> **Created**: 2026-04-24
> **Updated**: 2026-04-24 (rev-4, P1/P2/P3 best-practices fixes + Quality Sweep cleanup)
> **Tier**: standard

## 1. Problem Statement

現有 UI 設計實務普遍存在「**美學驅動**」與「**模板驅動**」兩種偏誤：前者追求視覺獨特性，後者不加思考地把 API 回傳的所有欄位攤在畫面上。兩者都跳過了一個關鍵問題——**「在這個特定場景下，使用者當下最想看到什麼？不想看到什麼？為什麼？」**

這個問題的回答需要：
1. 場景本身的認知需求分析（心理學／IA）
2. 使用者角色與任務目標（Jobs-to-be-Done）
3. API 欄位供給面盤點
4. 前三者交集出的**資訊優先級決策**

### 與鄰近 skills 的邊界差異

本地 `.claude/skills/` 97 個 skills 中無任何一個聚焦此推理鏈。外部 plugin `impeccable` 有少數相關 skill，但工作階段明顯不同：

| Skill | 階段 | 主要關切 | 本 skill 差異 |
|-------|------|---------|---------------|
| `frontend-design` | 實作期 | 視覺美學、避免 AI slop、typography/color/motion | 本 skill 不做視覺層，產出在其上游 |
| `critique` | 事後評估 | 評估**既有**設計的 visual hierarchy / IA / emotional resonance | 本 skill 發生在設計前，**生產**決策而非**評估**成品 |
| `distill` | 簡化期 | 從**既有**設計中移除複雜度、progressive disclosure | 本 skill 從無到有建立資訊優先級，不是減法 |
| 本 skill | 設計期（上游） | 場景 → JTBD → 心理學原則 → API 欄位 → 資訊優先級 | 產出 IA 決策文件，供 `frontend-design` 實作、供 `critique` 評估 |

### 5-Why Trace

1. **Surface**：想要一個 UI/UX 分析的 skill
2. **Why**：現有設計常追求美觀或照搬模板，忽略「此場景下使用者當下最想看到什麼」
3. **Why**：設計決策缺少結構化框架——沒有把心理學原則、IA 原則與實際 API 欄位串連起來推理
4. **Why**：API 欄位常被**全部攤上 UI**，或 UI 需要的欄位**不存在於 API**，兩邊缺少 FP 對齊機制
5. **Root**：缺少一個能把「場景 → 使用者當下認知需求 → API 欄位 → UI 資訊優先級」串成推理鏈的方法；此 skill 交付的**不是程式碼，而是設計決策本身**

## 2. Goals / Non-Goals

| Goals | Non-Goals |
|-------|-----------|
| 提供結構化框架把場景 → 心理學需求 → 資訊優先級串起來 | 做視覺美學層設計（交由 `frontend-design`） |
| 明確產出「哪些欄位顯示／隱藏／次要」的決策與**理由** | 產出最終 React/HTML 程式碼 |
| 把 API 回傳欄位對應到 UI 資訊階層 | 做視覺設計、色彩、字型、motion 選擇 |
| 以可檢驗的心理學／IA 原則為基礎（非主觀偏好） | 做使用者研究、訪談、問卷 |
| 產出工程師／設計師可讀的設計決策文件 | 產出高保真原型或 Figma 檔案 |
| 暴露 API vs UI 需求的 gap（缺欄位或冗餘欄位） | 修改後端 API |
| 產出可被 `critique` 事後評估的具名決策 | 事後評估既有介面（交由 `critique`） |

## 3. Stakeholders

| Stakeholder | Role | Key Concern |
|-------------|------|-------------|
| 前端工程師 | Primary user | 拿到場景＋API spec 後快速得到資訊優先級決策，避免主觀判斷 |
| 全端工程師 | Primary user | 設計 API 時反向驗證：API 提供的欄位是否匹配 UI 真正需要的 |
| 設計師（無 Figma 時） | Secondary user | 在無設計師支援時做出有理論依據的資訊決策 |
| 產品經理 | Reviewer | 確認資訊優先級符合產品目標與使用者旅程 |
| 最終使用者 | Beneficiary | 得到低認知負荷、符合當下任務的畫面 |
| Skill 維護者 | Operator | 擴充／更新理論原則目錄、修正錯誤錨點時的可維護性 |
| `frontend-design` skill | Downstream consumer | 接收本 skill 的 IA 決策，再做視覺層設計 |
| `critique` skill | Downstream consumer | 把本 skill 的具名理由作為評估基準 |
| `/tech-spec` skill | Downstream consumer | 把 UI 資訊決策納入技術規格的前端章節 |

## 4. Use Cases

| # | Actor | Action | Expected Outcome |
|---|-------|--------|-----------------|
| UC-1 | 前端工程師 | 提供「交易歷史頁面」場景 + 後端 API JSON sample | 得到欄位優先級表（必顯／次要／隱藏）+ 每個決策的心理學／IA 理由 |
| UC-2 | 全端工程師 | 在 API 設計階段提供「錢包餘額儀表板」場景 + 擬議 API schema | 得到「缺 X 欄位／Y 欄位冗餘」的 gap report |
| UC-3 | 產品經理 | 對既有頁面提出「為什麼這樣設計？」的審查 | 得到可追溯到心理學／場景的決策理由 |
| UC-4 | 工程師 | 「NFT 詳情頁該放什麼？」場景加上 OpenSea 風格 API | 得到針對「NFT 收藏者當下認知目標」的欄位分層建議 |
| UC-5 | 設計師 | 提供「空狀態」或「錯誤狀態」場景 | 得到該狀態下使用者心智模型分析 + 最小資訊集 |

## 5. Functional Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| FR-1 | 接受**場景描述**作為主要輸入（自然語言，如「交易歷史列表」「NFT 詳情頁」） | Must | 整個 FP 推理以場景為起點，沒有場景無法決定優先級 |
| FR-2 | 接受 **API 欄位規格**作為輔助輸入（具體接受格式於 tech-spec 決定） | Must | 沒有供給面資料無法做欄位取捨；輸入格式屬實作選擇 |
| FR-3 | 執行 **Jobs-to-be-Done 分析**：首先識別使用者在該場景的 **functional job**；並在相關情境下納入 **emotional job**（如金融操作焦慮、NFT 交易信任感）與 **social job**（如展示、身份信號） | Must | Ulwick/Christensen JTBD 框架三維度；純 functional 分析會錯過信任／焦慮／身份等關鍵驅動 |
| FR-4 | 套用預設**核心 5 原則**評估資訊呈現：Jobs-to-be-Done、Cognitive Load Theory、Hick's Law、Miller's Law、Progressive Disclosure | Must | 此 5 個原則覆蓋「使用者任務 → 處理能力上限 → 決策速度 → 延遲揭露」完整推理鏈；不含 Gestalt/F-Pattern/Fitts' Law（偏視覺版面，與 `frontend-design` 重疊） |
| FR-5 | 產出**欄位決策表**：每個 API 欄位標註顯示／次要／隱藏 + 理由 | Must | 核心交付物，讓決策可審查 |
| FR-6 | 產出 **API-UI Gap Report**：標記「UI 需要但 API 沒提供」「API 提供但 UI 不需要」 | Must | 驅動跨端對齊，這是此 skill 獨特於 `frontend-design` 的價值 |
| FR-7 | 產出**資訊階層建議**（primary zone / secondary zone / on-demand zone），但**不**指定確切版面位置 | Should | 提供夠用的結構指引，但不越界到視覺設計 |
| FR-8 | **v1 支援單場景分析**；多場景矩陣（新手 vs 熟手、已登入 vs 未登入）延後為 v2 | Should | YAGNI——v1 聚焦單場景推理鏈的品質；多場景擴充方式於 v2 評估 |
| FR-9 | 產出**反模式檢測**：指出輸入情境中可能的資訊過載／模板濫用／關鍵資訊缺失 | Should | 主動警示比被動建議更有價值 |
| FR-10 | 輸出格式為結構化文件（對齊專案其他 design-phase skills 的文件輸出慣例） | Must | 便於下游 skill 引用、review 與 diff |
| FR-11 | 於**設計階段**被使用，產出可餵給後續實作階段 skill 的文件 | Must | 明確的上游定位；具體工作流整合細節交由 tech spec 決定 |

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric | Test Protocol |
|----|----------|-------------|--------|---------------|
| NFR-1 | Usability | 純文字輸入即可產出可用決策，不依賴外部圖形工具或設計檔 | 零額外圖形工具依賴 | 輸出可在純文字界面完整閱讀，無需另開工具 |
| NFR-2 | Traceability | 每個欄位決策**必須**附上至少一個理論錨點（心理學原則或 JTBD 推論） | 決策附理由率 = 100% | 抽樣 5 fixture 場景，逐筆欄位決策檢查「理由欄」非空且引用具名原則 |
| NFR-3 | Maintainability | 心理學原則清單可獨立於主體邏輯擴充 | 新增一個原則時，需求層說明（FR-4）變更為零 | 在不修改 FR-4 敘述前提下新增第 6 個原則，skill 仍可正常輸出該原則的錨點理由 |
| NFR-4 | Consistency | 輸出結構與專案 design-phase skills 的決策表格、章節與標題慣例一致 | 結構審查通過（章節齊全、決策表欄位一致、理由欄非空） | 對照專案 design-phase skills 的模板做章節／欄位 diff |
| NFR-5 | Performance | 單場景分析在 standard tier 下可在可接受時間內完成 | p95 ≤ 2 分鐘（LLM wall-clock） | **Fixture**：10 個代表性場景（含交易歷史、NFT 詳情、儀表板、錯誤狀態等）；**方法**：連續 10 次執行取 p95；**Pass**：p95 ≤ 120s |
| NFR-6 | Security (Output) | 輸出文件不得包含 API 金鑰、token、真實 PII | 100% 符合 `@rules/security.md` | 輸出經 secret scanner 掃描零命中；人工抽查 ≥ 5 份報告零命中 |
| NFR-7 | Security (Input) | 對使用者貼入的 production JSON／API sample，skill 必須先識別並遮罩敏感欄位再分析 | 敏感欄位遮罩覆蓋率 ≥ 95%；未知高熵字串預設遮罩 | **Fixture**：20 筆含 address/email/token/account_id/phone/national_id 的 API sample；**Oracle**：標註出所有應遮罩欄位；**Pass**：(命中 ∩ oracle) ÷ oracle ≥ 0.95 |
| NFR-8 | Accuracy | 避免套用理論但無實際場景對應的「hallucinated rationale」 | 理由與場景／欄位的關聯檢核通過率 ≥ 90% | **Fixture**：5 場景 × 10 欄位 = 50 決策；**Rubric**：由 reviewer 判定「理由是否真的對應此欄位 + 此場景」（3 分制：符合／部分符合／無關）；**Pass**：符合比例 ≥ 0.90 |

## 7. Constraints & Assumptions

| Type | Description | Risk | Source |
|------|-------------|------|--------|
| Constraint | 必須符合專案 skill 平台的檔案與 metadata 慣例 | — | 專案 skill 平台規範 |
| Constraint | 不得產出可執行程式碼（那是 `frontend-design` 或 `/feature-dev` 的工作） | — | 邊界契約 |
| Constraint | 不得涉及視覺設計（色彩、字型、motion） | — | 避免與 `frontend-design` 職責重疊 |
| Constraint | 不得扮演事後評估者（那是 `critique` 的工作） | — | 避免與 `critique` 職責重疊 |
| Assumption | 使用者能以自然語言描述場景 | Low | 匹配其他 skills 輸入風格 |
| Assumption | 使用者能提供 API sample 或欄位列表；若無，skill 可用「推測場景常見欄位」作 fallback | Medium | 真實開發情境推論；fallback 品質可能受限 |
| Assumption | LLM 對主流心理學／IA 原則有足夠準確的知識可引用 | **High** | 通用 LLM 能力假設——若 LLM 錯引或混淆原則（如 Hick 與 Fitts），理由品質將失準；需於後續實作期安排驗證機制 |
| Assumption | 使用者願意接受「設計決策文件」作為交付，而非程式碼 | Low | 與使用者原始描述一致（「不一定最漂亮，但一定是使用者想看到的第一手資訊」） |

## 8. Acceptance Signals

- **Signal 1 (FR-1 ~ FR-5)**：給定場景「交易歷史列表」+ 10 欄位 API sample，skill 產出包含「每個欄位 → 顯示／次要／隱藏 + 心理學／JTBD 理由」的決策表
- **Signal 2 (FR-6)**：skill 能指出「API 提供 gasUsed 但使用者場景不關心」「使用者需要 counterparty alias 但 API 只有 raw address」等 Gap
- **Signal 3 (FR-4, NFR-2)**：抽查 10 個決策，≥ 9 個能追溯到具名的心理學／IA 原則（非模糊用詞如「更好看」）
- **Signal 4 (FR-9)**：給定刻意包含資訊過載的情境（如 20+ 欄位全顯示），skill 能主動標記為反模式
- **Signal 5 (NFR-4)**：輸出文件通過結構審查——必要章節 1–10 齊全、決策表格欄位齊全、每列理由欄位非空
- **Signal 6 (UC-2)**：給定「錢包餘額儀表板」擬議 API + 使用者場景，skill 明確回報 API 缺失的「資產估值幣別」欄位或類似 Gap
- **Signal 7 (NFR-7)**：給定包含真實地址／email 的 API sample，skill 輸出中此類欄位值為遮罩態，未原樣複製
- **Signal 8（proxy effectiveness — 跨 Gap 雙向覆蓋）**：給定 5 個 fixture 場景，5/5 報告同時包含「UI 缺 API」與「API 冗於 UI」兩個方向的 Gap 判定（缺任一方向即未通過）
- **Signal 9（proxy effectiveness — 獨立 reviewer 可讀性）**：給定 5 個 fixture 報告，獨立 reviewer（未參與該場景設計）在不需作者補充說明下，可從報告中正確指出至少 3 個 top-priority fields 與至少 3 個 hidden fields 並說明理由；5 份中 ≥ 4 份通過

## 9. Open Questions

### 已解決（2026-04-24 第三輪修正，P1 requirement-shaping 凍結）

- [x] **Q3 核心 5 原則已凍結於 FR-4**：JTBD、Cognitive Load Theory、Hick's Law、Miller's Law、Progressive Disclosure。未列入：Gestalt / F-Pattern / Fitts' Law（偏視覺層，與 `frontend-design` 重疊）
- [x] **Q6 v1 scope 已凍結於 FR-8**：v1 僅支援單場景；多場景矩陣延後 v2
- [x] **Q2 FR-2 已 genericize**：FR-2 保留「接受 API 欄位規格」抽象要求，具體格式（JSON sample / OpenAPI spec / 手寫列表）下放 tech-spec 決定

### 仍開放（不阻擋 tech-spec handoff，屬實作／擴充面）

- [ ] **Q1 Skill 命名**：建議 `ui-first-principles`，候選：`ui-scenario-analyzer`、`scenario-driven-ui`、`info-architect`
- [ ] **Q4（Future scope）**：輸出是否可進一步含 mermaid 版面 wireframe？v1 不含；v2 評估（過具象會踩到 `frontend-design` 地盤）
- [ ] **Q5 反模式清單的來源**：採用 Nielsen Norman / Laws of UX 等成熟清單？還是從專案經驗累積？
- [ ] **Q7（Implementation strategy）**：敏感欄位遮罩採白名單 or 黑名單？只要 NFR-7 的 ≥ 95% 覆蓋率達標即可，策略留給 tech-spec

### Solution concerns（建議交 `/feasibility-study`）

- [ ] **Q8**：實作路線——純 LLM prompt template、結構化 rule-based、或混合？
- [ ] **Q9**：與 `frontend-design`／`critique` 整合——標準化 handoff doc 或各自獨立？

## 10. References

- `@rules/docs-numbering.md` — Phase 1 lifecycle doc convention
- `@rules/auto-loop.md` — Post-write review requirement
- `@rules/security.md` — Secret/PII 處理準則
- `@rules/docs-writing.md` — 文件寫作慣例（tables first、繁體中文在地化）
- Related external plugin skills（`impeccable` plugin）：
  - `frontend-design` — 視覺美學層設計（下游）
  - `critique` — 事後 UX 評估（下游）
  - `distill` — 既有設計簡化（平行領域）
- Structural template reference：`.claude/skills/req-analyze/references/output-template.md`

## 11. Next Steps

本文件通過 review 後的建議路徑：
1. 回答 Q1–Q7 → 微調本文
2. Q8、Q9 → `/feasibility-study` 評估實作路線
3. `/tech-spec` 定稿 skill 結構（含 auto-loop 整合等流程性約束）
4. `/feature-dev` 實作
