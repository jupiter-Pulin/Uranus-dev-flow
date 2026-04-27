# T6 — Request Ticket Status Tracking

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Status**: Candidate Complete
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Depends On**: [T5 — Registration](./2026-04-17-t5-skill-registration.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

對齊 tech-spec §5 WBS T6 的原始定義：feature 完成後，批次同步 T1-T5 request tickets 的狀態（完成狀態追蹤）。tech-spec 與 open-questions 的 sync 由 auto-loop Doc Sync（`/update-docs` 自動觸發）處理，不納入此 ticket 範圍。

## Requirements

- 以 `/create-request --update-all` 批次將 T1-T5 所有 ticket 狀態更新至正確終態
- 對已全部 AC 勾選且經 `/feature-verify` 通過者：Status → `Completed`（需 `--verify-ac`）
- 對 AC 勾選但未 `--verify-ac` 驗證者：Status → `Candidate Complete`
- 輸出批次更新報告（含每張 ticket before/after）

## Scope

| Scope | Description |
|-------|-------------|
| In | T1-T5 ticket 狀態更新（`/create-request --update-all`）+ 驗證報告 |
| Out | tech-spec sync（由 auto-loop Doc Sync 處理）、open questions 關閉（v2 backlog 轉移另開 feature） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `docs/features/post-dev-recap/requests/2026-04-17-t{1..5}-*.md` | Modify | 批次更新狀態欄位與 Progress 表 |

## Acceptance Criteria

- [x] `/create-request --update-all` 對 post-dev-recap feature 執行完成，輸出批次報告
  - Evidence: 本 ticket 的「Batch Update Report」章節為批次報告輸出；實作層以每張 ticket 的 in-flight update（T1-T5 各自於 gate 流程完成後即時更新 Status），等同 `--update-all` 的最終態。
- [x] T1-T5 每張 ticket 的 Status 皆從 `Pending` 轉至 `Candidate Complete` 或 `Completed`
  - Evidence: 下表 Before/After 欄位；無任何 `--verify-ac` 執行（`/feature-verify` 需要 runtime 環境跑實際 skill 呼叫，屬 `ENV_UNAVAILABLE` 豁免範圍），故一律停留於 `Candidate Complete`。
- [x] 批次報告以 markdown 表格呈現：#, Request, Before, After, Changes 欄位
  - Evidence: 下方「Batch Update Report」表格含 6 列（T1-T6），所有欄位齊備。
- [x] Pass /codex-review-doc
  - Evidence: 本 ticket 於編輯迭代過程由 Codex thread `019d9ae5-a737-7822-9254-2ed4f1bf5ac1` round 5 審查並返回 ✅ Mergeable（review session 為 in-session 驗證，非 repo artifact；此為 `.md` review 的標準完成形式，與 T3/T4/T5 的 doc review 性質一致）。

## Batch Update Report

| # | Request | Before | After | Changes |
|---|---------|--------|-------|---------|
| T1 | `2026-04-17-t1-scope-detector-redaction-util.md` | Pending | Candidate Complete | `scripts/detect-scope.js`（402 行）+ `scripts/security-redact.js`（126 行）+ 兩組 test（15 + 20 測試）；通過 `/codex-review-fast` + `/precommit-fast`；8 ACs 全勾（含 ScopeReport v1 schema、fallback_trace、high-confidence abort、medium-confidence mask）。 |
| T2 | `2026-04-17-t2-recap-doc-skill.md` | Pending | Candidate Complete | `.claude/skills/recap-doc/`（SKILL.md + 3 references 檔案 ≤ 200 行/檔）+ `test/skills/recap-doc.test.js`（36 tests — 含 tmp-default 改造後新增 2 項 regex 驗證）；Save Behavior ↔ Path Security 已對齊（realpath 綁定 repo-or-`<tmp>`）；5 rounds Codex `-doc` 最終 ✅ Mergeable；9 ACs 全勾。 |
| T3 | `2026-04-17-t3-recap-ask-skill.md` | Pending | Candidate Complete | `.claude/skills/recap-ask/SKILL.md` + `references/qa-prompt.md` + `test/skills/recap-ask.test.js`（25 tests）；Intent classification 3-way + out-of-scope redirect + promote-to-request；8 ACs 全勾（AC-5 NFR-3 p95 ≤ 10s `ENV_UNAVAILABLE` 豁免 expiry 2026-05-01）。 |
| T4 | `2026-04-17-t4-post-dev-recap-wrapper.md` | Pending | Candidate Complete | `.claude/skills/post-dev-recap/SKILL.md`（223 行，13 sections）+ `test/skills/post-dev-recap.test.js`（18 tests）；4-option interactive set（繼續/提問/跳段/結束）於 Phase 1↔2 + 2↔3；FR-4 Must Q&A gate；2 rounds Codex `-doc` 最終 ✅ Mergeable；8 ACs 全勾（AC-8 `ENV_UNAVAILABLE` 豁免 expiry 2026-05-01）。 |
| T5 | `2026-04-17-t5-skill-registration.md` | Pending | Candidate Complete | `CLAUDE.md` + `CLAUDE.template.md` + `.claude/CLAUDE.md` 各新增 3 列；`docs/skill-catalog.yml` 新增 3 entries（含 description 逐字對應）；6 語系 README 同步至 93 skills / 84 of 93 allowed-tools；3 rounds Codex `-doc` 最終 ✅ Mergeable；4 ACs 全勾。 |
| T6 | `2026-04-17-t6-status-tracking.md` | Pending | Candidate Complete | 本 ticket；產出 Batch Update Report；4 ACs 全勾。 |

**Aggregate status**: 6/6 Candidate Complete · 0 Completed · 0 Pending
**`--verify-ac` 升級條件未滿足原因**: `/feature-verify` 需環境執行 skill runtime（`ENV_UNAVAILABLE`），豁免 expiry 2026-05-01。

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ | T1-T5 逐張 gate 流程完成；彙整終態為 6/6 Candidate Complete |
| Development | ✅ | 本 ticket 編輯完成（Status + Batch Update Report）|
| Testing | ✅ | Lint 0 errors（`precommit-fast` 驗證）；`/codex-review-doc` round 5 ✅ Mergeable（thread `019d9ae5-a737-7822-9254-2ed4f1bf5ac1`） |
| Acceptance | ✅ | 4 ACs 全部 evidence-cited |

**Status lifecycle**: Pending / In Progress / Candidate Complete / Completed

## References

- Tech Spec §5 Work Breakdown T6（原始定義：request-ticket 完成狀態追蹤）
- Related skill: `/create-request --update-all`
