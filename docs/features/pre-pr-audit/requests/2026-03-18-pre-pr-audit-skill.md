# Request: Pre-PR Audit Skill

> **Created**: 2026-03-18
> **Status**: Pending
> **Priority**: P1
> **Tech Spec**: [2-tech-spec.md](../2-tech-spec.md)
> **Source**: `/best-practices` audit + `/codex-brainstorm` Nash Equilibrium (threadId: `019cff6f-2340-7b30-aec7-256b10a90f93`)

## Background

Auto-loop 確保 code review + precommit 通過，但缺少「PR 就緒」的量化評估。現有 `/pr-review` 是手動 checklist，`/risk-assess` 只看 blast radius。開發者需要一個聚合型 skill，在 commit/push/PR 前給出量化信心指數（0-100），涵蓋 test quality、coverage、risk alignment、AC traceability。

此 skill 是 pre-deploy 終極驗證（vs `/feature-verify` = post-deploy runtime 驗證）。

## Requirements

- 建立 `/pre-pr-audit` skill，orchestrate 現有 skills（`/risk-assess`、`/codex-test-review`、`/check-coverage`）
- 5 維度評分：Execution Integrity (25%)、Coverage Adequacy (25%)、Test Quality (20%)、Risk-to-Test Alignment (20%)、Evidence Governance (10%)
- 信心指數 0-100，3-tier gate（✅ PR-Ready >=85、⚠️ PR-Caution 60-84、⛔ PR-Blocked <60）
- Hard-fail overrides（precommit stale、policy breach、evidence stale、critical untested）
- `--mode fast|deep`、`--strict`、`--json` 參數
- User-invoked only（不在 auto-loop 中）

## Scope

| Scope | Description |
|-------|-------------|
| In | SKILL.md + command + references (scoring-model, output-template) + CLAUDE.md update + tests |
| Out | Hook enforcement (v2)、per-project weight config (v2)、calibration set (v2)、ecosystem adapters (v2) |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `skills/pre-pr-audit/SKILL.md` | New | Skill definition (orchestrator + scoring) |
| `skills/pre-pr-audit/references/scoring-model.md` | New | Scoring formula + weights |
| `skills/pre-pr-audit/references/output-template.md` | New | Report template |
| `commands/pre-pr-audit.md` | New | Command wrapper |
| `CLAUDE.md` | Modify | Add to Command Quick Reference |
| `test/commands/pre-pr-audit.test.js` | New | Content assertions |

## Acceptance Criteria

- [ ] SKILL.md contains 5 dimensions with weights
- [ ] SKILL.md contains scoring model (pass/partial/fail/N/A)
- [ ] SKILL.md contains 3-tier gate (PR-Ready/PR-Caution/PR-Blocked)
- [ ] SKILL.md contains hard-fail overrides
- [ ] SKILL.md contains fast/deep modes
- [ ] Command supports `--mode`, `--strict`, `--json` args
- [ ] CLAUDE.md has `/pre-pr-audit` in Command Quick Reference
- [ ] Tests pass
- [ ] `/codex-review-doc` pass

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Best Practices | ✅ Done | Test quality metrics + confidence scoring research |
| Brainstorm | ✅ Done | Nash Equilibrium (3 rounds, threadId: `019cff6f-2340-7b30-aec7-256b10a90f93`) |
| Tech Spec | ✅ Done | `2-tech-spec.md` |
| Implementation | Pending | 10 tasks (7S + 2M + 1S verify) |
| Testing | Pending | Content assertions + manual session test |
| Review | Pending | `/codex-review-doc` |

## References

- Tech Spec: [2-tech-spec.md](../2-tech-spec.md)
- Brainstorm threadId: `019cff6f-2340-7b30-aec7-256b10a90f93`
- Industry: [Qodo Metrics](https://www.qodo.ai/blog/software-testing-metrics/), [Mutation Testing Guide](https://mastersoftwaretesting.com/testing-fundamentals/types-of-testing/mutation-testing), [Tricentis 64 Metrics](https://www.tricentis.com/blog/64-essential-testing-metrics-for-measuring-quality-assurance-success)
- Related: [testing-rules-enrichment](../../testing-rules-enrichment/2-tech-spec.md) (evidence model), [feature-verify](../../feature-verify-v2/) (post-deploy complement)
