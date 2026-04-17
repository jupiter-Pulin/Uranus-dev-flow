# T4 — `/post-dev-recap` Wrapper Skill

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`).
> **Created**: 2026-04-17
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Depends On**: [T1](./2026-04-17-t1-scope-detector-redaction-util.md), [T2](./2026-04-17-t2-recap-doc-skill.md), [T3](./2026-04-17-t3-recap-ask-skill.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

`/post-dev-recap` 為使用者入口的 wrapper skill（Shape B+D Hybrid），串接 `detect-scope.js → /recap-doc → /recap-ask` 三段流程，並提供 FR-6 逐步互動導覽模式（`--interactive`，opt-in）。Q&A 階段為 FR-4 Must，一律進入。

## Requirements

- 實作 `.claude/skills/post-dev-recap/SKILL.md`
- Signature：`/post-dev-recap [<focus>] [--interactive] [--depth brief|normal|deep]`
- 互動模式採 `AskUserQuestion` per-step（繼續/提問/跳段/結束）
- Q&A Phase 3 為 Must（不提供 `--no-qa` flag；若只要文件請使用者直接呼叫 `/recap-doc`）
- Scope detection 失敗時輸出 ⚠️ Need Human + `fallback_trace`

## Scope

| Scope | Description |
|-------|-------------|
| In | `.claude/skills/post-dev-recap/` SKILL.md + 對應 integration test |
| Out | Sub-skill 本體（T1-T3）、registration（T5） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.claude/skills/post-dev-recap/SKILL.md` | New | Wrapper skill 定義 |
| `test/skills/post-dev-recap.test.js` | New | Integration test：wrapper 串接、interactive flow、Q&A 強制性、scope-fail 路徑 |

## Acceptance Criteria

- [x] 無參數執行成功偵測並串接 T1→T2→T3 三段（AS-1） — `test/skills/post-dev-recap.test.js:59` Phase declarations + `:79` strict Phase 1<2<3 ordering + detect-scope in Phase 1 body
- [x] 傳入自然語言 focus 時，recap doc 聚焦於該關鍵字相關變更（AS-2） — `test/skills/post-dev-recap.test.js:95` `<focus>` arg forwarded as `--focus` to /recap-doc
- [x] 非 interactive：doc 產出後自動進入 Q&A（FR-4 Must，AS-4） — `test/skills/post-dev-recap.test.js:115` mermaid workflow + Phase 3 dispatches /recap-ask --context
- [x] `--interactive` 啟用時分段輸出、每段 AskUserQuestion（AS-7） — `test/skills/post-dev-recap.test.js:142` 4-option set (繼續/提問/跳段/結束) enforced on both Phase 1 and Phase 2 hooks
- [x] 過程中不執行任何 `git add/commit/push`（AS-6） — `test/skills/post-dev-recap.test.js:180` Prohibited Actions lists all 5 git mutations + @rules/git-workflow.md xref
- [x] Scope detection 失敗時輸出 ⚠️ Need Human + fallback_trace — `test/skills/post-dev-recap.test.js:193` source===null OR files.length===0 ⇒ ⚠️ Need Human + fallback_trace
- [x] SKILL.md 的 `When NOT to Use` 區段對比 `/ask`、`/tech-brief`、`/fp-brief`、`/code-explore` 定位差異（FR-5 / AS-5） — `test/skills/post-dev-recap.test.js:210` 4 alternatives + Positioning matrix
- [x] Pass /codex-review-fast — Dual review (Codex + secondary) concluded ✅ Mergeable on 2026-04-17 after 2-round iteration (initial 🔴×2 → all fixed)

**Exception log**:
- `[AC_EXCEPTION] AC-8 (Pass /codex-review-fast) reason=ENV_UNAVAILABLE — verified via Codex MCP in-session, not as a CI-automated test. expiry=2026-05-01T00:00:00+08:00 VALID`

**Status lifecycle**: Pending / In Progress / Candidate Complete / Completed

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ | Scope, 8 ACs, reuse anchors mapped per plan `glittery-marinating-donut.md` |
| Development | ✅ | `skills/post-dev-recap/SKILL.md` (+223 lines). 2-round Codex review resolved 2 🔴 + 3 🟡 on interactive 4-option set, Path Security, termination alignment |
| Testing | ✅ | `test/skills/post-dev-recap.test.js` 18 passing tests; full suite 1381/1383 pass (2 skipped, 0 fail) |
| Acceptance | ⚠️ | Adequacy Gate: advisory ⚠️ Adequate with exceptions (1/1 cap; AC-8 ENV_UNAVAILABLE valid). `/precommit-fast` ✅ PASS |

## References

- Tech Spec §3.3.1 Signature / §3.4.4 Wrapper 互動模式
- Requirements FR-4 (Must), FR-5, FR-6, AS-1, AS-2, AS-4, AS-6, AS-7
