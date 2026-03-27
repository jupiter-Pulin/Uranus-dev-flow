# /create-request AC Verification Enhancement

> **Created**: 2026-03-27
> **Status**: Pending
> **Priority**: P2
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)

## Background

`/create-request --update` 使用 git log 偵測進度，false positive rate ~20-30%（commit ≠ AC done）。`--update-all` 批次標記 request 為 Completed 時可能包含 stub implementations，造成 data integrity 問題。經 best practices audit + adversarial debate（threadId: `019d2d1c-ec19-7743-aa5c-72d5259303ad`），共識為 hybrid approach：fast default + opt-in closure-grade verification。

## Requirements

- 新增 `--verify-ac` flag，dispatch single Explore agent 驗證 AC（含 file:line evidence）
- 新增 `Candidate Complete` 中間狀態，區分 heuristic-only vs verified completion
- 更新 scan mode（`--status`）支援 Candidate Complete 分組
- 複用現有 AC parsing pattern（codex-code-review Step 1.5）
- 保持 default path <10 sec（不影響 auto-trigger）

## Scope

| Scope | Description |
|-------|-------------|
| In | `--verify-ac` flag + agent dispatch + Candidate Complete status + scan update |
| Out | Multi-wave deep-explore integration, AC parser centralization (separate P2 follow-up) |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/create-request/SKILL.md` | Modify | Add --verify-ac, Phase 2.5 agent, Candidate Complete lifecycle |
| `commands/create-request.md` | Modify | Add --verify-ac argument-hint |
| `test/commands/create-request.test.js` | New/Modify | Test --verify-ac argument + Candidate Complete + scan grouping |

## Acceptance Criteria

- [ ] AC1: `--verify-ac` flag documented in SKILL.md arguments table
- [ ] AC2: Phase 2.5 agent dispatch spec with AC list + Related Files input
- [ ] AC3: Agent output format follows AC Coverage schema（Complete/Partial/Not Found/Inconclusive）
- [ ] AC4: Timeout 60 sec + Inconclusive fallback documented
- [ ] AC5: `Candidate Complete` status in lifecycle table（Phase 4 Auto-Update）
- [ ] AC6: Scan mode（`--status`）groups Candidate Complete after In Progress
- [ ] AC7: `--update-all` marks heuristic-only completions as Candidate Complete（not Completed）
- [ ] Pass `/codex-review-doc`

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Best practices audit + debate completed |
| Development | - | |
| Testing | - | |
| Acceptance | - | |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Best Practices Debate: threadId `019d2d1c-ec19-7743-aa5c-72d5259303ad`
- AC Infrastructure: `skills/codex-code-review/SKILL.md` Step 1.5
