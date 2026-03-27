# AI Content Sanitization for /create-pr

> **Created**: 2026-03-27
> **Status**: Candidate Complete
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

`/create-pr` 僅靠一行文字規則阻止 AI 署名洩漏，PR title/body 經常出現 "Generated with Claude" 等標記。需要加入與 `/smart-commit` 同等的程式化防護，適配 PR 的 GitHub API 架構。來源：Best Practices Audit（threadId: `019d2d36-e3f0-7592-b09e-052b09b14fd6`）。

## Requirements

- 在 SKILL.md `### 4. Generate Body` Rules 段落後新增 Forbidden Pattern Table（canonical 3 組 POSIX ERE from `commit-msg-guard.sh`）
- 新增 Step 4b: AI Content Sanitization — title regenerate/fail + body line-strip + `[AI_STRIPPED]` log
- 新增 Step 7b: Post-creation Verify（execute-only）— `gh pr view` 驗證 + auto-remediate + re-verify
- Step 5a (update mode) 加入 sanitization pipeline 引用
- CLAUDE.md Development Rules #3 擴展至 PR title/body 規則
- 新增 unit + integration 測試覆蓋 sanitization 邏輯

## Scope

| Scope | Description |
| ----- | ----------- |
| In | SKILL.md 修改（pattern table + Step 4b + Step 7b + Step 5a ref）、CLAUDE.md 更新、測試 |
| Out | `--ai-co-author` flag（PR 無合理用例）、git hook 整合（架構不可行）、獨立 script 檔案（複用 canonical source） |

## Related Files

| File | Action | Description |
| ---- | ------ | ----------- |
| `skills/create-pr/SKILL.md` | Modify | 新增 forbidden pattern table、Step 4b、Step 7b、Step 5a 引用 |
| `CLAUDE.md` | Modify | Development Rules #3 擴展至 PR 規則 |
| `.claude/CLAUDE.md` | Modify | 同步 Development Rules #3 |
| `test/commands/create-pr-sanitization.test.js` | New | Unit + integration tests for sanitization |

## Acceptance Criteria

- [x] SKILL.md 包含 Forbidden Pattern Table，引用 `scripts/commit-msg-guard.sh` 的 3 組 canonical POSIX ERE regex
- [x] Step 4b 實作 pre-output sanitization：title regenerate/fail + body line-strip + `[AI_STRIPPED]` log，覆蓋 dry-run/execute × create/update × `--title` override 全部路徑
- [x] Step 7b 實作 post-creation verify（execute-only，含 execute-update）：`gh pr view` 掃描 + auto-remediate（單次，pre-sanitized snapshot）+ re-verify + hard fail fallback
- [x] Step 5a (update mode) 引用 Step 4b sanitization pipeline，create/update 共用同一流程，execute-update 觸發 Step 7b
- [x] CLAUDE.md + .claude/CLAUDE.md Development Rules #3 明確涵蓋 PR title/body forbidden patterns
- [x] `test/commands/create-pr-sanitization.test.js` 覆蓋：title regenerate/fail、body strip+log、clean passthrough、pattern sync with `commit-msg-guard.sh`（20 tests, all pass）
- [x] Pass `/codex-review-fast`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Note |
| ----- | ------ | ---- |
| Analysis | Done | Best Practices Audit + Tech Spec completed |
| Development | Done | SKILL.md Step 4b/7b/5a + CLAUDE.md updated; review ✅ Ready |
| Testing | Done | 20/20 tests pass; precommit-fast ✅ |
| Acceptance | Done | 8/8 AC checked |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit Debate: threadId `019d2d36-e3f0-7592-b09e-052b09b14fd6`
- Doc Review: threadId `019d2d4a-6256-7012-98ec-d708bbf2166a`
- Canonical patterns: `scripts/commit-msg-guard.sh:19-23`
- Reference implementation: `skills/smart-commit/SKILL.md:290-305`
