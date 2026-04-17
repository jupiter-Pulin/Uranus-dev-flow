# T3 — `/recap-ask` Skill

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

`/recap-ask` 為 Shape B+D Hybrid 的 Q&A sub-skill，負責把已產出的 recap doc 作為 primary context，支援使用者針對本輪變更追問，並在問題超出 recap 範圍時主動轉介 `/ask`（FR-4、FR-5、FR-8）。可與 T1/T2 平行開發（非 blocker）。

## Requirements

- 實作 `.claude/skills/recap-ask/SKILL.md`（intent classification + context binding）
- Q&A context 以 recap doc 全載入為 primary，lazy-fetch 被引用的 file:line
- 超出 recap 範圍的問題：主動轉介 `/ask`（default 行為，非嚴格拒答）
- 結束時提示 promote；同意後呼叫 `/create-request --update` 寫回（NFR-5）
- 重用 `/ask` Phase 2 context gathering pattern（NFR-5）

## Scope

| Scope | Description |
|-------|-------------|
| In | `.claude/skills/recap-ask/` SKILL.md + qa-prompt + 對應 integration test |
| Out | Scope detection（T1）、recap doc 產出（T2）、wrapper 整合（T4） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude/skills/recap-ask/SKILL.md` | New | 主 skill 定義 |
| `.claude/skills/recap-ask/references/qa-prompt.md` | New | Q&A prompt + intent classification rules |
| `test/skills/recap-ask.test.js` | New | Integration test：context binding、out-of-scope redirect、promote 流程 |

## Acceptance Criteria

- [x] `/recap-ask <q> --context <recap-path>` 可針對 recap 內容回答並引用 file:line（AS-4） — `test/skills/recap-ask.test.js:120` (Output Format + Sources + `<path>:<line>`)
- [x] 偵測到 out-of-scope 問題時，**先輸出簡短聲明「此問題超出本輪 recap 範圍」再附 `/ask` 調用範例**（明確行為避免實作歧義；Q3 default） — `test/skills/recap-ask.test.js:158`
- [x] intent classification 三類（recap-scoped / out-of-scope / ambiguous）行為正確，ambiguous 觸發 `AskUserQuestion` — `test/skills/recap-ask.test.js:144`
- [x] 結束階段提示 promote；同意時呼叫 `/create-request --update`（AS-11） — `test/skills/recap-ask.test.js:234`
- [x] Q&A 首 token 延遲 p95 ≤ 10s（NFR-3） — `test/skills/recap-ask.test.js:250` (structural declaration; runtime measurement is ENV_UNAVAILABLE)
- [x] Lazy-fetch 被引用檔案前：路徑 `startsWith(repo_root + "/")` 檢查，拒絕 `..` traversal 與外部 symlink（NFR-8） — `test/skills/recap-ask.test.js:99,199,215`
- [x] 回覆內容經 `security-redact.js` 過濾（NFR-7） — `test/skills/recap-ask.test.js:186`
- [x] Pass /codex-review-fast — Dual-review (Codex + secondary) concluded ✅ Ready after P2/Nit Quality Sweep on 2026-04-17

**Exception log**:
- `[AC_EXCEPTION] AC-5 (NFR-3 p95 ≤ 10s) reason=ENV_UNAVAILABLE — runtime latency cannot be measured in static structural tests; declaration-level assertion is the structural surrogate until runtime telemetry lands. expiry=2026-05-01T00:00:00+08:00 VALID`

**Status lifecycle**: Pending / In Progress / Candidate Complete / Completed

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ | Scope, ACs, reuse anchors mapped per plan `glittery-marinating-donut.md` |
| Development | ✅ | `skills/recap-ask/SKILL.md` (+190 lines) + `references/qa-prompt.md` (+170 lines). Dual review (Codex + secondary) → ✅ Ready after P2/Nit sweep |
| Testing | ✅ | `test/skills/recap-ask.test.js` 25 passing tests; full suite 1361/1363 pass (2 skipped, 0 fail) |
| Acceptance | ⚠️ | Adequacy Gate: ⚠️ Adequate with exceptions (1/1 cap; AC-5 ENV_UNAVAILABLE valid). `/precommit-fast` ✅ PASS |

## References

- Tech Spec §3.4.3 `/recap-ask` Q&A 流程
- Requirements FR-4, FR-5, FR-8, NFR-3, NFR-5, NFR-7
- Reuse anchor: `.claude/skills/ask/SKILL.md` L76-92
