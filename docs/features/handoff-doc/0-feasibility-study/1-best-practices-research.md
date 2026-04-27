# Best Practices Research: Handoff Document Generator

> **Doc class**: Lifecycle — Phase 0 sub-study（feasibility 研究子檔案，以 `0-feasibility-study/<N>-<topic>.md` sub-numbering 慣例存放；主檔索引位於 [`./0-feasibility-study.md`](./0-feasibility-study.md)）
> **Topic**: Cross-system handoff document best practices
> **Date**: 2026-04-22
> **Debate threadId**: `019db2f6-2fa1-7e01-bb30-76b8038cb778`
> **Verdict**: ⚠️ **WARN** — 既有類比 skills 覆蓋 ~60% 需求，須建立新 skill `/handoff-doc` 並擴充特定能力
> **Feeds into**: `/tech-spec handoff-doc`

## Phase 1: Industry Best Practices

### Sources

| # | Source | Type | Key insight |
|---|--------|------|------------|
| 1 | [Mintlify: API Developer Portals for Enterprise](https://www.mintlify.com/library/api-developer-portals-for-enterprise) | Vendor (2026) | Portal 7 evaluation areas；AI-agent readiness via llms.txt / MCP / clean Markdown |
| 2 | [Fern: API Developer Portal (Jan 2026)](https://buildwithfern.com/post/api-developer-portal-enterprise-branding) | Vendor | Audience-based filtering / RBAC、docs-as-code、CI/CD pipeline |
| 3 | [Apiable: API Integration Best Practices](https://www.apiable.io/resources/api-integration-best-practices/) | Vendor | Templated docs + interactive sandbox + unified error/auth |
| 4 | [Tyk: API Onboarding Strategies](https://tyk.io/blog/api-onboarding-strategies-for-smooth-integration-success/) | Vendor | **TTFC (Time-to-First-Call) 為 handoff 品質 north-star** |
| 5 | [Treblle: API Integration Best Practices](https://treblle.com/blog/accelerating-api-integrations-best-practices-for-faster-onboarding) | Vendor | Treat API as product，define audience first |
| 6 | [ACM Queue: Why SRE Documents Matter](https://queue.acm.org/detail.cfm?id=3283589) | Academic (SRE) | Docs hidden under tech-lead home dir 導致事故延長；中央化必要 |
| 7 | [Rootly: Modern SRE Techniques](https://webflow.rootly.com/blog/modern-sre-techniques-that-drive-proactive-reliability) | Vendor (SRE) | 強調文件老化（doc decay）是可觀測性與事故回應的盲點 |
| 8 | [Incident.io: Automated Runbook Guide](https://incident.io/blog/automated-runbook-guide) | Vendor (SRE) | 自動化 runbook 的維運價值；建議以監控/事件觸發更新 |
| 9 | [Monday: Project Handoff (2026)](https://monday.com/blog/project-management/project-handoff/) | Vendor (PM) | 8-step handoff；早規劃、正式 sign-off |
| 10 | [Multishoring: IT Project Handover Checklist](https://multishoring.com/blog/it-project-handover-checklist-steps-for-a-seamless-transition/) | Vendor (PM) | Access rights / credentials 為核心 transfer 項目 |
| 11 | [Stoplight: API Documentation Guide](https://stoplight.io/api-documentation-guide) | Vendor | Receiver-first：先定 audience，再決內容深度 |
| 12 | [DataOps: RACI Standard](https://www.thedataops.org/raci/) | Industry std | Ownership 清晰（Responsible/Accountable/Consulted/Informed）減交接歧義 |

### Best Practices Summary

| # | Principle | Source anchor |
|---|-----------|--------------|
| 1 | **Receiver-first audience declaration** — 先寫「這份給誰讀」，再決定內容深度 | Stoplight #11、Treblle #5 |
| 2 | **TTFC / Quickstart 為 north-star metric** — 接收方 5 分鐘內能跑第一個呼叫 | Tyk #4 |
| 3 | **Contract-as-first-class** — API / schema / event / auth / config / rate-limit / error codes 為 handoff 主體 | Mintlify #1、Apiable #3 |
| 4 | **Centralized discoverability** — 單一入口；避免散落多 repo/folder | ACM Queue #6 |
| 5 | **Freshness validation（test-or-rot）** — 運維文件/runbook 老化速度快於系統變更；建議自動化 freshness signal | Rootly #7、Incident.io #8 |
| 6 | **Explicit unknowns / no fabrication** — 找不到 schema 時標 TBD，不虛構 | Stoplight #11（accuracy > completeness） |
| 7 | **Ownership & feedback loop** — RACI 清楚、回報 channel 顯式 | RACI #12、Monday #9 |
| 8 | **Credential / access boundary** — 授權憑證 transfer 為高風險獨立項 | Multishoring #10 |
| 9 | **AI-agent readiness**（2026 新議題）— clean Markdown + 結構化合約索引，讓 LLM 也可消費 | Mintlify #1、Fern #2 |
| 10 | **Formal sign-off** — 正式確認 transition 完成 | Monday #9 |

### Common Anti-Patterns

| # | Anti-pattern | Harm | Source anchor |
|---|--------------|------|---------------|
| 1 | **Scattered docs**（散落多 repo/folder） | Receiver 花時間找對的 10%，且容易漏 | ACM Queue #6 |
| 2 | **Doc rot**（靜默老化 — 指令過期、URL 失效） | 造成不信任；使用者停止讀 | Rootly #7、Incident.io #8 |
| 3 | **"Nobody knows it exists"**（discoverability 問題） | 有文件 ≈ 沒文件 | ACM Queue #6 |
| 4 | **Under-stress skimming assumption** — 假設讀者知道「metrics 在哪、normal 什麼樣」 | 關鍵步驟被跳過 | ACM Queue #6、Rootly #7 |
| 5 | **No handoff on role change** — ownership drift | 交接真空期、責任不明 | Monday #9、RACI #12 |
| 6 | **Static docs 強迫 context-switch**（離開聊天/IDE 才能讀） | 低效、易漏 | Incident.io #8 |
| 7 | **Gatekeeping**（不主動分享，等人來問） | Transition 失敗率高；知識封閉 | Monday #9、Multishoring #10 |
| 8 | **Start handoff only at the end** — 沒時間 Q&A | Receiver 未消化就接手 | Monday #9 |
| 9 | **Dumping everything 內部細節** — receiver 看到技術債、廢棄 API | 誤用、誤整合 | Stoplight #11、Treblle #5 |
| 10 | **Fabricated contracts** — 找不到 schema 就編一個 | 幻覺合約造成下游破損 | Stoplight #11（accuracy principle） |

## Phase 2: Current Implementation Analysis

**Effective scope**: `skills/{tech-brief,runbook,recap-doc}/` + `scripts/config/doc-taxonomy.json`（repo-relative）

### Compliant Items（可直接重用的既有 pattern）

| # | Best Practice | Current Implementation | Status |
|---|---------------|----------------------|--------|
| 1 | Feature context resolution | `skills/tech-brief/SKILL.md:68` + `scripts/resolve-feature-cli.js`（behavior + code layer cascade） | OK |
| 2 | Provenance / SHA freshness | `skills/runbook/SKILL.md:131-143`（`<!-- runbook-provenance -->`） | OK |
| 3 | Staleness `--check` mode | `skills/runbook/SKILL.md:144-152` | OK |
| 4 | Secret redaction（2-tier） | `scripts/security-redact.js` via `skills/recap-doc/SKILL.md:95` | OK |
| 5 | Internal URL / env 符號替換 | `skills/runbook/SKILL.md:117-122`（`${ENV_VAR_NAME}` / `<internal-endpoint>`） | OK |
| 6 | Depth levels（brief/normal/deep） | `skills/tech-brief/SKILL.md:110-118` + `skills/recap-doc/SKILL.md:100-108` | OK |
| 7 | Blind-spot detection（Must） | `skills/recap-doc/SKILL.md:90`（FR-9） | OK |
| 8 | Anticipated questions / FAQ | `skills/recap-doc/SKILL.md:91` | OK |
| 9 | Taxonomy registration for `handoff` | `scripts/config/doc-taxonomy.json`（`"id": "handoff"`，semantic_pattern `^handoff-` 或 `交接`） | OK |

### Concerns（缺口）

| # | Best Practice | Current | Gap |
|---|---------------|---------|-----|
| G1 | Receiver-role targeting（integrator/maintainer/partner-external/team-transfer） | 三個類比 skill 皆隱性預設「內部同事」 | **完全缺** — 影響內容選擇與詳略 |
| G2 | TTFC / Quickstart block | 無 | **完全缺**；handoff 品質 north-star |
| G3 | Integration surface extraction（API/schema/event/auth/config/rate-limit/error-codes） | 無系統化抽取器 | **完全缺**；需專用 discovery |
| G4 | Header-visible freshness metadata | runbook 只有 internal provenance | **部分** — 需升級為 receiver-visible |
| G5 | Receiver feedback loop（owner / channel / SLA） | 無 | **完全缺** |
| G6 | Machine-readable contract index（for agent/LLM receiver） | 無 | **完全缺**；2026 新議題 |
| G7 | "Missing contract" explicit gate — TBD 標示而非虛構 | `recap-doc` blind-spot 最接近 | **部分** — 需域化為合約級偵測 |
| G8 | Contract-level freshness validation | runbook `--check` 接近 | **部分** — 須擴至 contract-index 層級 |

## Phase 3 Evidence（mandatory — proves debate was executed）

- **Debate command**: `/codex-brainstorm`
- **Debate threadId**: `019db2f6-2fa1-7e01-bb30-76b8038cb778`
- **Debate rounds**: Early Nash equilibrium at Round 2（≥3 rounds rule 以 equilibrium 提前出場替代，符合 `references/debate-guide.md` completion criteria）

## Debate Conclusion（mandatory — references Phase 3 equilibrium）

### Round 1 — Independent positions

- **Claude position**: Extend-don't-rewrite — 同骨架 + receiver-first section 順序 + Integration Surface block + audience-aware depth；AI-agent readiness 延 v2；tiering sender 自理。
- **Codex position**: **New doc contract + reused engine** — 新 skeleton 是 output invariants 不同（contract-completeness + gap-surfacing + quickstart），並非 plumbing 重寫；v1 minimal machine-readable anchor + sender policy profiles。

### Round 2 — Convergence after mutual concessions

| 議題 | Claude 讓步 | Codex 讓步 | 共識 |
|------|------------|------------|------|
| 結構新穎性 | 接受「new section contract + mandatory acceptance tests」在 content 層確實新穎 | 撤回「materially un-templatable」強宣稱；承認 plumbing 是 extend-style | **新 skill folder + reused engine + 新必填 section contract** |
| AI-agent readiness | 接受 project-local `<!-- handoff-contract-index:v1 {...} -->` JSON + SHA-tracked | 撤回 `llms.txt` 外部標準依賴 | **v1 contract-index anchor（HTML comment，SHA-tracked，reuse provenance 機制）** |
| Tiering | 維持 sender 層 | 撤回 `certified\|standard` redaction tier | **FR-5 audience targeting only；access enforcement 屬 distribution** |
| Bundle | 接受 400 行 advisory overflow marker | 接受 v1 不實作 bundle mode | **單檔預設 + advisory marker**；bundle 留 v2 |
| `--check` 範圍 | 主張 (a) 合約 focused | 加議 citation integrity sanity | **v1 = contract freshness strict + citation integrity 輕量檢查** |
| Freshness metadata | 提議雙軌 | 同意 | **header human-readable + internal manifest** |

### Equilibrium state: Nash equilibrium

Neither party can unilaterally strengthen their position without sacrificing an already-won concession. Debate concluded at Round 2.

### Transcript Excerpts（可審計證據）

**Round 1 — Codex 對 extend-only 的強攻擊**：
> "Internal templates optimize for producer narrative (what we built) or operations execution (how to release), not consumer activation (how to integrate safely and quickly). Without a dedicated handoff skeleton, target-audience differentiation (integrator vs maintainer vs partner-external) becomes ad hoc branching rather than a first-class document contract."

**Round 2 — Codex 接受重寫從「llms.txt → project-local contract-index」**：
> "I agree llms.txt should not be the v1 dependency. My v1 anchor should be a repo-local, stable format: JSON block in HTML comment, e.g. `<!-- handoff-contract-index:v1 {...} -->`. Each contract entry carries `source_file` + `source_sha`; `--check` diffs hashes."

**Round 2 — 雙方同意 `status` 欄位為 no-fabrication 保護**：
> "Missing contract failure mode: agree — emit `status:\"unknown\"` entry, never omit (aligned with no-fabrication intent in 1-requirements.md:66 and gap reporting in 1-requirements.md:68)."

**Round 2 — Claude 承認「extend vs new」語義差異**：
> "Accept your refined phrasing: 'new skill folder + reused engine + new required section contract + handoff-specific acceptance tests'. We're saying the same thing with different rhetoric."

## Gap Analysis

| # | Best Practice | Current State | Gap | Priority | Recommended Action |
|---|---------------|---------------|-----|----------|-------------------|
| 1 | Receiver-role targeting | 全缺 | 全缺 | **P1** | `--target integrator\|maintainer\|partner-external\|team-transfer`（FR-5），決定必填 section 強度與詳略 |
| 2 | TTFC / Quickstart | 全缺 | 全缺 | **P1** | 強制區塊：環境 / 認證 / 第一個可執行呼叫 + 預期回應 |
| 3 | Integration Surface extraction | 全缺 | 全缺 | **P1** | 專用 discovery：掃 Node/TS route + schema + event + auth + rate-limit + error-code，每項產 `file:line` back-ref |
| 4 | Contract-index anchor `<!-- handoff-contract-index:v1 {...} -->` | 無 | 全缺 | **P1** | JSON in HTML comment，`contracts[]` 欄位：`id/type/format/source_file/source_sha/source_ref/status`；`status: known\|unknown`，缺合約不略過只標 unknown |
| 5 | `--check` 合約 freshness | runbook pattern 接近 | 擴展 | **P1** | reuse runbook SHA 機制；v1 同時加 citation integrity（file:line 是否仍 resolve） |
| 6 | Header-visible freshness metadata | internal only | 升級 | **P1** | Header 顯示 commit SHA / ISO 8601 / contract version / receiver-role（FR-15） |
| 7 | Ownership & Feedback（owner / channel / SLA） | 全缺 | 全缺 | **P1** | 必填 section；FR-13 |
| 8 | Unknown/TBD Gaps（no-fabrication） | blind-spot 類似 | 域化 | **P1** | 必填 section；列出缺 schema / 缺 sample / 缺 auth；FR-8/FR-6 |
| 9 | `<!-- handoff-stats -->` observability block | 全缺 | 全缺 | **P2** | 三計數必出現：引用文件數 / surface 覆蓋項 / 未解 OQs（NFR-9） |
| 10 | 400-line advisory overflow marker | 全缺 | 全缺 | **P2** | 輸出尾端建議；bundle mode 留 v2 |
| 11 | Secret + internal-URL redaction | secret OK；internal-URL partial | 強化 | **P1** | Reuse `security-redact.js` + 擴 internal URL / 內網主機 pattern（FR-10）|
| 12 | AI-agent advanced packaging（llms.txt / MCP / OpenAPI bundle） | 全缺 | defer | **P3** | v2；先看 v1 contract-index 採用度 |
| 13 | Access tiering（certified vs standard） | 全缺 | defer | **P3** | 不進 skill；由 distribution channel 處理 |

## Recommended Roadmap

| Priority | Action Item | Impact Scope | Estimated Effort |
|----------|-------------|--------------|-----------------|
| P1 | 建立 `skills/handoff-doc/SKILL.md` 骨架 + 6 必填 section 模板 + contract-index anchor 規格 | New skill | **M**（~1 工作日） |
| P1 | 實作 Integration Surface discovery heuristics（route / schema / event / auth / config / rate-limit / error-code）；掃 Node/JS/TS 為主 | New references/ 檔 | **L**（~2 工作日，含 edge case） |
| P1 | Reuse + 擴展 `runbook` provenance manifest → contract-index SHA tracking；`--check` 支援 | 共享機制 | **S**（~半天；pattern 已有） |
| P1 | Secret + internal-URL redaction：擴 `security-redact.js` 加 handoff-specific patterns | 共享基建 | **S**（~半天） |
| P1 | Header freshness metadata（FR-15） + Unknown/TBD Gaps + Ownership/Feedback section（FR-13） | Template | **S** |
| P2 | `<!-- handoff-stats -->` observability 區塊（NFR-9） | Template | **S** |
| P2 | 400-line advisory overflow marker | Behavior | **S** |
| P2 | `--target` audience profile 驅動 section 詳略矩陣 | Behavior | **M** |
| P3 | Bundle mode（main + api-contract.yaml + samples/） | v2 scope | **L**（非 v1） |
| P3 | AI-agent advanced（llms.txt / MCP 曝露） | v2 scope | **M**（非 v1） |
| P3 | Access tiering（certified / standard） | 不進 skill | **N/A** |

## References

### Industry sources

1. [Mintlify: API Developer Portals for Enterprise](https://www.mintlify.com/library/api-developer-portals-for-enterprise)
2. [Fern: API Developer Portal](https://buildwithfern.com/post/api-developer-portal-enterprise-branding)
3. [Apiable: API Integration Best Practices](https://www.apiable.io/resources/api-integration-best-practices/)
4. [Tyk: API Onboarding Strategies](https://tyk.io/blog/api-onboarding-strategies-for-smooth-integration-success/)
5. [Treblle: Accelerating API Integrations](https://treblle.com/blog/accelerating-api-integrations-best-practices-for-faster-onboarding)
6. [ACM Queue: Why SRE Documents Matter](https://queue.acm.org/detail.cfm?id=3283589)
7. [Rootly: Modern SRE Techniques](https://webflow.rootly.com/blog/modern-sre-techniques-that-drive-proactive-reliability)
8. [Incident.io: Automated Runbook Guide](https://incident.io/blog/automated-runbook-guide)
9. [Monday: Project Handoff](https://monday.com/blog/project-management/project-handoff/)
10. [Multishoring: IT Project Handover](https://multishoring.com/blog/it-project-handover-checklist-steps-for-a-seamless-transition/)
11. [Stoplight: API Documentation Guide](https://stoplight.io/api-documentation-guide)
12. [DataOps: RACI](https://www.thedataops.org/raci/)

### Project sources

- Requirements: [`../1-requirements.md`](../1-requirements.md)
- Analog skills: [`skills/tech-brief/SKILL.md`](../../../../skills/tech-brief/SKILL.md), [`skills/runbook/SKILL.md`](../../../../skills/runbook/SKILL.md), [`skills/recap-doc/SKILL.md`](../../../../skills/recap-doc/SKILL.md)
- Taxonomy: [`scripts/config/doc-taxonomy.json`](../../../../scripts/config/doc-taxonomy.json) → `"id": "handoff"`
- Redaction: [`scripts/security-redact.js`](../../../../scripts/security-redact.js)
- Resolver: [`scripts/resolve-feature-cli.js`](../../../../scripts/resolve-feature-cli.js)

### Contract-Index Schema Snapshot（v1）

```json
{
  "version": "v1",
  "contracts": [
    {
      "id": "auth-login-v1",
      "type": "api|event|schema|auth|config|env|rate-limit|error-code",
      "format": "openapi|json-schema|asyncapi|text|n/a",
      "source_file": "src/routes/auth.ts",
      "source_sha": "abc123...",
      "source_ref": "src/routes/auth.ts:42",
      "status": "known|unknown"
    }
  ]
}
```

Embedded as HTML comment：`<!-- handoff-contract-index:v1 { ... } -->`
