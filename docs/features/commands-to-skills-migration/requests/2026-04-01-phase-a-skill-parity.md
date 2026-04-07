# Phase A: Skill Parity — 建立缺少的 Skill Entry Points

> **Created**: 2026-04-01
> **Status**: Completed
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
- 確保新 skill 的 `allowed-tools` 與對應 command 一致（手動對齊，audit script 偵測 name parity）

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
| `scripts/migration-audit.sh` | New | 動態 parity gap 偵測 audit script |
| `test/commands/parity.test.js` | New | N/N name parity 驗證（含 known-gap 機制） |
| `test/commands/alias-skills.test.js` | New | B1 alias → canonical skill 引用驗證 |
| `test/commands/skills-schema.test.js` | Existing | Skill frontmatter schema + reference 完整性驗證（已存在，Phase A 擴展覆蓋） |

## Acceptance Criteria

- [x] Audit script 產出 parity JSON（stdout 或 `--output <path>`），列出所有缺少同名 skill 的 commands
- [x] 11 個 Category A standalone skills 建立完成，frontmatter 含 `name` + `description`
- [x] 7 個 Category B1 thin entry-point skills 建立完成，引用的 canonical skill 存在
- [x] 5 個 Category B2 full skills 建立完成，遷移了 command 中的獨特邏輯（ecosystem fallback、agent dispatch、step workflow）
- [x] `intent:` frontmatter 轉換為 SKILL.md body workflow section（4 個 runner skills）
- [x] Skill-era test suite 全部 pass（schema + alias + reference）
- [x] N/N name parity 達成（audit script 驗證）
- [x] Pass `/codex-review-fast`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | `scripts/migration-audit.sh` — gap=0, parity=true |
| Development | Done | 23 skills created: 11 Cat.A + 7 Cat.B1 + 5 Cat.B2 (commit `1c6641c`) |
| Testing | Done | `parity.test.js` + `alias-skills.test.js` + `skills-schema.test.js` — 14/14 pass |
| Acceptance | Done | N/N parity verified, `/codex-review-fast` ✅ Ready, `/precommit-fast` ✅ All Pass, `/precommit` (full) ✅ All Pass |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: `/best-practices` (2026-04-01, debate threadId: `019d48ed-ea50-7623-a8f6-d52b3edaecbf`)
