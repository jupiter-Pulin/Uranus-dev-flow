# Handoff-doc R1: Skeleton + Template（behavior layer）

> **Doc class**: Request ticket（date-prefixed non-lifecycle — per `@rules/docs-numbering.md`）。Per-task work breakdown unit。
> **Created**: 2026-04-22
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Requirements**: [1-requirements.md](../1-requirements.md)
> **Siblings**: [R2](./2026-04-22-handoff-doc-r2.md)（Surface Extractor）· [R3](./2026-04-22-handoff-doc-r3.md)（Check + Redaction）· [R4](./2026-04-22-handoff-doc-r4.md)（Integration）

## Background

新建 `/handoff-doc` skill 的 behavior-layer 骨架 — SKILL.md、template、target-profiles。此 ticket 為其他 3 個 siblings 的先導（R2/R3/R4 依賴本 ticket 建立的 SKILL.md 結構與 contract-index schema）。

## Requirements

- 建立 `skills/handoff-doc/SKILL.md` 骨架：frontmatter、trigger、when-not-to-use、CLI signature、workflow mermaid、verification list
- 建立 `references/output-template.md`：6 必填 sections（Header / Quickstart / Integration Surface / Unknown-TBD / Ownership&Feedback / Contract Index）+ `<!-- handoff-stats -->` 區塊 + header freshness metadata + source rationale（FR-14）
- 建立 `references/target-profiles.md`：4 target（integrator / maintainer / partner-external / team-transfer）對應 section 詳略矩陣
- 建立 `test/skills/handoff-doc.test.js`：SKILL.md schema + headings + output shape 必測（含 freshness 欄位 + stats 計數 regex 驗證）

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md + output-template.md + target-profiles.md + skill schema test |
| Out | Extractor 實作（R2）/ Check 模式（R3）/ 整合與 e2e（R4）/ Redaction 擴充（R3）/ CLAUDE.md Command Quick Reference 更新（R4，因依 T11 整合完成） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/handoff-doc/SKILL.md` | New | Skill entry + workflow（R4 將擴為完整 workflow 實作） |
| `skills/handoff-doc/references/output-template.md` | New | 6-section 模板 + contract-index schema |
| `skills/handoff-doc/references/target-profiles.md` | New | 4 receiver profile × section 詳略矩陣 |
| `test/skills/handoff-doc.test.js` | New | SKILL.md schema + template shape 驗證（R4 將加 integration test） |

## Acceptance Criteria

- [ ] `skills/handoff-doc/SKILL.md` 存在且包含 frontmatter（`name`, `description`, `allowed-tools`）、trigger、when-not-to-use、CLI signature table、workflow mermaid、verification checklist
- [ ] `references/output-template.md` 6 section headings 完整；header 範例含四欄位：commit SHA（regex `^[0-9a-f]{7,40}$`）、ISO 8601 timestamp（regex `^\d{4}-\d{2}-\d{2}T`）、`Contract version`（值或 `n/a`）、`Receiver role`（4 enum 之一）；contract-index schema 範例符合 tech-spec §3.2.1 enum（type 8 類 / status known|unknown / stable-diff 保證）
- [ ] `references/output-template.md` 含 `<!-- handoff-stats -->` 區塊範例，三欄位皆出現：`docs_referenced`、`surface_items_covered`、`open_questions_unresolved`（皆數字，無則為 0）— 對應 NFR-9
- [ ] `references/target-profiles.md` 定義 4 target × 6 section 詳略表（integrator/maintainer/partner-external/team-transfer）
- [ ] `test/skills/handoff-doc.test.js` 至少驗證：frontmatter 欄位、6 section headings 皆出現於 template、contract-index schema 範例可 `JSON.parse`、header 四欄位 regex match、stats 三計數皆存在（AS-9 + NFR-9 錨點）
- [ ] Pass `/codex-review-doc` for all new `.md` files
- [ ] Pass `/codex-review-fast`
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

- Tech Spec §5 Work Breakdown → covers T1, T2, T5, T8
- Tech Spec §3.2 Data Model（schema invariants）
- Tech Spec §3.4.2 Target Profile Matrix

**Task mapping**: T1（SKILL.md skeleton）, T2（output-template）, T5（target-profiles）, T8（schema test）— T12（CLAUDE.md update）moved to R4 per dependency order
