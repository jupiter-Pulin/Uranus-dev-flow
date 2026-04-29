# Handoff-doc R2: Integration Surface Extractor（code layer）

> **Doc class**: Request ticket（date-prefixed non-lifecycle — per `@rules/docs-numbering.md`）
> **Created**: 2026-04-22
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)
> **Depends On**: [R1 — Skeleton + Template](./2026-04-22-handoff-doc-r1.md)
> **Siblings**: [R1](./2026-04-22-handoff-doc-r1.md) · [R3](./2026-04-22-handoff-doc-r3.md) · [R4](./2026-04-22-handoff-doc-r4.md)

## Background

實作 `scripts/lib/surface-extractor.js` — 8 類 integration surface 自動偵測的核心。此為 `/handoff-doc` 最耗時模組（tech-spec effort L=2d）；以 pure function 實作便於單元測試，並確保殘缺輸入回傳 `status: "unknown"` 不虛構（FR-6/FR-8 no-fabrication guard）。

## Requirements

- 建立 `skills/handoff-doc/references/surface-detectors.md`：8 類合約（api/event/schema/auth/config/env/rate-limit/error-code）偵測規則詳表；列 regex + scope cascade（P1→P4）+ 偵測器契約
- 實作 `scripts/lib/surface-extractor.js`：
  - Export `extract(projectRoot, options) → Contract[]`（pure function）
  - 8 類 detectors 各為獨立 pure function（便於測試與未來插件化）
  - 支援多 Node/TS framework：Express、Nest、Fastify、Next.js file-based routing
  - 輸出符合 tech-spec §3.2.1 contract-index schema（含 `source_file`、`source_sha`（git hash-object）、`source_ref`、`status`）
  - Serialization 遵循 tech-spec §3.2.1 "Stable diff 保證"（4-tuple sort + 固定 key 順序）
- 實作 `test/scripts/lib/surface-extractor.test.js`：3 情境 × 8 類
  - Happy：每類合約 fixture 可被正確偵測
  - Not-found：該類缺失 → emit with `status: "unknown"`
  - Ambiguous：多 framework 命中同一路徑 → 採 P1 > P4 規則不重覆

## Scope

| Scope | Description |
|-------|-------------|
| In | surface-detectors.md + surface-extractor.js + unit test + fixture（小型合成 Node 專案） |
| Out | Skill SKILL.md 整合（R4）/ check mode（R3）/ redaction（R3）/ 其他語言（Python/Go/Rust，留 v2） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/handoff-doc/references/surface-detectors.md` | New | 8 類偵測規則詳表 |
| `scripts/lib/surface-extractor.js` | New | 核心抽取器（pure function） |
| `test/scripts/lib/surface-extractor.test.js` | New | Unit tests（8 類 × 3 情境） |
| `test/fixtures/handoff-doc/` | New | 合成 Node 專案 fixture（含刻意殘缺版本） |

## Acceptance Criteria

- [ ] `references/surface-detectors.md` 列出 8 類偵測，每類含：type、format enum、P1-P4 scope cascade、具體 regex（對齊 tech-spec §3.4.1 已強化的 pattern）
- [ ] `scripts/lib/surface-extractor.js` 為 pure function（無 I/O 副作用除 git/fs 讀取）
- [ ] 對 fixture 殘缺版本執行，回傳的 contract entries 含 `status: "unknown"`，且 `source_file`/`source_sha` 為空字串
- [ ] 序列化輸出穩定（相同輸入跨兩次呼叫 byte-identical）
- [ ] `test/scripts/lib/surface-extractor.test.js` 覆 happy + not-found + ambiguous 三情境（8 類 × 3 = ≥ 24 test cases）
- [ ] Unit test branch coverage > 80%（per tech-spec §6）
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

- Tech Spec §3.4.1 Integration Surface Detectors（v1 scope：Node / TS / JS）
- Tech Spec §3.2.1 Contract-Index Schema v1
- Tech Spec §6 Testing Strategy → Unit coverage > 80% requirement
