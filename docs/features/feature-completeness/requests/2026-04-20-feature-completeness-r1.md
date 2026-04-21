# Feature Completeness — R1 Core Data Pipeline

> **Doc class**: Request ticket (date-prefixed non-lifecycle — per `@rules/docs-numbering.md`). Per-task work breakdown unit for progress tracking. **Not** a feature-level requirements doc — for that see `../1-requirements.md`.
> **Created**: 2026-04-20
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)

## Background

實作 `feature-completeness` skill 的核心資料管線 — FR/NFR/AC 擷取、跨維度聚合、6 個 sub-skill output parser、doc-currency mtime 比對、snapshot cache。這些是純函式（無 I/O 副作用、易單元測試）且是 R2/R3 的基礎。

## Requirements

- `fc-extractor.js` — 從 `canonical_docs` + `requests/*.md` 擷取 FR / NFR / AC（含 prohibited-domain 標記，per §3.4.4.1）
- `fc-aggregator.js` — 3-tier verdict 映射 + hard-fail override（排除 `codex_challenge` 不計入 verdict math）
- `fc-parsers/` — 6 個 sub-skill output parser（`check-coverage` / `codex-test-review` / `test-health` / `codex-security` / `feature-verify` / `risk-assess`）
- `fc-doc-currency.js` — `git log -1 --format=%ct` 比對 doc vs code mtime；>14 天 drift 標示 partial
- Cache snapshot 寫入 `.claude/cache/feature-completeness/<repoKey>/`（複用 test-health repoKey 算法）

## Scope

| Scope | Description |
|-------|-------------|
| In  | `fc-extractor.js` / `fc-aggregator.js` / `fc-parsers/*.js`（6 個）/ `fc-doc-currency.js` + 對應 unit tests；snapshot 寫入整合 |
| Out | SKILL.md / references/（R2）；`--discuss` / `--challenge` / E2E（R3）；hook regression（R2） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/fc-extractor.js` | New | FR/NFR/AC 擷取 + prohibited-domain 分類 |
| `scripts/lib/fc-aggregator.js` | New | 3-tier verdict + hard-fail + codex_challenge 排除 |
| `scripts/lib/fc-parsers/check-coverage.js` | New | Parse `/check-coverage` report 為 DimensionResult |
| `scripts/lib/fc-parsers/test-review.js` | New | Parse AC trace verdict (parses `/test-review` output — delegated parent of `/codex-test-review`) |
| `scripts/lib/fc-parsers/test-health.js` | New | Parse test inventory + coverage artifacts |
| `scripts/lib/fc-parsers/codex-security.js` | New | Parse OWASP findings（opt-in） |
| `scripts/lib/fc-parsers/feature-verify.js` | New | Parse L1-L5 verdict（opt-in） |
| `scripts/lib/fc-parsers/risk-assess.js` | New | Parse risk level + top_affected（opt-in） |
| `scripts/lib/fc-doc-currency.js` | New | Git-based doc-vs-code mtime 比對 |
| `test/scripts/lib/fc-extractor.test.js` | New | FR/NFR/AC fixture 命中 + domain 標記 |
| `test/scripts/lib/fc-aggregator.test.js` | New | 3-tier mapping + hard-fail + `[UNVERIFIED]` |
| `test/scripts/lib/fc-parsers/*.test.js` | New | 6 個 parser fixture 測試 |
| `test/scripts/lib/fc-doc-currency.test.js` | New | mtime drift edge cases |

## Acceptance Criteria

- [x] `fc-extractor.js` 對 `docs/features/feature-completeness/1-requirements.md` fixture 擷取 ≥ 12 FR / 9 NFR 正確（S-1 / S-9）
- [x] `fc-aggregator.js` 三段 verdict 對 3 個 fixture（complete / partial / incomplete）映射正確 + `codex_challenge` 不計入 verdict math（FR-7）
- [x] 6 個 `fc-parsers/*` 各自通過 fixture input → expected output 契約測試；命中率 < 90% 視為 `unverified`（R2） <!-- partial: R1 實作 0-recognition → unverified（strict subset of `<90%`）；<90% 門檻延後到 R2 per tech-spec §7。Contract test: test/scripts/lib/fc-parsers/hit-rate-contract.test.js -->
- [x] `fc-doc-currency.js` squash-merge repo 情境不 false-positive（R7）
- [x] Cache snapshot 寫入 `.claude/cache/feature-completeness/<repoKey>/`；schema 符合 §3.2.1 `CompletenessSnapshot`
- [x] Prohibited-domain 分類（security / data-integrity / regression）依 §3.4.4.1 keyword 清單，有 AC-fixture 覆蓋各 domain
- [x] Unit test coverage ≥ 80% per module（對齊 2-tech-spec §6 Testing Strategy "Coverage target" 段落） <!-- exception: ENV_UNAVAILABLE, expires: 2026-05-05, gate: EXCEPTION_VALID (via /codex-test-review --ac-trace session 2026-04-21, threadId 019dae44-1ba0-71d0-a0ae-7a57c0856398). Reason: repo root 無 c8/nyc 配置；待 /generate-runner 加上 coverage script 後重評。Owner: @SD0. Removal plan by expiry: 啟動 R2 或並行 ticket 新增 c8 + coverage script + CI gate。 -->
- [x] Pass /codex-review-fast <!-- verified in-session (round 3): Codex thread 019dae28-7410-7940-bd54-2764c8700d64 emitted `✅ Ready`; secondary reviewer agent aeb18b5e15e04e4d4 emitted `✅ Ready`. No persisted artifact — re-verify by replay if doubt arises. -->

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec §2-§3 已定案 |
| Development | Done | 7 模組完成（fc-extractor / fc-aggregator / fc-parsers/*6 / fc-doc-currency）+ 對應 test 檔 |
| Testing | Done | R1 模組測試: `node --test test/scripts/lib/fc-extractor.test.js test/scripts/lib/fc-aggregator.test.js test/scripts/lib/fc-doc-currency.test.js test/scripts/lib/fc-parsers/*.test.js` → **93/93 pass in project execution env @ 2026-04-21** (writable filesystem required — many tests use `node:fs mkdtempSync` for isolated repo fixtures). 廣域 `npm run test:unit`: **130/130 pass in same env**. **Read-only sandboxes** (e.g. Codex MCP `sandbox: 'read-only'`) cannot reproduce these counts — `mkdtempSync` returns `EPERM` and ~19-32 filesystem-dependent tests fail; this is an environment constraint, not a correctness regression. Re-verify locally via the commands above. Codex round 3 code review ✅ Ready（thread 019dae28）；secondary reviewer ✅ Ready（agent aeb18b5e15e04e4d4）。|
| Acceptance | Candidate | Adequacy Gate（thread 019dae44）: 5 COVERED + 1 EXCEPTION_VALID (AC-7) + 1 INCONCLUSIVE (AC-3, strict subset 已實作，`<90%` 延後 R2)。advisory 模式 Warn + continue。Precommit: lint:fix ✅ + test ⚠️（`test/skills/necessity-audit/preflight.test.js:177` 既存失敗於 untracked skill，R1 scope 外）。|

### Evidence Matrix

| AC | Verification Command | Artifact Location | Verified On |
|----|---------------------|-------------------|-------------|
| 1 | `node --test test/scripts/lib/fc-extractor.test.js` | test/scripts/lib/fc-extractor.test.js#L381 | writable local env (requires `mkdtempSync`) |
| 2 | `node --test test/scripts/lib/fc-aggregator.test.js` | test/scripts/lib/fc-aggregator.test.js#L72 (codex_challenge excl.) | writable local env (requires `mkdtempSync`) |
| 3 | `node --test test/scripts/lib/fc-parsers/hit-rate-contract.test.js` | test/scripts/lib/fc-parsers/hit-rate-contract.test.js (6 parsers × 4 malformed inputs) | read-only sandbox OK (pure parse) |
| 4 | `node --test test/scripts/lib/fc-doc-currency.test.js` | test/scripts/lib/fc-doc-currency.test.js#L208 | writable local env (requires `mkdtempSync`) |
| 5 | `node --test test/scripts/lib/fc-aggregator.test.js` | test/scripts/lib/fc-aggregator.test.js (full §3.2.1 schema + round-trip) | writable local env (requires `mkdtempSync`) |
| 6 | `node --test test/scripts/lib/fc-extractor.test.js` | test/scripts/lib/fc-extractor.test.js#L116 + L236 | read-only sandbox OK for L116 (pure); L236 requires writable |
| 7 | Exception (ENV_UNAVAILABLE) | Thread 019dae44 — EXCEPTION_VALID | adequacy-gate session 2026-04-21 |
| 8 | In-session dual review | Codex thread 019dae28 + agent aeb18b5e15e04e4d4 — both `✅ Ready` | in-session only — no persisted artifact |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) §2.3, §3.2-3.4, §4 R1/R2/R7, §5 T1/T2/T3/T4/T9
- Requirements: [../1-requirements.md](../1-requirements.md) FR-1/2/3/4, NFR-1/2/5, §S-1/S-2/S-9/S-10
- Sibling: [R2 Skill entry](./2026-04-20-feature-completeness-r2.md) · [R3 Interactive + E2E](./2026-04-20-feature-completeness-r3.md)
