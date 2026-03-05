# Git Profile Manager Skill

> **Created**: 2026-03-05
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

多專案、多組織開發者在不同 repo 使用不同 git identity 和 GPG signing key，目前無自動化切換機制，手動 `git config --local` 設定 DX 差且容易出錯。

## Requirements

- 自動從 GPG secret keys + git config 推導候選 profiles
- One-command profile switching（`/git-profile use <name>`）
- GPG key health check（有效期、email match、signing 狀態）
- Profile registry 持久化（`~/.config/sd0x-dev-flow/git-profiles.json`）
- Shared diagnostic script 供 `/smart-commit` pre-flight 呼叫
- Safe config writes（AskUserQuestion + plan-hash + backup）

## Scope

| Scope | Description |
|-------|-------------|
| In | `doctor` / `list` / `use` / `remove` / `verify` subcommands, local config writes, GPG local health check, worktree detection + warning |
| Out | `includeIf` global install, per-worktree writes, GitHub key upload verification (`--deep`), CI/CD enforcement (v2) |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/git-profile/SKILL.md` | New | Skill definition |
| `skills/git-profile/scripts/git-profile.sh` | New | Diagnostic + profile management script |
| `commands/git-profile.md` | New | Command entry point |
| `skills/smart-commit/SKILL.md` | Modify | Step 1c delegate to shared diagnostic |
| `test/scripts/git-profile.test.js` | New | Tests |

## Acceptance Criteria

- [ ] `/git-profile` (doctor) 顯示完整 identity + signing + worktree 診斷
- [ ] Auto-discovery 從 GPG secret keys + git config 推導候選 profiles
- [ ] `/git-profile list` 顯示 registry profiles + 當前 match
- [ ] `/git-profile use <profile>` 切換 local config（AskUserQuestion + plan-hash）
- [ ] `/git-profile remove` 移除 profile（referential integrity check）
- [ ] `/git-profile verify` 檢查 GPG key 有效期 + email match
- [ ] Registry 持久化於 `~/.config/sd0x-dev-flow/git-profiles.json`（atomic write + 0600）
- [ ] Shared diagnostic script 可被 `/smart-commit` 呼叫（degradation: infra failure → warn-only）
- [ ] Tests 覆蓋 doctor / list / use / remove / verify / registry（happy + error + edge cases）
- [ ] Pass `/codex-review-fast`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Best Practices | Done | Brainstorm `019cbe4d` |
| Tech Spec | Done | Reviewed + Mergeable (`019cbe5a`) |
| Development | - | |
| Testing | - | |
| Review | - | |
| Acceptance | - | |

## References

- [Tech Spec](../2-tech-spec.md)
- Best Practices Audit: Codex Brainstorm `019cbe4d-1698-75c1-9d16-55866a79be8c`
- Doc Review: `019cbe5a-0b5e-7b51-924e-fb432dbb386f`
