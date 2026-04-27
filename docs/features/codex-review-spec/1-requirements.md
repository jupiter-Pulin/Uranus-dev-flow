# Requirements: Codex-Powered First-Principles Spec Review

> **Doc class**: Lifecycle — Phase 1 requirements (per `@rules/docs-numbering.md`). Feature-level problem-space analysis. **Not** a task tracking ticket; for per-task progress tracking see `requests/*.md` (created via `/create-request`).
> **Created**: 2026-04-19
> **Updated**: 2026-04-19
> **Tier**: standard

## 1. Problem Statement

現行 spec / 技術文件審核生態存在**第一性原理審核缺口**：`/codex-review-doc` 能用 Codex（具備獨立研究能力）審核文件細節（寫作品質、引用一致性、代碼對應），但**不挑戰文件賴以成立的假設、推理鏈、問題框定**；`/review-spec` 雖涵蓋完整性 / 可行性 / 風險等更高層維度，但透過 Claude subagent 執行 — 屬於 Claude 的「自我模擬審核」，不具備獨立研究哲學。兩者交集處（高層 FP 審核 × 獨立研究）目前無 skill 覆蓋。

### 5-Why Trace

1. 表層：使用者要一個 Codex 驅動的第一性原理 spec 審核 skill
2. Why：`/codex-review-doc` 只審核「文件說了什麼」，不審核「問題框定和推理是否站得住」
3. Why：Tech spec 可以內部自洽（通過 codex-review-doc）但建立在未質疑的假設或錯誤的問題框定上
4. Why：這會導致功能建立在錯誤基礎上，後期發現需大幅重構或整個方向錯誤
5. 根因：目前缺乏**獨立研究哲學**的對抗性 FP 挑戰者，能在 spec 階段就質疑「why / how」的推理鏈

## 2. Goals / Non-Goals

| Goals | Non-Goals |
|-------|-----------|
| 提供 Codex 驅動的 FP 審核，挑戰 spec 的問題框定、假設、推理鏈 | 取代 `/review-spec`（可共存；兩者定位不同） |
| 嚴格遵循 `@rules/codex-invocation.md` — 不餵養結論、不餵養全文 | 取代 `/codex-review-doc`（面向不同：細節 vs FP） |
| 輸出嚴重性分級 findings + Gate（可接入 auto-loop） | 生成新文件（審核用，不是 `/fp-brief` 類的生成） |
| 支援 review loop（`mcp__codex__codex-reply` --continue） | 跨文件整體架構審核（由 `/architecture` 或 `/codex-architect` 負責） |
| 與 `/fp-brief` 共用 6 個 FP 維度定義，保持語彙一致 | 自動執行修正（審核只標示 + 建議） |

## 3. Stakeholders

| Stakeholder | Role | Key Concern |
|-------------|------|-------------|
| Spec 作者（Feature Designer） | User | 在進入 `/tech-spec` → `/architecture` 之前取得 FP 層面的獨立質疑 |
| 下游實作者（Developer） | Dependent | 避免建立在未質疑假設上的 spec 導致後期重構 |
| Reviewer（Senior Dev / PM） | User | 取得自動化 FP 挑戰作為人工審核的補強 |
| Auto-loop / Stop Hook | Operator | 需辨識本 skill 的 gate sentinel 以決定是否可進入下一階段 |
| Codex MCP | Dependent | 需適當的 prompt — 強制獨立研究、不被餵養結論 |
| 既有 `/review-spec` `/codex-review-doc` `/fp-brief` | Dependent | 避免職責重疊；本 skill 需在 `When NOT to Use` 清楚劃界 |

## 4. Use Cases

| # | Actor | Action | Expected Outcome |
|---|-------|--------|-----------------|
| UC-1 | Spec 作者 | 寫完 `2-tech-spec.md` 後執行 `/<new-skill> docs/features/<key>/2-tech-spec.md` | 取得 FP 審核報告：問題框定 / 假設 / 推理鏈 / 替代方案 / 敏感度 / 未知項 6 維度評分 + severity findings + gate |
| UC-2 | Spec 作者 | 修正 findings 後再次執行 `/<new-skill> --continue <threadId>` | Codex 接續審核最新 diff，驗證修正是否解決 FP 層缺陷 |
| UC-3 | Reviewer | 對 `1-requirements.md` 執行審核 | 取得需求階段的 FP 挑戰（問題陳述是否成立、利害關係人是否完整、MoSCoW 排序是否合理） |
| UC-4 | Reviewer | 對 `3-architecture.md` 執行審核 | 取得架構決策的 FP 挑戰（邊界劃分、組件職責、技術選型推理） |
| UC-5 | Auto-loop | `.md` 文件變更 + 屬於 lifecycle spec（0-/1-/2-/3-） | 自動觸發本 skill 或 `/codex-review-doc`（由 auto-loop 策略決定何者） |

## 5. Functional Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| FR-1 | 接受 target doc path 參數（預設自動偵測近期變更的 lifecycle spec — 為**有意縮窄**，非完全沿用 `/codex-review-doc` 對所有 `.md` 的偵測） | Must | 僅 lifecycle spec 才適用 FP 審核；偵測邏輯需明確文件化差異 |
| FR-2 | 支援 lifecycle spec 範圍：`0-feasibility-study.md`、`1-requirements.md`、`2-tech-spec.md`、`3-architecture.md`、`4-*.md` | Must | 所有 lifecycle docs 都應受 FP 挑戰；檔名模式驗證拒絕非 lifecycle 文件 |
| FR-3 | 呼叫 `mcp__codex__codex` 以 `sandbox: 'read-only'` + `approval-policy: 'never'` 執行，prompt 強制 Codex 獨立讀取目標文件與相關程式碼 | Must | 遵循 `@rules/codex-invocation.md` 核心原則 |
| FR-4 | Codex prompt 明確列出 **6 個 FP 審核維度**，語彙對齊 `/fp-brief`：(1) Root Problem、(2) Assumptions Register、(3) Reasoning Chain、(4) Alternative Rejection Log、(5) Decision Sensitivity、(6) Open Unknowns | Must | 語彙一致性降低認知負擔；6 維已由 `/fp-brief` 驗證（`skills/fp-brief/SKILL.md:82-90`） |
| FR-5 | 輸出格式：**6-維度** rating table（對齊 FR-4 命名）+ severity findings（🔴 P0/P1 / 🟡 P2 / ⚪ Nit）+ gate sentinel 使用 `✅ Mergeable` / `⛔ Needs revision`（doc review 標準，相容 `stop-guard.sh` 與 `@rules/auto-loop.md` 既有解析） | Must | 避免自創 sentinel 破壞 auto-loop 契約；與 `doc-review` 保持同一標準 |
| FR-6 | 支援 `--continue <threadId>` 透過 `mcp__codex__codex-reply` 做 loop 審核 | Must | 匹配現有 codex skills 的 review loop 模式 |
| FR-7 | Prompt 禁止餵養模式：不含 spec 全文、不含 Claude 分析、不問 "is this correct" | Must | 遵循 `@rules/codex-invocation.md` enforcement checklist |
| FR-8 | 提供「反向研究提示」：要求 Codex 主動搜尋被拒絕的替代方案、檢查假設是否在程式碼中成立；Codex 須在輸出中附上**研究活動證據**（已檢視的替代方案清單、已查詢的程式碼路徑），但**不強制**每次都產出 defect（避免 false positive 壓力） | Must | 這是與 `/codex-review-doc` 的本質差別；要求 activity evidence 而非 defect evidence 兼顧 FP 挑戰與正確性 |
| FR-9 | `When NOT to Use` 清楚劃界：code review (`/codex-review-fast`) / 細節審核 (`/codex-review-doc`) / FP 生成 (`/fp-brief`) / Claude subagent 審核 (`/review-spec`) | Must | 防止使用者誤用；降低生態重疊 |
| FR-10 | 整合 auto-loop：輸出 sentinel 與 `stop-guard.sh` 現有解析**直接相容**（採用 FR-5 doc review sentinel，無需擴充 hook） | Must | 升級自原 `Should` — 若 sentinel 不相容，auto-loop 將無法識別本 skill 結果；對操作必要性升為 Must |
| FR-11 | 提供 `--depth brief\|normal\|deep` 旗標（沿用 `/fp-brief` 設計）以控制審核深度 | Could | 深度可由預設合理值滿足多數使用情境；視 deep tier 需求再加 |
| FR-12 | 輸出與 `/fp-brief` 結果做交叉驗證的能力（若 `*-fp-brief.md` 存在） | Could | 潛在強化但非必要；可於後續迭代加入 |

Priority: Must / Should / Could / Won't (MoSCoW)

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-1 | Correctness | Codex 必須獨立 `cat` 目標文件；Claude 不得在 prompt 中附帶文件內容 | Prompt 模板審核：不含 `${FILE_CONTENT}`、不含 diff 全文 |
| NFR-2 | Security | 呼叫 Codex 時使用 `sandbox: 'read-only'` + `approval-policy: 'never'` | Prompt template grep 驗證 |
| NFR-3 | Security | 目標 path 必須通過 `docs/features/<slug>/` 驗證；拒絕 `..`、絕對路徑、repo 外 symlink | 路徑驗證 unit test |
| NFR-4 | Maintainability | SKILL.md 採 thin entry 模式；完整 prompt 與 review loop 置於 `references/`（對齊 `codex-review-doc` / `doc-review` 結構） | 檔案行數：SKILL.md ≤ 150；references 分離 |
| NFR-5 | Consistency | Gate sentinel 使用 doc review 標準：`✅ Mergeable` / `⛔ Needs revision`（對齊 `skills/doc-review/references/review-loop-doc.md:34` 與 `hooks/stop-guard.sh` 現有解析，**不引入新 sentinel**） | 輸出 grep 驗證；與 FR-5 一致 |
| NFR-6 | Performance | 預設審核（非 `--continue` 首次 round-trip）對單一 spec 的耗時，相較於同內容以 `/codex-review-doc` 執行的 p50 耗時不超過 1.5 倍；量測方法：連續 5 次採樣取 p50，受測環境為同一 MCP session | 可量測；採樣方法明確；與 `--depth` 旗標解耦 |
| NFR-7 | Reliability | 當 Codex MCP 不可用時，skill 明確失敗並提示 fallback（如 `/review-spec`） | 錯誤處理 unit test |
| NFR-8 | Usability | Trigger keyword、`When NOT to Use`、範例需涵蓋常見情境（新 spec 驗證 / loop 修正 / 跨 lifecycle 審核） | SKILL.md 覆蓋度審核 |
| NFR-9 | Security | 審核輸出（findings、rating table）須執行敏感資料 redaction：對 token / API key / 私鑰 / 絕對路徑中的家目錄使用者名，採遮蔽策略（`[REDACTED]`） | Prompt 模板包含 output sanitization 指示；`@rules/security.md` + `@rules/logging.md` 要求 |

Categories: Performance, Security, Usability, Maintainability, Reliability, Scalability

## 7. Constraints & Assumptions

| Type | Description | Source |
|------|-------------|--------|
| Constraint | 必須使用 `mcp__codex__codex` / `mcp__codex__codex-reply` — 不得改用 CLI 或 Agent subagent | 使用者明示：「透過 codex 進行」 |
| Constraint | 禁止餵養 — 不傳遞 Claude 分析、不傳遞 spec 全文、不問 confirmation | 使用者明示 + `@rules/codex-invocation.md` |
| Constraint | 本 skill 為審核（READ-ONLY），不修改 spec 檔案 | FR 性質 |
| Constraint | 檔名需符合 kebab-case + Codex skill 命名慣例（`codex-review-*` 系列） | 既有 skill 清單證據：`skills/codex-review-fast/`、`skills/codex-review/`、`skills/codex-review-branch/`、`skills/codex-review-doc/`、`skills/codex-cli-review/`；`@rules/docs-numbering.md` 提供 kebab-case 通則 |
| Assumption | Codex 在 read-only sandbox 能完整 `cat` / `grep` / `ls` 目標 repo | 既有 `codex-review-doc` 已驗證此模式 |
| Assumption | 使用者已有 lifecycle 文件（`2-tech-spec.md` 等）可供審核；對空文件或不完整 draft 的行為屬邊界情境 | 既有 docs-numbering 結構 |
| Assumption | 6 維 FP 框架（Root / Assumptions / Chain / Alt / Sensitivity / Unknowns）適用於 0-/1-/2-/3- 所有 lifecycle docs | `/fp-brief` 已在 tech-spec 上驗證；對 requirements 與 architecture 需於 feasibility-study 確認 |
| Assumption | `/review-spec` 與本 skill 可共存；兩者服務不同審核哲學（Claude 自我模擬 vs Codex 獨立研究） | 使用者明示「類似 review-spec 但透過 codex」 |
| Assumption | Auto-loop stop-guard.sh 可擴充或複用既有 sentinel；具體策略由 tech-spec 決定 | `@rules/auto-loop.md` sentinel 表 |

## 8. Acceptance Signals

- **S-1（FR-1/2）**：對任一 lifecycle spec 執行 skill，能成功啟動 Codex review 且 Codex 獨立讀取目標文件
- **S-2（FR-3/7/NFR-1）**：skill 內部 prompt template grep 確認無 spec 全文、無 Claude 結論、無 confirmation 問句；`sandbox: 'read-only'` 與 `approval-policy: 'never'` 兩項硬性設定
- **S-3（FR-4/FR-5）**：輸出包含 **6 維度** rating（命名對齊 `/fp-brief`）+ severity 分級 findings + gate sentinel `✅ Mergeable` 或 `⛔ Needs revision`，可被 `stop-guard.sh` 既有解析
- **S-4（FR-6）**：`--continue <threadId>` 能成功復用 Codex thread，loop review 中 Codex 確實驗證了新增 diff
- **S-5（FR-8）— 研究活動證據**：Codex 輸出須包含「已檢視項目清單」（至少列出已讀取的檔案路徑或查詢的 grep 關鍵字），**但不要求**必然產出外部 defect — 驗證 skill 迫使 Codex 做外部研究的**過程**而非**結論**
- **S-6（FR-9）**：SKILL.md 的 `When NOT to Use` 明確標註四個近鄰 skill；skill catalog 測試通過
- **S-7（NFR-4）**：SKILL.md ≤ 150 行；references/ 包含至少 prompt template、loop template、dimensions 定義三份
- **S-8（NFR-7）**：當 Codex MCP 不可用，skill 明確失敗並輸出 fallback 建議（非靜默失敗）
- **S-9（NFR-9）**：review 輸出經 redaction scan 後不含 token / API key / 私鑰 pattern；家目錄使用者名遮蔽

### 8.1 FR ↔ Acceptance Signal Trace

| FR / NFR | Signals |
|----------|---------|
| FR-1, FR-2 | S-1 |
| FR-3, FR-7, NFR-1, NFR-2 | S-2 |
| FR-4, FR-5, NFR-5 | S-3 |
| FR-6 | S-4 |
| FR-8 | S-5 |
| FR-9 | S-6 |
| NFR-4 | S-7 |
| NFR-7 | S-8 |
| NFR-9 | S-9 |
| FR-10 | S-3（共用 sentinel 契約驗證即可涵蓋） |
| FR-11, FR-12 | 無對應 signal（Could 優先級，不列 MVP） |
| NFR-3, NFR-6, NFR-8 | 實作期間於 tech-spec 展開量測/覆蓋標準 |

## 9. Open Questions

### 需使用者決策（shape-defining）

- [ ] **Q1 — Skill 命名**：建議 `codex-review-spec`（對齊 `codex-review-fast/-branch/-doc` 系列）。替代：`fp-spec-review`、`codex-fp-review`、`codex-challenge`。使用者偏好？
- [ ] **Q2 — 目標文件範圍**：支援全部 lifecycle docs（0-/1-/2-/3-/4-）還是僅 `2-tech-spec.md`？本需求文件預設全部，但 MVP 可能只做 tech-spec。
- [ ] **Q3 — 與 `/review-spec` 的關係**：(a) 完全獨立共存 ／ (b) `/review-spec` 改為內部 routing（Codex available → 本 skill，否則 fallback Claude subagent）／ (c) 逐步 deprecate `/review-spec`。

### 屬解決方案空間 — 建議 `/feasibility-study`

- [ ] Solution concern：是否整合 `/fp-brief` 既有輸出（若 `*-fp-brief.md` 存在，用它做為 Codex 的「假設清單」參考）— 但這邊界模糊可能破壞「不餵養」原則 — suggest `/feasibility-study`
- [ ] Solution concern：`--depth brief|normal|deep` 是否必要？深度對 Codex 的實際影響如何量化？— suggest `/feasibility-study`
- [ ] Solution concern：Auto-loop 觸發條件的精細策略 — 限於 lifecycle spec 檔名模式（`^[0-9]-.*\.md$` under `docs/features/`）還是更廣範圍？避免與 `/codex-review-doc` 重疊 — suggest `/feasibility-study`

### 已於本輪 Codex 審核中解決的爭點（保留記錄）

| 原爭點 | 決議 | 依據 |
|--------|------|------|
| Gate sentinel 策略 | 採 doc review 標準 `✅ Mergeable` / `⛔ Needs revision` | FR-5 / NFR-5；stop-guard.sh 與 auto-loop.md 現行契約 |
| Auto-loop 整合優先級 | `Should` → `Must`（FR-10） | 若不支援即無法進 auto-loop，喪失核心價值 |
| S-5「外部證據」定義 | 研究**活動證據**（檢視清單），非強制 defect 產出 | 避免 false positive 壓力 |

## 10. References

### 生態對照（Gap 分析）

| Skill | 技術 | 視角 | 本 skill 的差異 |
|-------|------|------|----------------|
| `skills/review-spec/SKILL.md` | Claude subagent (`tech-spec-reviewer`) | 完整性 / 可行性 / 風險 / 代碼一致性 | 本 skill 用 Codex 獨立研究，非 Claude 自我模擬 |
| `skills/codex-review-doc/SKILL.md` → `skills/doc-review/SKILL.md` | Codex MCP | 架構 / 效能 / 安全 / 文件品質 / 代碼一致性 | 本 skill 專注 FP 層（問題框定 / 假設 / 推理），非表層細節 |
| `skills/fp-brief/SKILL.md` | Claude + 可選 Codex verify | FP **生成**（forward） | 本 skill 是 FP **審核**（backward） — 挑戰既有文件 |
| `skills/codex-code-review/references/codex-research-instructions.md` | Codex MCP | Code review | 本 skill 可複用其 Codex 獨立研究 prompt 結構 |

### 相關規則

- `@rules/codex-invocation.md` — 獨立研究哲學（FR-3/7 的硬性約束）
- `@rules/auto-loop.md` — Gate sentinel 標準（NFR-5）
- `@rules/docs-numbering.md` — Lifecycle doc 命名（FR-2 範圍定義）
- `@rules/docs-writing.md` — 文件寫作標準（SKILL.md 規範）

### 研究來源

- Code：`skills/codex-review/SKILL.md:1-33`（`codex-review-*` 命名慣例 + thin entry 模式）
- Code：`skills/doc-review/references/codex-prompt-doc.md:1-96`（Codex MCP + independent research prompt 範例）
- Code：`skills/fp-brief/SKILL.md:40-130`（6 維 FP 框架定義 + depth 旗標設計）
- Code：`skills/review-spec/SKILL.md:9-27`（既有 spec 審核的 subagent 模式 — 對照差異）
