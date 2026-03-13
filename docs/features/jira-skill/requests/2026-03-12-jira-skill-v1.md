# Jira Skill v1 — View / Branch / Transition

> **Created**: 2026-03-12
> **Status**: In Progress
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

開發者在 Claude Code 中無法直接操作 Jira ticket，需要切換到瀏覽器查看 issue、手動建分支、手動更新狀態。透過 Atlassian MCP（claude.ai 整合），設計一個 zero-config、pluggable 的 skill，讓開發者可以在 CLI 中完成 Jira 操作。

## Requirements

| 需求 | 說明 |
|------|------|
| `/jira view` | 透過 MCP 取得 Jira issue 詳情，格式化輸出 |
| `/jira branch` | 從 issue type + summary 自動產生符合 `git-workflow.md` 慣例的 branch name |
| `/jira transition` | 透過 event vocabulary（`start_work` / `pr_opened` / `pr_merged`）執行狀態流轉 |
| Zero-config | 不需要在 CLAUDE.md 設定 `{JIRA_CLOUD_ID}` 等 placeholder |
| Pluggable | 有 Atlassian MCP 就啟用，沒有就 graceful skip |
| Plan/Execute | 預設 plan mode（read-only），`--execute` 才寫入 |

## Scope

| Scope | Description |
|-------|-------------|
| In | `view` / `branch` / `transition` 三個 subcommand、input parser（bare key + URL + branch context）、cloudId runtime resolution、event vocabulary、graceful degradation、unit tests |
| Out | `create` subcommand（v2）、`search` subcommand（v1.1）、GitHub Issue 雙向同步（v2） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/jira/SKILL.md` | New | Skill 定義（trigger, workflow, references） |
| `skills/jira/references/branch-policy.md` | New | Issue type → branch prefix mapping + slug 規則 |
| `skills/jira/references/transition-mapping.md` | New | Event vocabulary → transition regex 對應 |
| `commands/jira.md` | New | Command entry point + `allowed-tools` frontmatter |
| `test/commands/jira.test.js` | New | Schema validation + unit tests（parser, branch gen, event matching） |
| `CLAUDE.template.md` | Modify | Command Quick Reference 加入 `/jira` |
| `CLAUDE.md` | Modify | Command Quick Reference 加入 `/jira` |
| `.claude/CLAUDE.md` | Modify | Command Quick Reference 加入 `/jira` |

## Acceptance Criteria

### AC1: view subcommand

- [ ] `/jira view OK-51513` 正確顯示 issue summary, status, assignee, priority, type, description
- [ ] `/jira view https://onekeyhq.atlassian.net/browse/OK-51513` 正確解析 URL 中的 key 和 host
- [ ] 無 Atlassian MCP 時顯示 graceful degradation 訊息

### AC2: branch subcommand

- [ ] `/jira branch OK-51513` 產生 `<type>/<KEY>-<slug>` 格式的 branch name
- [ ] Issue type 正確映射到 `feat/` / `fix/` / `docs/` prefix（`refactor` 僅透過 `--type` override）
- [ ] `--type` 僅接受 `feat|fix|docs|refactor` enum，其他值回傳錯誤
- [ ] Branch name slug 長度限制 40 chars，特殊字元移除
- [ ] Collision detection：本地 + remote 衝突時自動加 `-2`, `-3` suffix
- [ ] Plan mode 預設只顯示計畫，`--execute` 才執行 `git checkout -b`

### AC3: transition subcommand

- [ ] Event vocabulary `start_work` / `pr_opened` / `pr_merged` 正確匹配 Jira transitions
- [ ] 0 match → 錯誤訊息列出可用 transitions
- [ ] N match → AskUserQuestion 讓使用者選擇
- [ ] 已在目標狀態 → skip with message
- [ ] Plan mode 預設，`--execute` + AskUserQuestion 確認後才執行

### AC4: 基礎設施

- [x] `commands/jira.md` frontmatter `allowed-tools` 包含：Atlassian MCP tools（逐一列舉）、`Bash(git:*)`, `AskUserQuestion`
- [x] `CLAUDE.template.md`、`CLAUDE.md`、`.claude/CLAUDE.md` 命令表加入 `/jira`
- [x] `test/commands/jira.test.js` 通過（schema + unit tests）
- [x] `test/commands/skills-schema.test.js` 通過（SKILL.md 完整性）
- [x] `test/commands/schema.test.js` 通過（command frontmatter schema）
- [x] `test/commands/claude-md-coverage.test.js` 通過（命令表覆蓋率）
- [x] Pass `/codex-review-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec 已完成並通過 review |
| Development | Done | 全部檔案已建立：SKILL.md, references, command, tests |
| Testing | Done | jira + schema/skills-schema/coverage tests all pass，Codex review ✅ Ready，precommit ✅ All Pass |
| Acceptance | Pending | AC1-AC3 需實際 Atlassian MCP 環境驗證，AC4 ✅ 全部通過 |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices: 2 rounds `/codex-brainstorm` Nash Equilibrium（zero-config pluggable design）
- Atlassian MCP tools（逐一列舉）：`getAccessibleAtlassianResources`, `getJiraIssue`, `getTransitionsForJiraIssue`, `transitionJiraIssue`, `addCommentToJiraIssue`, `searchJiraIssuesUsingJql`（pre-authorized for v1.1 search subcommand）
- Branch convention: `rules/git-workflow.md`（`feat/*|fix/*|docs/*|refactor/*`）
