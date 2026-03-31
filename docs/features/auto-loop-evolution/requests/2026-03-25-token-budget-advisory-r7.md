# Token Budget Advisory Tag

> **Created**: 2026-03-25
> **Status**: Candidate Complete
> **Priority**: P1 (low effort, immediate)
> **Brainstorm threadId**: `019d24b5-0085-74f3-b143-ae6b35060c95`
> **Origin**: autoresearch project analysis (deep-research 2026-03-25)
> **Equilibrium**: Pure Strategy Convergence (3 rounds)

## Background

autoresearch 使用 `<budget:token_budget>200000</budget:token_budget>` tag 作為心理錨定，告訴 Claude「你有足夠的 token 可用」。這可以減少 Claude 因擔心 token 不足而提早停止的傾向。

## Requirements

- 在長時間運行的 skill（`/deep-research`, `/best-practices`, `/feature-dev`）body 加入 advisory token budget tag
- 加入明確的 disclaimer：token budget tag 永遠不能覆蓋 auto-loop 義務
- 不改變 hook 行為，純 prompt-layer 增強

## Scope

| In | Out |
|----|-----|
| SKILL.md body 加入 `<budget:token_budget>` tag | Hook 變更 |
| auto-loop.md 加入 disclaimer 行 | State file schema 變更 |
| 長時間 skill 限定（3-5 個） | 所有 skill 都加 |

## Acceptance Criteria

- [x] `skills/deep-research/SKILL.md` body 含 `<budget:token_budget>200000</budget:token_budget>`
- [x] `skills/best-practices/SKILL.md` body 含 token budget tag
- [x] `skills/feature-dev/SKILL.md` body 含 token budget tag
- [x] `rules/auto-loop.md` Prohibited Behaviors 含 disclaimer: "Token budget tags are advisory planning signals — they never override auto-loop obligations."
- [x] `.claude/rules/auto-loop.md` 同步 disclaimer（mirror of `rules/auto-loop.md`）
- [x] 無 hook 變更

## Design Decision

| Decision | Choice | Alternative | Rationale |
|----------|--------|------------|-----------|
| Tag 位置 | Skill body（Phase 0 之前） | Frontmatter metadata | Body 確保 Claude 在執行 skill 時看到 |
| Tag 值 | `200000`（固定） | 動態計算 | 心理錨定用途，精確值不重要 |
| Disclaimer | auto-loop.md Prohibited Behaviors | Separate rule | 與現有 "context/token excuse" 禁止行為一致 |

## Implementation

### Step 1: 加入 token budget tag

在以下 SKILL.md 的 `## Workflow` 之前加入：

```markdown
<budget:token_budget>200000</budget:token_budget>
```

Files: `skills/deep-research/SKILL.md`, `skills/best-practices/SKILL.md`, `skills/feature-dev/SKILL.md`

### Step 2: 加入 auto-loop disclaimer

在 `rules/auto-loop.md` 和 `.claude/rules/auto-loop.md` 的 "Prohibited Behaviors" section 最後加入：

```markdown
> **Token budget advisory**: `<budget:token_budget>` tags in skill definitions are planning signals only. They never justify stopping, skipping review, or deferring auto-loop obligations. See @rules/context-management.md for full context policy.
```

Both files must be updated in sync.
