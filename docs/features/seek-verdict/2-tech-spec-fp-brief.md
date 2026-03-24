# First-Principles Briefing: seek-verdict v2 — Independent Second-Opinion Verification

> Source: docs/features/seek-verdict/2-tech-spec.md
> Depth: normal
> Format detected: tech-spec (confidence: high)
> Verify: off
> Redaction scan: passed (no secret patterns detected)
> Generated: 2026-03-24T04:15:00Z

## 1. Root Problem

### Surface Problem

v1 的 `/seek-verdict` 被限制只能用於 P2 dismiss，但實際使用場景已超出此範圍 — `load-pr-review` 被迫將所有 thread 硬編碼為 P2 以繞過 severity gate。

### First-Principles Decomposition

Source: §1 Requirement Summary, §3.3 Asymmetric threshold 理由, Appendix: Design Decision Record

1. **Why** 需要 seek-verdict？→ Code review 會產出 false positive，需要獨立第二意見來驗證
2. **Why** 需要獨立驗證（而非人工判斷）？→ 人工判斷有 anchoring bias；同一個 reviewer 難以推翻自己的判定
3. **Why** 必須是 blind verification？→ 如果 verifier 看到原始判斷的結論，會被錨定效應影響，驗證變成橡皮圖章
4. **Why** v1 的 P2-only 限制不夠？→ False positive 不只發生在 P2 — P1 也會出現（例：lint damage 被誤報為 shell injection），但 severity gate 阻止了合法的驗證需求
5. **Why** 不能簡單地移除 severity gate？→ P0/P1 的 false negative（漏掉真正的問題）代價遠高於 P2，需要差異化的安全機制

### Fundamental Truth
>
> **驗證的價值來自獨立性，而獨立性的保證強度必須與風險成正比**。低風險（P2/Nit）可以自動化驗證；高風險（P0/P1）的獨立驗證需要人類作為最終 gate，因為自動化系統的信心校準尚未足夠可靠。

## 2. Assumptions Register

| # | Assumption | Source Section | Confidence | If Wrong... |
|---|-----------|---------------|------------|-------------|
| A1 | Codex 在 fresh thread 中可以獨立、不帶偏見地進行驗證 | §3.1 Architecture, §R1 Risk | High (explicitly enforced via anti-anchoring prompt) | 整個 skill 的核心價值崩潰；需改用完全不同的 verification 機制 |
| A2 | Confidence score (0.0-1.0) 是 Codex 判定可靠性的有效指標 | §3.3 Phase C Policy Mapping | Medium (no calibration data cited) | Threshold 設定失去意義；可能放過真問題或誤殺正確 dismiss |
| A3 | P0/P1 的 false negative 代價顯著高於 P2 | §3.3 Asymmetric threshold 理由 | High (industry consensus) | Graduated thresholds 不必要；可用統一 threshold |
| A4 | 人類在同一 session 中可以做出可靠的 P0/P1 dismiss 確認 | §3.3 P0/P1 Human Gate Protocol | Medium (人類也有 anchoring bias) | Human gate 變成形式主義；需要更強的獨立機制 |
| A5 | Anti-abuse guard（3 連續 dismiss 警告）足以防止 over-dismiss | §3.6 Anti-Abuse Guard | Medium (無實證數據支持閾值選擇) | 使用者可能系統性地繞過 guard |
| A6 | Backward-compatible additive field strategy 可以讓 v1 → v2 無縫遷移 | §3.5 Audit Trail Format | High (標準 key-value parsing) | 需要 version header 或 breaking change migration |

## 3. Reasoning Chain

### Decision D1: Intent-based generalization（而非簡單移除 severity gate）

- **Principle**: 不同的驗證目的需要不同的結果語義和授權模型（A3: risk-proportional independence）
- **Reasoning**: 單純移除 severity gate 無法區分「我認為這是 false positive」（dismiss）和「我想確認這個問題真的存在嗎」（confirm）。三種 intent 用不同的 verdict enum 和授權效果，精確匹配使用者的實際需求
- **Source**: §3.3 Phase C, Appendix: Decision v2 Intent-Based Generalization

### Decision D2: Fresh Codex thread（而非 review thread continuation）

- **Principle**: Blind verification 的核心價值來自驗證者的獨立性（Fundamental Truth）
- **Reasoning**: 如果在原始 review thread 中繼續，Codex 已有對該 finding 的既有判斷，anchoring bias 使驗證無效。Fresh thread = 零前置假設
- **Source**: §3.1 Architecture, Appendix: Fresh Thread vs Review Thread

### Decision D3: P0/P1 Human Gate（而非全自動 dismiss）

- **Principle**: 自動化 confidence 校準尚不可靠；高風險決策需人類 override（A3 + A4）
- **Reasoning**: P0/P1 的 false negative 代價極高。即使 Codex confidence = 0.95，仍產出 `DISMISS_CANDIDATE`（非 `DISMISS_VERIFIED`），強制人類在下一個 prompt 確認。`⚠️ Need Human` 整合進 auto-loop exit condition，不違反其禁止暫停規則
- **Source**: §3.3 Graduated Thresholds, §R3 Risk

### Decision D4: 1-round rebuttal 上限

- **Principle**: 有限辯論優於無限辯論（avoid stall）和零辯論（miss counter-evidence）
- **Reasoning**: 1 輪 counter-evidence 允許 Claude 提供客觀證據（測試、spec），但禁止無限辯論。如果 1 輪後仍 ambiguous → `NEED_HUMAN`，不自動解決
- **Source**: §3.4 Rebuttal Mechanism

### Decision D5: Per-finding cap for confirm/clarify intent

- **Principle**: Informational 查詢不應成為拖延修復的工具（A5 anti-abuse 理由延伸）
- **Reasoning**: 同一 finding 在同一 commit 上最多 1 次 confirm + 1 次 clarify。Counter key 含 `head_sha`，新 commit 自動重置
- **Source**: §3.6 Anti-Abuse Guard

### Decision D6: Backward-compatible audit trail format

- **Principle**: 向後相容 > 格式完美（A6）
- **Reasoning**: `intent=` 和 `authorization=` 作為 additive fields 放在行尾。v1 parser 使用 `|` split + key lookup，忽略未知 key。不需要 version header 或 breaking change
- **Source**: §3.5 Audit Trail Format

## 4. Alternative Rejection Log

Source: Appendix: Design Decision Record (§Optional vs Mandatory, §Fresh Thread vs Review Thread, §v2 Intent-Based Generalization), §R4-R5 Risks

| # | Alternative | Rejected Because | First-Principle Basis |
|---|-----------|-----------------|----------------------|
| R1 | Keep P2-only gate | load-pr-review forced to hardcode P2; P1 false positives unresolvable | Violates A3 — risk-proportional independence requires covering all severities |
| R2 | Full auto-dismiss for all severities | P0/P1 safety risk; confidence not calibrated enough | Violates Fundamental Truth — high-risk needs human gate, not just higher thresholds |
| R3 | Use review thread continuation for verification | Codex has existing judgment in review context → anchoring | Violates A1 — independence requires zero prior context |
| R4 | Mandatory integration in auto-loop | Increases review loop latency; auto-loop rule change has large blast radius | User explicitly requested optional; data-first validation approach preferred |
| R5 | Unlimited rebuttal rounds | Risk of infinite debate and stalling | Violates D4 principle — bounded debate prevents deadlock |
| R6 | Free-text verdict for clarify intent | Not parseable; breaks deterministic enum contract | Violates A6 — backward compat requires structured fields |

## 5. Decision Sensitivity

Source: Cross-analysis of §2 Assumptions Register × §3 Reasoning Chain

| Assumption | If Wrong → Affected Decisions | Impact |
|-----------|------------------------------|--------|
| A1 (Codex independence in fresh thread) | D2 (fresh thread), D1 (intent model), D3 (human gate) | **High** — entire skill's value proposition collapses; need fundamentally different verification mechanism |
| A2 (Confidence score reliability) | D3 (graduated threshold values), D1 (intent-based policy mapping relies on continuous scores) | **High** — all graduated thresholds become meaningless; may need categorical (yes/no) instead of continuous scores |
| A3 (P0/P1 higher false negative cost) | D3 (human gate), D1 (graduated thresholds) | **Medium** — if costs are similar across severities, can simplify to uniform threshold |
| A4 (Human reliable for P0/P1 confirm) | D3 (human gate design) | **Medium** — if human gate is rubber-stamp, need stronger mechanism (e.g., mandatory fix + seek-verdict after fix) |
| A5 (Anti-abuse guard sufficient) | D5 (per-finding cap depends on guard effectiveness), Anti-abuse escalation (§3.6 heightened thresholds) | **Low** — can adjust thresholds from audit trail data; guard is behavior-layer, easy to tune |
| A6 (Additive field backward compat) | D6 (audit trail format) | **Low** — if parsing breaks, add version header; scope of change is small |

## 6. Open Unknowns

| # | Unknown | Source | Risk Level | Suggested Resolution |
|---|---------|--------|------------|---------------------|
| U1 | Confidence threshold 校準是否準確（0.80/0.90/0.95 是否能有效區分 true/false positive） | Inferred from A2 — no calibration data cited | High | 累積 audit trail 資料後進行 threshold calibration；初期 conservative 設定 |
| U2 | Human gate 在 P0/P1 dismiss 中的實際行為 — 使用者是否會仔細審查還是快速確認 | §Q5, A4 | Medium | 可在 audit trail 中加入 `response_latency_ms` 指標，追蹤確認速度作為形式主義的 proxy signal |
| U3 | load-pr-review 移除 P2 hack 後的 severity derivation 策略 | §Q6 | Medium | 建議用 reviewer 的 severity classification；fallback P2 |
| U4 | Per-project 可配置 threshold 的需求強度 | §Q2 | Low | 初期固定值；如有 3+ 專案要求，升級為 config |
| U5 | `[DISMISS_VERDICT]` 是否需要持久化至檔案系統 | §Q3 | Low | 暫不寫入；遵循 session output 日誌模式 |
