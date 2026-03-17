# Request: Add Granularity Assessment to /create-request

> **Created**: 2026-03-17
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

81.4% 的現有 request 超過 8 AC（avg 13.81），經常混合 behavior-layer 和 code-layer 變更。`/create-request` 缺乏顆粒度判斷，被動填表不會 challenge scope。`/best-practices` audit 確認需要 advisory split suggestion。

## Requirements

- 新增 Phase 1.5 two-pass Granularity Check（1.5a pre-Explore + 1.5b post-Explore）
- 3 primary signals：AC count >8、layer mixing、scope breadth
- 2 secondary signals：WBS groups、effort
- Advisory split via AskUserQuestion（使用者決定）
- Flat sibling requests + conditional `Depends On` header metadata
- Template granularity guide
- Add `AskUserQuestion` to allowed-tools

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md Phase 1.5、template guide + Depends On、command spec update、tests、allowed-tools |
| Out | Auto-split（advisory only）、parent/child hierarchy、WBS auto-parsing、retroactive fix of 43 existing requests |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/create-request/SKILL.md` | Modify | Add Phase 1.5 + AskUserQuestion to allowed-tools |
| `skills/create-request/references/template.md` | Modify | Add granularity guide + Depends On field |
| `commands/create-request.md` | Modify | Update workflow + AskUserQuestion to allowed-tools |
| `test/commands/create-request-granularity.test.js` | New | Signal detection + template tests |

## Acceptance Criteria

- [ ] SKILL.md has Phase 1.5a (quick) and Phase 1.5b (refined) granularity check
- [ ] AC count signal excludes canonical 6 quality-gate commands
- [ ] Layer mixing detection has pre-Explore keyword fallback + post-Explore file analysis
- [ ] Decision logic triggers at `signal_count >= 2`
- [ ] AskUserQuestion in both SKILL.md and command allowed-tools
- [ ] Template has granularity guide (≤8 AC target, layer, effort)
- [ ] Template has `Depends On` header metadata field
- [ ] Tests pass
- [ ] Pass `/codex-review-doc`
- [ ] Pass `/precommit-fast`

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Feasibility | ✅ Done | `/best-practices` audit threadId: `019cfbde-68be-71b1-889a-135b19b4b69f` |
| Tech Spec | ✅ Done | `2-tech-spec.md` — Codex review ✅ Mergeable |
| Implementation | ✅ Done | 6/6 tasks: Phase 1.5 in SKILL.md, granularity guide + Depends On in template, command spec, AskUserQuestion allowed-tools, 9 tests |
| Testing | ✅ Done | 139 tests pass (130 existing + 9 granularity) |
| Review | ✅ Done | `/precommit-fast` ✅ All Pass. Commit: `b013b0e` |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Audit: threadId `019cfbde-68be-71b1-889a-135b19b4b69f`
