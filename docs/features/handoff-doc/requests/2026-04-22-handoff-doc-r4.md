# Handoff-doc R4: Integration + E2E

> **Doc class**: Request ticket（date-prefixed non-lifecycle — per `@rules/docs-numbering.md`）
> **Created**: 2026-04-22
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)
> **Depends On**: [R1](./2026-04-22-handoff-doc-r1.md) · [R2](./2026-04-22-handoff-doc-r2.md) · [R3](./2026-04-22-handoff-doc-r3.md)
> **Siblings**: [R1](./2026-04-22-handoff-doc-r1.md) · [R2](./2026-04-22-handoff-doc-r2.md) · [R3](./2026-04-22-handoff-doc-r3.md)

## Background

整合 R1 template / R2 extractor / R3 check + redaction 為可用 skill。補 update mode 差異合併邏輯、400-line advisory marker、無 tech-spec gate。尾端做手動 e2e 自舉驗證（對 sd0x-dev-flow 自身跑 `/handoff-doc`）。本 ticket 含 T12（CLAUDE.md Command Quick Reference 更新，依賴 T11 整合完成後才能 document）。

## Requirements

- 更新 `skills/handoff-doc/SKILL.md` 串聯 workflow：
  - Create：resolve feature → read docs → extractor → compose via target profile → embed contract-index + stats → redact → write
  - Update（`--update`）：讀 existing doc → `--check` 找 Stale 段落 → prompt 使用者選重生段 → merge（保留手工段落）→ 重生必要段 → write
  - Check（`--check`）：純唯讀，delegate to `handoff-check.js`，輸出報告不改檔
- 實作 400-line overflow advisory：輸出尾端 `> **Advisory**: 文件超過 400 行，v2 將支援`--bundle`拆檔` 當觸發
- 實作「無 tech-spec gate」：當 `canonical_docs.tech_spec === null` 且無 `requests/`，gate `⚠️ Need Human` 終止不產檔
- 手動 e2e 驗證：對 sd0x-dev-flow 自身跑 `/handoff-doc sd0x-dev-flow --target integrator`（雖 sd0x-dev-flow 本身非 API service，此為 smoke test 驗 extractor 對本專案 skill / script 是否不崩）
- **T12**：更新 `CLAUDE.md` 與 `.claude/CLAUDE.md` Command Quick Reference，新增 `/handoff-doc` 條目（Description + When 欄位）
- 執行 `/skill-health-check` 對 `skills/handoff-doc/` 驗通過（AS-6 錨點）

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md 完整實作（create/update/check 三模式）+ 400-line marker + tech-spec gate + CLAUDE.md Command Quick Reference 更新（T12）+ `/skill-health-check` 驗證 + 手動 e2e smoke test |
| Out | R1/R2/R3 依賴內容（由 siblings 先行交付）/ bundle 模式（v2）/ 非 Node 專案偵測（v2） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/handoff-doc/SKILL.md` | Modify | R1 skeleton 擴為完整 workflow |
| `test/skills/handoff-doc.test.js` | Modify | 加 integration test：tech-spec gate / 400-line advisory / target 差異 |
| `CLAUDE.md` | Modify | Command Quick Reference 表新增 `/handoff-doc` 條目（T12） |
| `.claude/CLAUDE.md` | Modify | Command Quick Reference 表新增 `/handoff-doc` 條目（T12，與上保持同步） |

## Acceptance Criteria

- [ ] 對有 tech-spec 的 feature 跑 `/handoff-doc` 60 秒內產出符合 `handoff-*.md` pattern 的文件（AS-1）
- [ ] 刻意殘缺 fixture 產出文件含 `## Unknown / TBD Gaps` 段，且 grep 驗證所有 API 引用 file:line 可回溯（AS-2）
- [ ] 相同 feature 以 `--target integrator` 與 `--target maintainer` 跑，section 詳略可測量差異（AS-4）：依 tech-spec §3.4.2 `target-profiles.md` 矩陣，**兩 target 皆含 `## Quickstart`**，但 integrator 為 detailed runnable sample（含完整 call + sample payload）而 maintainer 為 brief（環境 + 啟動）；兩輸出以 `diff` 檢視至少 3 個 section 內容不同（Quickstart 行數 integrator ≥ 2× maintainer + Integration Surface 類別數量差異 + Ownership & Feedback 詳略差異）
- [ ] Update mode：第一次產出 → 手動改一段 → `--update` → 檢查手動段保留，僅 Stale 段被重生（AS-5）
- [ ] 超 400 行時文件尾端出現 advisory marker（AS-7）
- [ ] 無 tech-spec 情境 gate `⚠️ Need Human` 並終止（AS-8）
- [ ] 對 sd0x-dev-flow 自身執行 smoke test：process exit code = 0（不 crash）、輸出檔存在、`handoff-contract-index:v1` JSON 可 `JSON.parse`、contract items `>= 3`；**AS-9 runtime 錨點**：產出檔 header 四欄位皆符合 regex/enum — commit SHA `^[0-9a-f]{7,40}$`、ISO 8601 `^\d{4}-\d{2}-\d{2}T`、Contract version（值或 `n/a`）、Receiver role ∈ {integrator, maintainer, partner-external, team-transfer}
- [ ] **T12 + AS-6 錨點**：`CLAUDE.md` 與 `.claude/CLAUDE.md` 皆含 `/handoff-doc` 條目於 Command Quick Reference 表（Description + When）；產出後 auto-loop 觸發 `/codex-review-doc` 並通過（`.claude_review_state.json` 或 review log 顯示 doc_review passed）；`/skill-health-check skills/handoff-doc/` 通過
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/codex-test-review`
- [ ] Pass `/precommit`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

**Status**: Pending

## References

- Tech Spec §3.1 Architecture workflow
- Tech Spec §5 Work Breakdown → T11, T12, T13
- Tech Spec §8.1 Requirement Coverage Trace

**Task mapping**: T11（SKILL.md integration）, T12（CLAUDE.md Command Quick Reference — 自 R1 移入，依賴 T11 完成）, T13（手動 e2e smoke）
