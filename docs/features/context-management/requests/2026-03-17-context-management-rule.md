# Request: Context Management Rule

> **Created**: 2026-03-17
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

模型在 Claude Code session 中經常未經測量就聲稱「context 太長」而停止，實際 context window 可能只用了 30-40%。`/best-practices` audit（Chroma/Anthropic/HumanLayer 研究 + adversarial debate）確認需要 data-driven context awareness rule：測量 → 決策 → 行動。

## Requirements

- 新建 `rules/context-management.md` 定義三級 threshold（Normal <80% / Compact 80-92% / Critical ≥92%）
- 禁止未經 `/context` 查詢就聲稱 context 不足
- 定義 compact 保留清單（task list、decisions、threadIds、uncommitted files）
- 與 auto-loop 規則互補（cross-reference `auto-loop.md:12`）
- 更新所有 CLAUDE.md / template / install-rules 引用

## Scope

| Scope | Description |
|-------|-------------|
| In | Rule file 建立、cross-reference 更新、CLAUDE.md/template 引用、install-rules 列舉、tests |
| Out | Hook-level enforcement（v2）、statusline integration、auto-compact threshold 修改 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `rules/context-management.md` | New | 三級 context policy + prohibited behaviors + compact preservation |
| `rules/auto-loop.md:12` | Modify | 加入 `@rules/context-management.md` cross-reference |
| `CLAUDE.md` | Modify | Rules section 加入引用 |
| `.claude/CLAUDE.md` | Modify | Rules section 加入引用 |
| `CLAUDE.template.md` | Modify | Template rules list 加入引用 |
| `commands/install-rules.md` | Modify | Phase 2 枚舉表 + Phase 4.6 backfill block |
| `test/commands/context-management-rule.test.js` | New | Rule 結構 + reference 驗證 tests |

## Acceptance Criteria

- [x] `rules/context-management.md` 存在且包含 `## Prohibited Behaviors`、`## Three-Tier Policy`、`## Compact Preservation` sections
- [x] Three-Tier Policy 定義 Normal (<80%)、Compact (80-92%)、Critical (≥92%) 三個 zone
- [x] Prohibited 包含「未 `/context` 不得聲稱 context 不足」且有 `/context` unavailable 例外
- [x] Critical zone action 明確要求先完成 auto-loop obligations 再 compact
- [x] Compact preservation 包含 task list、decisions、threadIds、uncommitted files、no secrets
- [x] `auto-loop.md:12` 包含 `@rules/context-management.md` cross-reference
- [x] `CLAUDE.md` `## Rules` 包含 `@rules/context-management.md` 引用
- [x] `.claude/CLAUDE.md` `## Rules` 包含相同引用
- [x] `CLAUDE.template.md` rules list 包含引用
- [x] `commands/install-rules.md` Phase 2 expected rules table 包含 `context-management.md`
- [x] `commands/install-rules.md` Phase 4.6 fallback `## Rules` block 包含引用
- [x] `test/commands/context-management-rule.test.js` 測試通過
- [x] Pass `/codex-review-doc`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Feasibility | ✅ Done | `/best-practices` audit threadId: `019cfb5c-14eb-7500-9fd1-5cfb6ced6a29` |
| Tech Spec | ✅ Done | `2-tech-spec.md` — Codex review ✅ Mergeable |
| Implementation | ✅ Done | 6/6 tasks: rule file, auto-loop cross-ref, CLAUDE.md refs, install-rules enum+backfill, template, tests |
| Testing | ✅ Done | 130 tests pass (99 existing + 21 customize + 10 context-mgmt) |
| Review | ✅ Done | `/codex-review-doc` ✅ Mergeable + `/precommit-fast` ✅ All Pass |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: threadId `019cfb5c-14eb-7500-9fd1-5cfb6ced6a29`
- Chroma Research: [Context Rot](https://research.trychroma.com/context-rot)
- Anthropic: [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
