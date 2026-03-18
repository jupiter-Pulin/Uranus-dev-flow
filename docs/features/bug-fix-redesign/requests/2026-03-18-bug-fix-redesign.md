# Request: Bug-Fix Skill Redesign

> **Created**: 2026-03-18
> **Status**: Completed
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Source**: `/best-practices` audit + `/codex-brainstorm` Nash Equilibrium (threadId: `019cff9f-8946-78c0-8c7e-9d3edf594530`)

## Background

`/bug-fix` skill 缺少 `/feature-dev` 修正後的多項安全機制。具體問題：無 git 禁止區塊（allowed-tools 含 `Bash(git:*)` 允許 `git commit`）、`/codex-test-review` 非 mandatory、無 freshness rule、`testing-guide.md` hardcoded TypeScript/Jest、command 與 skill review workflow 不一致。這與修正前的 `/feature-dev` 問題模式相同。

## Requirements

- 加入 Prohibited Actions 區塊（`❌ git add | git commit | git push`）
- `allowed-tools` 從 `Bash(git:*), Bash(yarn:*), Bash(gh:*)` 改為 `Bash`
- `/codex-test-review` 改為 mandatory step（含 gap closure routing）
- 加入 freshness rule（code edit after test review → rerun）
- Migrate bug-type matrix（含 cross-service row）into SKILL.md
- 引用 `@rules/testing.md` + `@rules/testing-project.md`
- 刪除 `testing-guide.md`
- 對齊 `commands/bug-fix.md`
- 加入 auto-loop Doc Sync pointer

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md rewrite、command update、testing-guide.md deletion、test assertions |
| Out | Emergency hotfix bypass flow (follow existing testing.md exception model) |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/bug-fix/SKILL.md` | Rewrite | Add Prohibited + mandatory test review + freshness + matrix + pointer |
| `skills/bug-fix/references/testing-guide.md` | Delete | After matrix migration |
| `commands/bug-fix.md` | Update | allowed-tools + review workflow + remove testing-guide ref |
| `test/commands/bug-fix.test.js` | Create/Update | Content assertions |

## Acceptance Criteria

- [x] SKILL.md contains `❌ git add | git commit | git push` Prohibited block
- [x] SKILL.md `allowed-tools` is `Bash` (not `Bash(git:*)`)
- [x] SKILL.md has mandatory `/codex-test-review` step with gap closure
- [x] SKILL.md has freshness rule
- [x] SKILL.md references `@rules/testing.md`
- [x] SKILL.md has bug-type matrix including cross-service row
- [x] SKILL.md has auto-loop Doc Sync pointer
- [x] Verification checklist includes "No git add/commit/push executed"
- [x] `commands/bug-fix.md` `allowed-tools` is `Bash`
- [x] `commands/bug-fix.md` review workflow includes `/codex-test-review`
- [x] `commands/bug-fix.md` does not reference `testing-guide.md`
- [x] `testing-guide.md` does not exist
- [x] `/codex-review-doc` pass
- [x] `/precommit-fast` pass

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Tech Spec | ✅ Done | `docs/features/bug-fix-redesign/2-tech-spec.md` |
| Development | ✅ Done | `625715a` + `92ec7e4` |
| Testing | ✅ Done | 14/14 tests pass |
| Verification | ✅ Done | Review + precommit pass, CI ✅ |
