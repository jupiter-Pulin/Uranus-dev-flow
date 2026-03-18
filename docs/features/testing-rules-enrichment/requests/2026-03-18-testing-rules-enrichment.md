# Request: Testing Rules Enrichment + AC Traceability

> **Created**: 2026-03-18
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Source**: `/best-practices` audit + `/codex-brainstorm` Nash Equilibrium (threadId: `019cfee9-f2ad-7ed1-b6f9-35d573b84fd1`)

## Background

`rules/testing.md` 僅 12 行速查表，缺乏撰寫慣例（AAA、naming、assertion）和 evidence model。6 個 test-related skills 各自獨立，無統一規則串連。插件使用者無法客製化測試規範（不像 `auto-loop` 有 `auto-loop-project.md`）。最關鍵的缺口：無 AC-to-test traceability — request docs 有 acceptance criteria 但沒有機制驗證測試是否涵蓋。

## Requirements

- 改寫 `rules/testing.md` 為 behavioral contract（~50-60 行：Test Pyramid、Conventions、Evidence Model、Adequacy Gate Sentinels）
- 新增 `rules/testing-project.md` override template（mirror auto-loop-project.md pattern，使用者可客製化目錄、runner、adequacy mode）
- 建立 Evidence Model（2 types: automated test + runtime verification；1 verified exception: 3-gate with closed enum）
- 擴充 `/codex-test-review` 加入 `--ac-trace` mode（讀取 request doc AC → 比對 test evidence → 輸出 AC-to-evidence matrix）
- 在 auto-loop 加入 Adequacy Gate 步驟（precommit Pass → adequacy check → doc sync）
- Adequacy Gate 預設 advisory（有 request doc 時 ON）、strict opt-in via testing-project.md

## Scope

| Scope | Description |
|-------|-------------|
| In | Rules rewrite、testing-project.md、ac-trace mode、auto-loop adequacy gate、CLAUDE.md sync、install-rules extension、tests |
| Out | Shared AC parser module (v2)、hook enforcement (v2)、/check-coverage ac-trace (v2)、cross-session trend analysis |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `rules/testing.md` | Rewrite | 12 行 → ~50-60 行 behavioral contract |
| `rules/testing-project.md` | New | Override template (user-owned) |
| `.claude/rules/testing.md` | Sync | Installed copy |
| `.claude/rules/testing-project.md` | New + Sync | Installed override |
| `CLAUDE.md` | Modify | Add `@rules/testing-project.md` reference |
| `.claude/CLAUDE.md` | Modify | Same |
| `commands/install-rules.md` | Modify | Extend override template map for testing |
| `skills/test-review/SKILL.md` | Modify | Add ac-trace mode |
| `commands/codex-test-review.md` | Modify | Add `--ac-trace` argument |
| `rules/auto-loop.md` | Modify | Add Adequacy Gate section |
| `.claude/rules/auto-loop.md` | Sync | Installed copy |
| `test/commands/testing-rules.test.js` | New | Content assertions + schema tests |

## Acceptance Criteria

- [x] `testing.md` contains AAA convention rule
- [x] `testing.md` contains naming convention (`when...then` or `<unit> <condition> → <expected>`)
- [x] `testing.md` contains Evidence Model table (2 types + 1 exception)
- [x] `testing.md` contains Adequacy Gate Sentinels (4 states)
- [x] `testing-project.md` exists with precedence header + commented override sections
- [x] `CLAUDE.md` references `@rules/testing-project.md`
- [x] `/codex-test-review --ac-trace` mode documented in SKILL.md (Phase B)
- [x] `auto-loop.md` has Adequacy Gate section (Phase C)
- [x] Tests: `testing.md` content assertions pass
- [x] `/codex-review-doc` pass
- [x] `/precommit-fast` pass

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Best Practices | ✅ Done | `/best-practices` audit completed |
| Brainstorm | ✅ Done | Nash Equilibrium reached (3 rounds, threadId: `019cfee9-f2ad-7ed1-b6f9-35d573b84fd1`) |
| Tech Spec | ✅ Done | `2-tech-spec.md` — Codex review ✅ Mergeable (threadId: `019cff28-7dc9-7fa2-afdc-e86e791d8255`) |
| Implementation (Phase A) | ✅ Done | `ae6b016` — rules rewrite + testing-project.md + tests |
| Implementation (Phase B) | ✅ Done | `--ac-trace` workflow + Codex prompt + command update |
| Implementation (Phase C) | ✅ Done | Adequacy Gate section in auto-loop.md + trigger table update |
| Testing | ✅ Done | 11/11 content assertions pass |
| Review | ✅ Done | `/codex-review-doc` + `/precommit-fast` pass |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: threadId `019cfee9-f2ad-7ed1-b6f9-35d573b84fd1`
- Industry sources: [Goldbergyoni JS Testing BP](https://github.com/goldbergyoni/javascript-testing-best-practices), [AppSignal Node.js Testing](https://blog.appsignal.com/2024/10/16/best-testing-practices-in-nodejs.html), [AC Traceability](https://www.methodsandtools.com/archive/archive.php?id=118)
- Related features: [test-deep](../../test-deep/2-tech-spec.md) (execution orchestration), [plugin-testing-generalization](../../plugin-testing-generalization/2-tech-spec.md) (infrastructure)
