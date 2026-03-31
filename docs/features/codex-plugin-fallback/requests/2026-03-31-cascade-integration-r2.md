# Cascade Integration for codex-plugin-cc

> **Created**: 2026-03-31
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [Tech Spec](../2-tech-spec.md) <- Section 3.3-3.4
> **Depends On**: [Output Adapter](./2026-03-31-output-adapter-r1.md)

## Background

將 codex-plugin-cc 整合為 `codex-code-review` degradation cascade 的 Priority 3 層。需修改 SKILL.md、review-common.md、command frontmatter。

## Requirements

- 擴展 `review-common.md` degradation matrix（新增 plugin-only scenario）
- 修改 `codex-code-review/SKILL.md` Step 3 cascade（新增 Priority 3: Skill dispatch）
- 新增 `Skill` 到 `allowed-tools` frontmatter（SKILL.md + 3 command variants）
- Runtime capability probing（30s timeout + catch failure）
- Integration test（mock L1-L3 失敗 → plugin fallback）

## Scope

| Scope | Description |
|-------|-------------|
| In | Cascade integration, allowed-tools update, runtime probing, integration test |
| Out | Output adapter（see r1）、plugin 安裝/維護、Review Gate hook |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/codex-code-review/SKILL.md` | Modify | 新增 Priority 3 plugin fallback |
| `skills/codex-code-review/references/review-common.md` | Modify | 擴展 degradation matrix + source attribution |
| `commands/codex-review-fast.md` | Modify | 新增 `Skill` to allowed-tools |
| `commands/codex-review.md` | Modify | 新增 `Skill` to allowed-tools |
| `commands/codex-review-branch.md` | Modify | 新增 `Skill` to allowed-tools |

## Acceptance Criteria

- [ ] `review-common.md` degradation matrix 包含 `plugin-only` scenario
- [ ] `SKILL.md` Step 3 cascade 有 Priority 3 (Skill dispatch)
- [ ] 3 個 command frontmatter 包含 `Skill` in allowed-tools
- [ ] Runtime probing 30s timeout + graceful fallback
- [ ] Hook 仲裁回歸測試（plugin hook 與 stop-guard.sh 共存）
- [ ] Pass /codex-review-fast
- [ ] Pass /precommit-fast

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | - | |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [codex-plugin-fallback](../2-tech-spec.md) Section 3.3-3.4
- Deep Research: codex-plugin-cc 可借鑑做法（2026-03-31）
