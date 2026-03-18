# Request: Dual Reviewer Loop Enforcement

> **Created**: 2026-03-17
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

使用者反饋兩個行為問題：(1) 雙視角 review 有時不觸發（Dual Review Mode 規則在 `auto-loop.md` 中段被 attention bias 忽略），(2) 模型修完 issue 後聲稱「已修」就停下，不跑 re-review。此外，使用者明確要求 secondary reviewer 每輪都跑（平行不多花時間），推翻原有「只跑首輪」policy。

## Requirements

- 新增「Fixing ≠ Verifying」anti-pattern 到 `auto-loop.md` Prohibited Behaviors
- 新增「Skipping dual dispatch」anti-pattern
- 修改 loop policy：secondary 每輪都 dispatch（v1 無 skip exception）
- 新增 Cycle reset row：code edit 重置 review cycle
- 同步更新 SKILL.md Case B、review-common.md loop table、Dual Mode Loop Behavior section
- 優化 auto-loop.md 結構：critical items in top 12 lines

## Scope

| Scope | Description |
|-------|-------------|
| In | Rule text 修改、skill/command doc 更新、Correct Behavior dual example、old doc supersede |
| Out | Hook state 增強（v2）、hook matcher 追蹤 Task dispatch（v2）、auto-loop.md 拆分（blast radius） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `rules/auto-loop.md:5-12` | Modify | Add 2 Prohibited items |
| `rules/auto-loop.md:26-36` | Modify | Update Dual Review Mode table + add Cycle reset |
| `rules/auto-loop.md:80-88` | Modify | Add Correct Behavior dual example |
| `skills/codex-code-review/SKILL.md:112-116` | Modify | Update Case B |
| `skills/codex-code-review/SKILL.md:180-187` | Modify | Update Dual Mode Loop Behavior |
| `skills/codex-code-review/references/review-common.md:172-179` | Modify | Update loop table |
| `.claude/rules/auto-loop.md` | Sync | Sync installed copy |
| `docs/features/dual-reviewer/3-auto-loop-integration.md` | Modify | Mark superseded section |

## Acceptance Criteria

- [x] `auto-loop.md` Prohibited contains「Fixing ≠ Verifying」text
- [x] `auto-loop.md` Prohibited contains「Skipping dual dispatch」text
- [x] Dual Review Mode table has「Cycle reset」row
- [x] Loop re-review row says「re-dispatch both reviewers」not「Codex-only」
- [x] SKILL.md Case B says「Re-dispatch in parallel」
- [x] review-common.md loop table says「Re-dispatched every iteration」
- [x] SKILL.md Dual Mode Loop Behavior updated
- [x] Correct Behavior includes dual review example
- [x] `.claude/rules/auto-loop.md` synced with source (symlink — skip test in CI)
- [ ] Old feature doc section marked superseded
- [x] Pass `/codex-review-doc`
- [x] Pass `/precommit-fast`

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Feasibility | ✅ Done | `/best-practices` audit threadId: `019cfbb4-35de-7811-8afa-ec4cdc21aeb7` |
| Tech Spec | ✅ Done | `2-tech-spec.md` — Codex review ✅ Mergeable |
| Implementation | ✅ Done | 8 tasks (8S) — all completed. Commits: `d47bb91`, `b61fe15`, `fbca18b` |
| Testing | ✅ Done | 13 tests pass (dual-reviewer-loop.test.js). CI sync test skipped in fresh clone (symlink) — verified via `/seek-verdict` |
| Review | ✅ Done | `/codex-review-doc` ✅ Mergeable + `/precommit-fast` ✅ All Pass |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: threadId `019cfbb4-35de-7811-8afa-ec4cdc21aeb7`
- Related: [Dual Reviewer original spec](../../dual-reviewer/2-tech-spec.md)
- [5 Patterns for Rule Compliance](https://dev.to/docat0209/5-patterns-that-make-claude-code-actually-follow-your-rules-44dh)
