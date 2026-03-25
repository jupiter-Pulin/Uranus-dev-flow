# Mid-Loop Summary Prohibition

> **Created**: 2026-03-25
> **Status**: Spec Complete
> **Priority**: P1 (low effort, immediate)
> **Brainstorm threadId**: `019d24b5-0085-74f3-b143-ae6b35060c95`
> **Origin**: autoresearch project analysis (deep-research 2026-03-25)
> **Equilibrium**: Pure Strategy Convergence (3 rounds)

## Background

autoresearch 明確禁止「每次 iteration 後做摘要」，因為 summary 觸發 Claude 的自然停止傾向。sd0x-dev-flow 已有 "Summary != Completion" 規則，但不夠具體 — 它禁止「用 summary 代替執行」，但沒有禁止「在 active loop 中輸出 polished summary」。

## Requirements

- 在 `rules/auto-loop.md` Prohibited Behaviors 加入明確的 mid-loop summary 禁止
- 允許 brief operational status（1-2 行），禁止 polished/terminal summary
- 不改變 hook 行為

## Scope

| In | Out |
|----|-----|
| auto-loop.md 新增 prohibited behavior | Hook 變更 |
| `.claude/rules/auto-loop.md` 同步 | State file schema 變更 |

## Acceptance Criteria

- [ ] `rules/auto-loop.md` Prohibited Behaviors 含新條目
- [ ] `.claude/rules/auto-loop.md` 同步
- [ ] 明確區分 brief status（允許）vs polished summary（禁止）

## Implementation

在 `rules/auto-loop.md` 和 `.claude/rules/auto-loop.md` 的 "Prohibited Behaviors" section 加入：

```markdown
❌ **Polished summary during active loop**: Outputting a completion-style summary (table, checklist, "all done" language) while fix-review-precommit cycle is still active. Brief operational status lines ("Fixed 3 issues, running review...") are allowed; terminal summaries are not until all gates pass.
```

加在現有 "Context/token excuse" 條目之後。
