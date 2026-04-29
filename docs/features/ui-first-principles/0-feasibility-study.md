# Feasibility Study: UI First-Principles Skill 實作架構

> **Doc class**: Lifecycle — Phase 0 feasibility study (per `@rules/docs-numbering.md`). Backfill after `1-requirements.md` to resolve Q8/Q9 solution concerns before `/tech-spec`. Note: docs-numbering 的 phase 編號是**語意**（開發階段）非**時序**（建立先後），gap 允許，因此 backfill 符合規則。
> **Created**: 2026-04-24
> **Updated**: 2026-04-24
> **Status**: Ready for `/tech-spec`

## 1. Problem Essence

### 1.1 Surface Requirement

`1-requirements.md` §9 留有兩個明確標記為 `/feasibility-study` 的 solution concerns：

- **Q8**：實作路線——純 LLM prompt template、結構化 rule-based、或混合？
- **Q9**：與 `frontend-design`／`critique` 整合——標準化 handoff doc 或各自獨立？

### 1.2 Underlying Problem

用 5-Why 展開：

1. 為什麼要決定架構？— 不同架構對 NFR-7（PII ≥ 95%）、NFR-8（理由品質 ≥ 90%）的**可達成性完全不同**
2. 為什麼 NFR-7/NFR-8 特別關鍵？— NFR-7 失敗 = security 事件；NFR-8 失敗 = skill 失去價值
3. 為什麼不能都交給 LLM？— LLM 在 deterministic 驗證（如 PII coverage）上無法保證，必須有 code-based 驗證機制
4. 為什麼不能全都規則化？— JTBD／原則應用本質上是 **context-dependent judgment**，無法窮舉規則
5. **Root**：**Determinism（PII、schema validation）** 與 **Judgment（JTBD、rationale）** 應由**不同載體**承擔——這是選擇 hybrid 架構的第一原理

### 1.3 Success Criteria

- v1 總實作成本 ≤ 6 person-days
- 不破壞專案現有 skills 架構慣例（symmetry with 既有 12 個 prompt+script hybrid skills）
- NFR-7 PII 遮罩達 ≥ 95% **由程式碼驗證**，非仰賴 LLM
- NFR-8 理由品質 ≥ 90% 有具體 fixture-based 驗證
- 輸出可被 `/frontend-design`、`/critique` 零摩擦接收

## 2. Constraints

| Type | Constraint | Source | Flexibility |
|------|-----------|--------|-------------|
| Technical | 必須符合專案 skill 平台檔案／metadata 慣例 | `1-requirements.md` §7 | None |
| Technical | 不產出可執行程式碼、不涉視覺設計、不做事後評估 | §7 三條邊界 | None |
| Technical | FR-4 固定 5 核心原則（JTBD/CLT/Hick/Miller/Progressive Disclosure） | §5 rev-4 | Low |
| Business | FR-8 v1 僅單場景 | §5 rev-4 | Low |
| Resource | 希望 v1 ≤ 6 person-days | Codex 估算 | Med |
| Security | **NFR-7 PII 遮罩 ≥ 95%，且 redact 發生在 LLM 看到 input 之前** | §6 + Codex hidden risk 1 | None |
| Security | NFR-7 須處理 address/email/token/account_id/phone/national_id | §6 | None |
| Compatibility | NFR-4 對齊既有 design-phase skills 結構 | §6 | Low |

## 3. Existing Capability Inventory

### 3.1 Related Modules

| Asset | Role | 本 skill 的複用/延伸 |
|-------|------|----------------------|
| `scripts/security-redact.js` | 2-tier secret redaction（keys/tokens/JWT/password/hex） | **需延伸**——現有覆蓋不足 NFR-7；缺 email/address/phone/national_id/account_id |
| `scripts/skills/necessity-audit/redact.js` | 在共用 redactor 之上加 domain-specific pattern（先呼叫 base redactor 再套 domain pattern） | **模式可直接搬**——本 skill 的 extension layer 採相同做法 |
| `.claude/skills/recap-doc/` | **Pre-write** redaction（Phase 4 LLM synthesis → Phase 5 redact → write file） | ⚠️ **不是 pre-analysis 前例**——我們的 NFR-7 要求 redact 發生在 LLM 看到 input *之前*，專案目前無此模式，本 skill 為新前例 |
| `.claude/skills/post-dev-recap/` | 多階段 orchestration + script | **pattern 可借鑑** |
| `.claude/skills/deep-research/` | 純 prompt 多 phase | Phase 結構模板 |
| 整個 `docs/features/<key>/` 慣例 | 輸出持久化到 repo artifact | **Q9 handoff doc 的天然容器** |

### 3.2 Design Patterns（實際驗證統計）

- 專案共 **97 skills**，其中 **12 個** SKILL.md 明確呼叫 `bash scripts/...`——hybrid 是 established pattern 但屬少數（約 12%）
- **pre-analysis redaction 為新模式**——本 skill 將是首例（`/recap-doc` 是 pre-write，不可直接套用；須參考 `necessity-audit/redact.js` 的 extension 寫法並**自行設計 pre-analysis data flow**）

### 3.3 Research Verification

| Claim | Verification Command | Result |
|-------|----------------------|--------|
| security-redact.js 無 email/address/phone/national_id | `grep -i "email\|address\|phone\|national" scripts/security-redact.js` | **Confirmed**：零命中 |
| necessity-audit/redact.js 為 extension pattern | `head -30 scripts/skills/necessity-audit/redact.js` | **Confirmed**：先呼叫 base redactor，再套 domain pattern |
| bash-script hybrid 計數 | `grep -l "bash scripts" .claude/skills/*/SKILL.md \| wc -l` | **12** |
| 總 skills 數 | `ls .claude/skills/ \| wc -l` | **97** |
| /recap-doc 的 redaction 時機 | `grep -A 5 "Phase 5" .claude/skills/recap-doc/SKILL.md` | **Pre-write**（非 pre-analysis） |

### 3.4 Tech Debt / Known Gaps

| Gap | Impact | Mitigation |
|-----|--------|-----------|
| `security-redact.js` 缺 PII class 覆蓋（email/address/phone/national_id/account_id） | 直接複用無法達 NFR-7 | 建立 `scripts/skills/ui-first-principles/redact.js` 延伸共用 redactor，補 PII patterns |
| 無 OpenAPI parser | FR-2 若支援 OpenAPI v1 需綠地開發 | v1 凍結為 `scenario + JSON sample/manual field list`，OpenAPI 推遲 v2 |
| 無 markdown output validator | NFR-4 結構一致性難保證 | 加 `scripts/skills/ui-first-principles/validate-report.js` |

## 4. Possible Solutions

### Option A: Pure LLM Prompt Template

**Core idea**：全程 LLM，SKILL.md + `references/` 即全部。

**Implementation path**：
1. SKILL.md：6-phase workflow（intake → JTBD → 原則 → 決策 → gap → output）
2. `references/principles.md` / `references/jtbd-framework.md` / `references/output-template.md`
3. Prompt 要求 LLM 辨識並遮罩 PII

**Feasibility assessment**：

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | 🟢 | 85 個 pure-prompt skills 前例 |
| Effort | 🟢 | 1–2 person-days |
| Risk | 🔴 | **致命**：LLM-only PII 辨識不可驗證達 ≥ 95%；違反 NFR-7 "redact before analysis" |
| Extensibility | 🟢 | 純 prompt 可迭代 |
| Maintenance | 🟢 | 文字修改 |

**Cost**：實作快但無法 v1 合規；適合 prototype。

---

### Option B: Structured Rule-Based

**Core idea**：重量級 scripts——API parser + 規則引擎決定優先級（field name × 場景類型 → priority），LLM 僅做 rationale 潤飾。

**Implementation path**：
1. `scripts/skills/ui-first-principles/parse-api.js`（OpenAPI + JSON sample）
2. `scripts/skills/ui-first-principles/rule-engine.js`（規則庫：`gasUsed` + `wallet` → hide 等）
3. `scripts/skills/ui-first-principles/redact.js`（延伸共用 redactor）
4. SKILL.md：引擎執行後 LLM 產生 rationale

**Feasibility assessment**：

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | 🔴 | **反直覺**：JTBD + 原則應用是 context-dependent，規則無法窮舉（`amount` 在交易 vs 儀表板優先級不同） |
| Effort | 🔴 | 8–12 person-days |
| Risk | 🟡 | 規則完備性；LLM 僅後見 rationalization 會違反 NFR-8（理由與決策脫節） |
| Extensibility | 🔴 | 每新場景類型需加規則 |
| Maintenance | 🔴 | 規則庫膨脹 |

**Cost**：綠地開發 + 規則膨脹 + post-hoc rationale drift。

---

### Option C: Hybrid（LLM judgment + Script determinism）

**Core idea**：LLM 處理 judgment-heavy；Script 處理 deterministic。

**Implementation path**：
1. SKILL.md 定義 6-phase：intake → **script: PII redact** → JTBD → 原則 → 決策 → gap → output
2. `references/principles.md`、`references/jtbd-framework.md`、`references/output-template.md`
3. `scripts/skills/ui-first-principles/redact.js`：延伸 `security-redact.js`，補 PII patterns
4. 可選：v2 再加 `parse-api.js`

**Feasibility assessment**：

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | 🟢 | 12 個 hybrid skills 前例；但 pre-analysis redaction 為新增模式 |
| Effort | 🟡 | 3–5 person-days |
| Risk | 🟢 | NFR-7 由 tested code 保障 |
| Extensibility | 🟢 | 原則／LLM prompt 都可獨立擴充 |
| Maintenance | 🟡 | prompt + 1 redact script |

**Cost**：些微 orchestration 複雜度，但換來可證明的 NFR-7 合規。

---

### Option D: Contract-First Hybrid（Codex 提出的 C 嚴謹版）

**Core idea**：在 C 的基礎上加入 **input canonicalization** 與 **output validation** 合約層。LLM 永遠看到 canonical `ScenarioBundle`，輸出經 schema validator 檢查。

**Implementation path**：
1. SKILL.md 定義 phases（同 C）
2. `scripts/skills/ui-first-principles/redact.js`：補 PII patterns（同 C）
3. `scripts/skills/ui-first-principles/normalize-input.js`：產出 canonical `ScenarioBundle`（scenario string + redacted fields array）
4. `scripts/skills/ui-first-principles/validate-report.js`：檢查
   - 每個 input 欄位皆有對應決策 row
   - 每 row 的 principle anchor 屬 5 個核心原則白名單
   - Gap report 同時含 UI→API 與 API→UI 兩方向（允許 `none`）
   - 無原始敏感值殘留
5. `references/` 三件套（同 C）

**Feasibility assessment**：

| Dimension | Rating | Notes |
|-----------|:------:|-------|
| Technical Feasibility | 🟢 | 模式清晰，無綠地技術；但 pre-analysis redaction data flow 為新前例 |
| Effort | 🟡 | 4–6 person-days |
| Risk | 🟢 | **NFR-7 由 redact.js 保障 + NFR-4 結構一致由 validator 保障**；NFR-8 仍需 fixture/rubric（validator 無法取代） |
| Extensibility | 🟢 | 合約是介面，任何 component 可替換 |
| Maintenance | 🟡 | prompt + 3 small scripts（redact + normalize + validate） |

**Cost**：v1 比 C 多約 1–2 person-days，換來 downstream consumers（`/frontend-design`、`/critique`）看到的是**契約**而非「漂亮 markdown」，介面穩定性大幅上升。

### C vs D 差異一覽

| 向度 | Option C Hybrid | Option D Contract-first Hybrid |
|------|-----------------|-------------------------------|
| 輸入處理 | `redact.js` 遮罩後直接給 LLM | `redact.js` + `normalize-input.js` 產 canonical `ScenarioBundle`（含結構化欄位清單、場景型別標記） |
| LLM 看見的資料 | 已遮罩 PII 的**原始 JSON 片段**（結構非正規化） | 已遮罩 + **已正規化**的 bundle——欄位名/型別/場景一致 |
| 輸出契約 | 「結構化 markdown」（依 template，無硬性驗證） | schema-checked markdown：每欄位有決策 row / principle anchor 屬 5 原則白名單 / 雙向 gap 皆標（允許 `none`）/ 零原始敏感值殘留 |
| 下游可驗證性 | Consumer 自行 parse markdown，格式漂移風險 | Consumer 看到**契約**，可 diff / assert / fail-fast |

---

### Q9 整合方式：Option X vs Y

| Option | Description | Assessment |
|--------|-------------|-----------|
| X: 持久化 handoff 檔 | 輸出 `docs/features/<key>/handoff-ui-first-principles.md`（採 `handoff-` 語意前綴符合 `@rules/docs-numbering.md` ancillary 規範），`/frontend-design`、`/critique` 可 `cat` 後使用 | 🟢 對齊 docs-numbering ancillary 慣例、可 diff、FR-10/11 天然滿足 |
| Y: Session-only | LLM 回覆中帶 markdown，user 手動轉給下一 skill | 🔴 違反 FR-10/11、無追溯性、session 結束即失 |

**Codex 獨立同意 Option X**，並提醒：不要占用 lifecycle 槽位 `4-implementation.md`，改用 **ancillary 語意前綴**（候選：`handoff-ui-first-principles.md` 或 `briefing-ui-first-principles.md`——前者更貼合 skill-to-skill 交付語義）。

## 5. Codex In-Depth Discussion

### 5.1 Discussion Summary

| Round | Topic | Codex 關鍵觀點 |
|-------|-------|----------------|
| 1 | 獨立架構評估 + 排名 | 與 Claude 同推 C，但提出更嚴謹變體 Option D（Contract-first hybrid） |

### 5.2 Codex 建議方向

- **推 Option D（C 的嚴謹版）**，4–6 person-days v1 + 2–3 person-days v2
- Q9 選 X，但建議用 **ancillary 命名**（非 `4-implementation.md`）
- v1 **凍結 FR-2 輸入範圍**為 `scenario + JSON sample/manual field list`，OpenAPI 推遲 v2

### 5.3 Codex 辨識的風險（Claude 初版漏掉）

| # | Risk | 影響 |
|---|------|------|
| 1 | NFR-7 要求 **redact before analysis**——LLM 不能看到原始 JSON | 必須架構性保證，不是 output 後遮罩 |
| 2 | Blunt redaction 破壞 LLM 語義（全部 `[REDACTED]`） | 應 structure-preserving mask（保留欄位名與型別） |
| 3 | 高熵遮罩會誤傷合法欄位（tx hash、account ref 在 crypto 場景是 UI 必要資訊） | 需 domain-aware exceptions 或 partial mask |
| 4 | FR-2 泛化表述會讓 tech-spec 想吃 OpenAPI+JSON+manual | v1 凍結輸入，OpenAPI 推 v2 |
| 5 | Downstream consumers 需要**穩定 schema** 不只是漂亮 markdown | 加 validator 合約 |
| 6 | `security-redact.js` 現有 pattern 不足 NFR-7 | 需延伸（非直接複用） |

### 5.4 Claude vs Codex 差異

| 觀點 | Claude 初版 | Codex | 採納 |
|------|-------------|-------|------|
| Core 問題理解 | Hybrid 是最佳 | Hybrid 的嚴謹版（合約層）才能真正滿足 NFR-4/7/8 | Codex |
| 推薦方案 | Option C | Option D（Contract-first C） | Codex |
| `security-redact.js` 複用 | 直接複用 | 必須**延伸**——現有 pattern 不足 NFR-7 | Codex |
| 輸入範圍 | FR-2 全支援（JSON/OpenAPI/手寫） | v1 凍結 JSON + 手寫，OpenAPI 推 v2 | Codex |
| 整合方式（Q9） | Option X handoff | Option X，但用 ancillary 命名 | Codex |
| Effort 估算 | 3–5 d | 4–6 d v1 + 2–3 d v2 | Codex |

### 5.5 整合結論

**採納 Codex 的 Option D（Contract-first Hybrid）+ Option X (ancillary handoff doc)**。Codex 的三個關鍵貢獻：
1. 指出 `security-redact.js` 現狀不足以覆蓋 NFR-7，必須延伸（Claude 初版誤以為可直接複用）
2. 提出 validator 合約把 "stable schema" 從 best-effort 變成**可檢驗**
3. 明確 "redact before analysis" 的架構意涵——PII 保護是 **data flow constraint** 而非 "output sanitizer"

## 6. Solution Comparison

| Dimension | A Pure LLM | B Rule-based | C Hybrid | D Contract-first Hybrid |
|-----------|:----------:|:------------:|:--------:|:-----------------------:|
| Technical Feasibility | 🟢 | 🔴 | 🟢 | 🟢 |
| Effort | 1–2d | 8–12d | 3–5d | 4–6d |
| Risk | 🔴 | 🟡 | 🟢 | 🟢+ |
| Extensibility | 🟢 | 🔴 | 🟢 | 🟢 |
| Maintenance | 🟢 | 🔴 | 🟡 | 🟡 |
| NFR-7 合規可證明性 | 🔴 | 🟢 | 🟢 | 🟢 |
| NFR-4 結構穩定性 | 🟡 | 🟢 | 🟡 | 🟢 |
| NFR-8 理由品質防線 | 🔴 | 🔴 (post-hoc drift) | 🟡 | 🟢 |

## 7. Recommendation

**Recommended**: **Option D — Contract-first Hybrid**（Option X 整合方式）

**Rationale**：
- 滿足所有 Constraints，特別是 **NFR-7 "redact before analysis"** 的 data-flow 要求
- 三層防線：redact（NFR-7）/ LLM（FR-3-6 judgment）/ validate（NFR-4 結構一致 + 零敏感值殘留）；**NFR-8 理由品質由 fixture + reviewer rubric 驗證**，validator 無法取代
- 效力比 Option C 多出 validator 層，成本只多 1–2 person-days
- Codex 獨立推薦相同方案，無歧見
- 與專案 12 個 hybrid skills 模式一致（`/necessity-audit`、`/post-dev-recap` 等採此；但 pre-analysis redaction data flow 為新前例）

**Backup**: Option C

**Applicable scenario**：若 5 person-day 預算緊張，先做 C 省略 validator，但必須在 tech-spec 中保留 D 的擴充點（output 格式設計好用到 validator 可後補）。

## 8. Open Questions

- [ ] **OQ-1（v1 遮罩政策收斂）**：extension layer 在 base redactor 之上須處理的 PII class——建議最小合規集：**email / phone / address / account_id / national_id**（`token` 已由 base 覆蓋）。national_id 建議列入，受 GDPR/CCPA 影響；除非 tech-spec 有 scope 限制理由否則預設包含
- [ ] **OQ-2（mask 格式）**：structure-preserving `<redacted:email>` 保留類型提示 vs 統一 `[REDACTED]`？前者給 LLM 更多推理信號，後者更保守；建議 tech-spec 採前者，測試證明 NFR-7 ≥ 95% 後保留
- [ ] **OQ-3（crypto 域例外）**：tx hash / 合約地址 / 代幣 id 在區塊鏈場景是 UI 必要資訊。v1 建議決策：**OQ-1 的 extension mask 加 domain-aware allow-list**（如正規化符合 `0x[0-9a-f]{40}` 的 address 不遮）；否則 NFR-8 理由品質會因為遮過頭而失真
- [ ] **OQ-4（ancillary 檔名）**：`handoff-ui-first-principles.md`（skill-to-skill 交付語義）or `briefing-ui-first-principles.md`（briefing 語義）？兩者皆是既有合法前綴，無須擴充 taxonomy。建議前者——真正消費者是下游 skill 而非人類 reader
- [ ] **OQ-5**：Validator 若檢出違規——block LLM 輸出要求重試 or 僅 warn？blocking 較嚴但延長 wall-clock（影響 NFR-5 p95 ≤ 120s）

## 9. Next Steps

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `/tech-spec` | 基於 Option D 寫 `2-tech-spec.md`；回答 OQ-1~5 |
| 2 | `/architecture` | 可選——產 `3-architecture.md` 描述三層防線資料流 |
| 3 | `/feature-dev` | 實作 SKILL.md + 3 scripts + references |
| 4 | `/post-dev-test` | 建立 NFR-7/8 fixtures（10 場景 + 20 PII samples + 50 decisions rubric）|
