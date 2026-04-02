# Phase A: Skill Parity — 建立缺少的 Skill Entry Points

> **Created**: 2026-04-01
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [Commands-to-Skills Migration Tech Spec](../2-tech-spec.md)

## Background

Claude Code 已棄用 `commands/`，sd0x-dev-flow 有 23 個 commands 缺少同名 skill entry point。Phase A 的目標是達成 N/N name parity，確保每個 command 名稱都有對應的 skill，為 Phase B 刪除 commands 做準備。

## Requirements

- 建立 audit script 動態計算 commands vs skills 的 name coverage
- 為 11 個 Category A (standalone) commands 建立新 SKILL.md
- 為 7 個 Category B1 (thin alias) commands 建立 entry-point skill
- 為 5 個 Category B2 (unique logic) commands 建立 full skill（遷移獨特邏輯）
- 建立 skill-era test suite 取代 command-era schema tests
- 修正已 drift 的 `allowed-tools`（數量由 audit script 計算）

## Scope

| Scope | Description |
|-------|-------------|
| In | A1-A7 tasks per tech spec: audit + skill creation (A/B1/B2) + tests + drift fix + parity verification |
| Out | 刪除 commands/（Phase B）、package.json files 修改（Phase C）、CLAUDE.md 更新（Phase B） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/precommit/SKILL.md` | New | Cat. A: 從 `commands/precommit.md` 遷移，含 `intent:` 轉換 |
| `skills/precommit-fast/SKILL.md` | New | Cat. A: 從 `commands/precommit-fast.md` 遷移 |
| `skills/verify/SKILL.md` | New | Cat. A: 從 `commands/verify.md` 遷移，含 `intent:` 轉換 |
| `skills/install-rules/SKILL.md` | New | Cat. A: 最複雜（593L），含 manifest-tracked smart merge |
| `skills/install-hooks/SKILL.md` | New | Cat. A: Hook 安裝 + conflict handling |
| `skills/install-scripts/SKILL.md` | New | Cat. A: Script 安裝 |
| `skills/pr-review/SKILL.md` | New | Cat. A: PR self-review checklist |
| `skills/project-brief/SKILL.md` | New | Cat. A: PM/CTO summary |
| `skills/simplify/SKILL.md` | New | Cat. A: Agent dispatch wrapper |
| `skills/doc-refactor/SKILL.md` | New | Cat. A: Agent dispatch wrapper |
| `skills/zh-tw/SKILL.md` | New | Cat. A: 翻譯指令 |
| `skills/codex-review-fast/SKILL.md` | New | Cat. B1: thin entry-point → `codex-code-review` |
| `skills/codex-review/SKILL.md` | New | Cat. B1: thin entry-point → `codex-code-review` |
| `skills/codex-review-branch/SKILL.md` | New | Cat. B1: thin entry-point → `codex-code-review` |
| `skills/codex-review-doc/SKILL.md` | New | Cat. B1: thin entry-point → `doc-review` |
| `skills/codex-security/SKILL.md` | New | Cat. B1: thin entry-point → `security-review` |
| `skills/codex-test-review/SKILL.md` | New | Cat. B1: thin entry-point → `test-review` |
| `skills/codex-test-gen/SKILL.md` | New | Cat. B1: thin entry-point → `test-review` |
| `skills/dep-audit/SKILL.md` | New | Cat. B2: full skill，含 ecosystem fallback + `intent:` |
| `skills/check-coverage/SKILL.md` | New | Cat. B2: full skill，含 `coverage-analyst` agent dispatch |
| `skills/update-docs/SKILL.md` | New | Cat. B2: full skill，含 5-step workflow |
| `skills/deep-analyze/SKILL.md` | New | Cat. B2: full skill，含 agent dispatch |
| `skills/review-spec/SKILL.md` | New | Cat. B2: full skill，含 agent dispatch |
| `test/skills/schema.test.js` | New | Skill frontmatter schema 驗證 |
| `test/skills/alias-entrypoints.test.js` | New | B1 alias → canonical skill 引用驗證 |
| `test/skills/reference-coverage.test.js` | New | Reference 檔案引用完整性 |

## Acceptance Criteria

- [ ] Audit script 產出 `migration-inventory.json`，列出所有缺少同名 skill 的 commands
- [ ] 11 個 Category A standalone skills 建立完成，frontmatter 含 `name` + `description`
- [ ] 7 個 Category B1 thin entry-point skills 建立完成，引用的 canonical skill 存在
- [ ] 5 個 Category B2 full skills 建立完成，遷移了 command 中的獨特邏輯（ecosystem fallback、agent dispatch、step workflow）
- [ ] `intent:` frontmatter 轉換為 SKILL.md body workflow section（4 個 runner skills）
- [ ] Skill-era test suite 全部 pass（schema + alias + reference）
- [ ] N/N name parity 達成（audit script 驗證）
- [ ] Pass `/codex-review-fast`
- [ ] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | Audit script |
| Development | - | Skill creation (A → B1 → B2) |
| Testing | - | Skill-era test suite |
| Acceptance | - | Parity verification |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: `/best-practices` (2026-04-01, debate threadId: `019d48ed-ea50-7623-a8f6-d52b3edaecbf`)
