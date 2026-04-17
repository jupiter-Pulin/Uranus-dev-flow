# Requirements: Post-Development Recap

> **Doc class**: Lifecycle — Phase 1 requirements (per `@rules/docs-numbering.md`). Feature-level problem-space analysis. **Not** a task tracking ticket; for per-task progress tracking see `requests/*.md` (created via `/create-request`).
> **Created**: 2026-04-17
> **Updated**: 2026-04-17
> **Tier**: standard
> **Feature slug**: `post-dev-recap`
> **Request tickets**: See [`requests/`](./requests/) for per-task execution tracking

---

## 1. Problem Statement

在高度 AI 代為實作的開發流程中（`/feature-dev` 大量委派給 Codex / agent），開發完成時使用者可能未親手寫任何程式碼，卻是最終負責人。現有工具（`/ask`、`/tech-brief`、`/fp-brief`、`/code-explore`）皆未針對「本人」設計「這一輪剛完成的成果」導覽，造成使用者對自己的產出缺乏掌握度。

### 5-Why Trace

| # | Question | Answer |
|---|----------|--------|
| 1 | Surface | 使用者希望有 skill 在 `/feature-dev` 完成後帶自己導覽成果並支援追問。 |
| 2 | Why | AI 代寫後使用者對實作細節、設計理由、關鍵程式碼位置缺乏第一手理解。 |
| 3 | Why | 無理解 → 無法審查、無法維護、無法對外說明 → 所有權喪失。 |
| 4 | Why | 既有工具（`/ask`、`/tech-brief`、`/fp-brief`、`/code-explore`）預設使用者已理解自己的成果，或面向他人。 |
| 5 | **Root** | **缺少「AI → 使用者」的逆向知識傳遞機制**，讓使用者在 AI 完成實作後重新建立對成果的認知與所有權。 |

---

## 2. Goals / Non-Goals

| Goals | Non-Goals |
|-------|-----------|
| 讓使用者在開發完成後快速理解「改了什麼、為什麼改、關鍵程式碼在哪」 | 取代 `/ask` 的一般問答能力 |
| 支援針對剛完成的變更進行自由追問，答案以該次變更為主要 context | 取代 `/tech-brief` 的「交付給同事」面向 |
| 智慧偵測變更範圍，並接受使用者自然語言補充重點 | 自動觸發（本版維持 opt-in，避免干擾 auto-loop） |
| 明確對比相鄰 skill 邊界，讓使用者自行選用 | 跨多輪開發的歷史彙整、匯出投影片/影片 |

---

## 3. Stakeholders

| Stakeholder | Role | Key Concern |
|-------------|------|-------------|
| Feature owner（本人） | User | 快速取回對成果的掌握度、發現 AI 代寫時未察覺的盲點 |
| Skill maintainer | Developer | 新 skill 需清楚切出與既有 4 個類似 skill 的邊界 |
| Auto-loop harness | Operator | 確認不干擾既有 fix → review → precommit 循環 |
| Future reviewer / teammate | Dependent | 可能間接受益於 recap 產物（次要） |

---

## 4. Use Cases

| # | Actor | Action | Expected Outcome |
|---|-------|--------|-----------------|
| UC-1 | User | `/feature-dev` 完成後，執行 recap skill 無參數 | 自動偵測變更範圍、產出導覽文件、進入 Q&A 階段 |
| UC-2 | User | 執行 recap 並補充自然語言重點（例：「重點看 auth middleware」） | 文件聚焦於該重點相關變更，次要變更簡述 |
| UC-3 | User | 導覽文件產出後，對某段設計理由追問（例：「為什麼用 X 而不是 Y？」） | 以該次變更 context 回答，引用 file:line 與相關文件 |
| UC-4 | User | 執行 recap 並啟用逐步互動模式 | 分段呈現每個變更，每段後暫停等待提問或續行 |
| UC-5 | User | 在 recap 中發現 AI 代寫的盲點（例：NFR 未達成） | Recap 明示盲點清單，使用者可據此回到 `/feature-dev` 補強 |

---

## 5. Functional Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| FR-1 | Skill 必須自動偵測「這一輪開發」的變更範圍；偵測策略需支援多層來源（例如 uncommitted diff、branch diff、session edits），**順序與失敗條件由後續設計決策**。 | Must | 使用者明示「可否智慧判斷」。覆蓋 UC-1。 |
| FR-2 | Skill 必須接受 `$ARGUMENTS` 自由文字，讓使用者補充重點（檔名、關鍵字、關注的決策面）。 | Must | 使用者明示「可在 skill 後面輸入」。覆蓋 UC-2。 |
| FR-3 | 預設產出靜態導覽文件，內容至少涵蓋：變更檔案清單、每項變更的「做了什麼 / 為什麼 / 關鍵程式碼 file:line 引用」、與該 feature 既有規格對照（若有）。 | Must | 使用者選「混合模式」。覆蓋 UC-1, UC-3。 |
| FR-4 | 產出文件後進入對話式 Q&A 階段，以該 recap 為主要 context，支援使用者針對任一段落追問直到結束。 | Must | 使用者選「混合模式」。覆蓋 UC-3。 |
| FR-5 | Skill 文件必須在 `When NOT to Use` 明列對比 `/ask`、`/tech-brief`、`/fp-brief`、`/code-explore` 的定位差異（見 §9 能力矩陣）。 | Must | 使用者選「都保留，由使用者自行選擇」。覆蓋 UC-1。 |
| FR-6 | Skill 必須提供「逐步互動導覽」模式：分段輸出每個變更、每段後暫停等待使用者輸入（提問 / 續行 / 跳段 / 結束）。 | Should | 使用者註記「希望保留互動式設計，感覺很有趣」。覆蓋 UC-4。 |
| FR-7 | 若偵測到目前 feature 目錄有 tech-spec / request ticket，導覽文件需引用並比對「規格 vs 實作」是否一致。 | Should | 降低 AI 代寫偏離規格風險。覆蓋 UC-3。 |
| FR-8 | Q&A 階段結束時，提示使用者是否將特定問答 promote 為「正式文件補充」（寫回 request ticket 或 tech-spec 備註段）。 | Should | 知識保存。覆蓋 UC-3。 |
| FR-9 | Skill 必須產出「盲點清單」：AI 自判本輪最可能被使用者誤解或遺漏檢視的變更；若無可自判項目必須明示「無」。 | **Must** | User decision（2026-04-17）— 逆向知識傳遞核心價值；若 AI 代寫後使用者不知道「可能漏看什麼」，recap 就只完成一半。覆蓋 UC-5。 |
| FR-10 | Skill 可支援 `--depth brief\|normal\|deep` 類似 `tech-brief` 的深度控制。 | Could | 與鄰近 skill 一致性。 |
| FR-11 | Skill 可產出 anticipated questions 清單（「你可能會問…」）供使用者點選展開。 | Could | UX 增益。 |
| FR-W1 | 自動觸發（在 `/feature-dev` 完成後 auto-trigger） | Won't (this version) | 先保持 opt-in、避免干擾 auto-loop。 |
| FR-W2 | 跨多輪開發的歷史 recap 彙整 | Won't | 範圍過大，另開 feature。 |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-1 | Performance | 變更範圍偵測階段 | ≤ 5 秒完成 |
| NFR-2 | Performance | 靜態導覽文件產出 | ≤ 30 秒完成（不含 LLM 回應外部延遲） |
| NFR-3 | Performance | Q&A 回應首 token 延遲 | p95 ≤ 10 秒 |
| NFR-4 | Usability | 無參數情境下可直接運作 | 無 required flag；偵測失敗時回報具體原因 |
| NFR-5 | Maintainability | 不得重新實作既有 Skill 已提供的能力；必須重用 | 追蹤方式於 tech-spec 階段定義（outcome：無重複功能碼） |
| NFR-6 | Observability | 導覽文件需包含來源證據 | 每個變更至少 1 個 `file:line` 引用；必要時附 git commit SHA |
| NFR-7 | Security | Secret redaction | 產出前 2-tier 掃描：高信心 secret → 中止；中信心 → 遮罩 `[REDACTED]` |
| NFR-8 | Security | 路徑邊界 | 所有存取路徑必須位於 repo 內；拒絕 `..` traversal 與外部 symlink |
| NFR-9 | i18n | 語系 | 預設台灣繁體中文，遵循 `@rules/docs-writing.md` locale convention |

---

## 7. Constraints & Assumptions

| Type | Description | Source |
|------|-------------|--------|
| Constraint | 必須支援「混合互動模式」：先靜態文件再 Q&A | User decision — 2026-04-17 AskUserQuestion 回覆 `Interaction` 選項 4 並附註「希望保留互動式的設計，感覺很有趣」 |
| Constraint | 不強制取代 `/ask`，兩者並存、由使用者自選 | User decision — 2026-04-17 AskUserQuestion 回覆 `vs /ask`：「都保留，由使用者自行選擇」 |
| Constraint | 範圍偵測需智慧判斷 + 接受自由文字重點 | User decision — 2026-04-17 AskUserQuestion 回覆 `Scope`：「可不可以智慧判斷，如果使用者有一些重點他也可以在 skill 後面輸入」 |
| Constraint | 不可執行 `git add/commit/push` | Rule — `rules/git-workflow.md` L6 Claude forbidden 條款 |
| Constraint | 文件寫入後必須觸發 `/codex-review-doc` | Rule — `rules/auto-loop.md` L29-30 `.md` 變更 → `/codex-review-doc` |
| Assumption | `/feature-dev` 完成時會留下可偵測的變更線索（git diff 或 conversation edits 其一） | Technical — 推論自 `.claude/skills/feature-dev/SKILL.md` L134-147 precommit → doc sync 流程 |
| Assumption | 使用者自然語言輸入多為短句關鍵字或檔名 | Business — 推論自使用者原始 request 用詞「一些重點他也可以在 skill 後面輸入」（2026-04-17 對話首輪） |
| Assumption | 「逐步導覽」少用、「一次看完再追問」多用 | Business — 使用者以「感覺很有趣」描述互動模式（2026-04-17 AskUserQuestion 備註欄），顯示非主流情境 |
| Assumption | 可呼叫既有 Skill 而非重造輪子 | Technical — `.claude/skills/feature-dev/SKILL.md` L32-55 已示範 Skill 間編排 |

---

## 8. Acceptance Signals

> **Trace scope**: AS-1 ~ AS-14 僅涵蓋 FR-1 ~ FR-11；`Won't` 項（FR-W1、FR-W2）本版不驗收，無對應 AS。

| # | Signal | Links | Verification |
|---|--------|-------|--------------|
| AS-1 | 已完成開發的工作區執行 recap 無參數 → 成功偵測變更範圍並產出導覽文件 | FR-1, FR-3, UC-1 | Integration test |
| AS-2 | 傳入自然語言重點 → 文件聚焦該重點相關變更、其餘簡述 | FR-2, UC-2 | Integration test |
| AS-3 | 導覽文件中每個變更都包含：檔案路徑 + 變更摘要 + ≥ 1 個 `file:line` 引用 + 設計理由 | FR-3, NFR-6 | Unit test on output schema |
| AS-4 | 文件產出後進入 Q&A，使用者針對任一段落追問可獲得以 recap 為 context 的答案 | FR-4, UC-3 | Manual |
| AS-5 | SKILL.md 的 `When NOT to Use` 明列 `/ask`、`/tech-brief`、`/fp-brief`、`/code-explore` 對比 | FR-5 | Doc review |
| AS-6 | 執行 recap 過程不觸發任何 `git add/commit/push` | Constraint | Integration test |
| AS-7 | 啟用逐步互動模式 → 分段輸出、每段後暫停等待輸入 | FR-6, UC-4 | Integration test |
| AS-8 | 範圍偵測在 5 秒內完成；文件產出在 30 秒內完成；Q&A 首 token p95 ≤ 10 秒 | NFR-1~3 | Perf test |
| AS-9 | 產出內容不含 API key / token / password；路徑限制在 repo 內 | NFR-7, NFR-8 | Security test |
| AS-10 | 偵測到既有 tech-spec / request 時，導覽文件產出「規格 vs 實作」比對段落 | FR-7 | Integration test |
| AS-11 | Q&A 結束時提示 promote，使用者選擇後成功寫回對應文件 | FR-8 | Integration test |
| AS-12 | 盲點清單必須列出至少 1 項可驗證的建議關注點，或明確輸出「無盲點」區段 | FR-9 | Unit test（heuristics 規則觸發） |
| AS-13 | `--depth` flag 三種值對應輸出規模可觀測到差異（行數 / 段落數） | FR-10 | Integration test |
| AS-14 | Anticipated questions 區段若啟用，至少 3 題且可展開獲得答案 | FR-11 | Integration test |

---

## 9. Boundary — Capability Matrix

| Skill | 輸入 | 輸出 | Guided? | 聚焦 recent-change? | 主要使用情境 |
|-------|------|------|--------|---------------------|--------------|
| `/ask` | 使用者具體問題 | 結構化回答 + 來源 | 否 | 否（自動收集 session context，但不聚焦 recent diff） | Ad-hoc 問答：我已知要問什麼 |
| `/tech-brief` | Feature 鍵 / 路徑 | 6 段落技術分享文件 | 否 | 否（以 feature 全貌為主） | 交付給同事的技術分享 |
| `/fp-brief` | 單一文件路徑 | First-principles 推理鏈 | 否 | 否 | 想看「為什麼當初這樣決定」 |
| `/code-explore` | 自然語言探索題 | 分析報告 | 否 | 否 | Trace 執行路徑 / 研究陌生模組 |
| `/post-dev-recap`（本 feature） | 自動偵測 + 自由文字重點 | 導覽文件 + Q&A 階段 | **是**（分段可選） | **是** | AI 代寫後取回對成果的掌握度 |

---

## 10. Open Questions

### 10.1 Solution-space（suggest `/feasibility-study` first, then finalize in `/tech-spec`）

- [ ] Skill 命名決定（候選：`/recap` / `/dev-recap` / `/feature-recap` / `/walk-through`） — suggest `/feasibility-study`
- [ ] 範圍偵測策略的實際優先序與失敗條件（uncommitted diff / branch diff / session edits 的排列） — suggest `/feasibility-study`
- [ ] Q&A 階段 context 管理策略：全載入 vs lazy load，以及與 `@rules/context-management.md` Three-Tier Policy 的協作 — suggest `/feasibility-study`
- [ ] 與既有 Skill 的呼叫編排：`/codex-explain`、`/git-investigate`、`/update-docs` 的協作時機 — suggest `/feasibility-study`
- [ ] 導覽文件命名與歸檔方式：現行 `scripts/config/doc-taxonomy.json` 的 ancillary 類型尚無 `recap-*`；須從「沿用既有類型（如 briefing）」「新增 `recap-` taxonomy + 更新 `@rules/docs-numbering.md`」中選一 — suggest `/feasibility-study`
- [ ] Q&A 是否寫回 state file、支援跨 session 延續（屬 persistence 設計） — suggest `/feasibility-study`

### 10.2 需求面待確認（留待本文件後續更新或 stakeholder 回覆）

| # | Question | Owner | Target |
|---|----------|-------|--------|
| Q1 | `/feature-dev` 跨越多個 `docs/features/` 子目錄時，recap 要合併呈現還是分開？ | Feature owner | `/tech-spec` 前 |
| Q2 | 盲點清單（FR-9）優先級決策 | ✅ 已決：**Must**（User 2026-04-17 於 `/tech-spec` §7.1 Q1 回覆） | — |
| Q3 | 是否需要「跨 session 延續能力」作為需求（與 10.1 state file 解法分離）？ | Feature owner | `/tech-spec` 前 |

---

## 11. References

- User original request quote（2026-04-17）: *「`/feature-dev` 很強，但實作完成之後，使用者可能對於細節一無所知，希望有個 Skill 可以帶使用者導覽完成的功能設計，提及重要的程式碼與設計等等，也可以回應使用者關於這一輪開發的問題（有別於 ask）的 recap」*
- Neighbor skills:
  - `.claude/skills/ask/SKILL.md` L3（context-aware Q&A 定義）
  - `.claude/skills/tech-brief/SKILL.md` L3（技術分享文件定位）
  - `.claude/skills/fp-brief/SKILL.md` L3（first-principles 推理鏈）
  - `.claude/skills/code-explore/SKILL.md` L16（trace 執行路徑定位）
  - `.claude/skills/feature-dev/SKILL.md` L134-147（precommit → doc sync 流程，FR-7 依據）
- Rules:
  - `rules/auto-loop.md` L29-30（`.md` → `/codex-review-doc`）
  - `rules/git-workflow.md` L6（Claude forbidden git ops）
  - `rules/docs-numbering.md` L56-93（ancillary 命名規則，§10.1 Open Question 依據）
  - `rules/context-management.md` L22-28（Three-Tier Policy，Q&A context 管理需考量）
- Doc taxonomy: `scripts/config/doc-taxonomy.json` L52-80（現行 ancillary patterns 無 `recap-`）
- Similar Phase 1 sample: `docs/features/harness-engineering-rebrand/1-requirements.md`
- Next step: 先以 `/feasibility-study` 處理 §10.1，再進入 `/tech-spec`（feature key: `post-dev-recap`）
