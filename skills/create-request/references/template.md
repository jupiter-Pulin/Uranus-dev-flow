# Create Request Template

## Request Document Template

```markdown
# {Title}

> **Created**: {YYYY-MM-DD}
> **Status**: Pending
> **Priority**: {P0|P1|P2}
> **Tech Spec**: [Link](../planning/xxx.md) <- See spec for details

## Background

{1-2 sentences describing the problem and context}

## Requirements

- {Requirement 1}
- {Requirement 2}

## Scope

| Scope | Description                        |
| ----- | ---------------------------------- |
| In    | {Items handled in this request}    |
| Out   | {Items not handled, separate request} |

## Related Files

| File                 | Action | Description          |
| -------------------- | ------ | -------------------- |
| `src/service/xxx.ts` | Modify | {Brief change description} |
| `src/entity/xxx.ts`  | New    | {Brief purpose}      |

## Acceptance Criteria

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] Unit test coverage > 80%
- [ ] Pass /codex-review-fast

## Progress

| Phase      | Status | Note |
| ---------- | ------ | ---- |
| Analysis   | -      |      |
| Development | -     |      |
| Testing    | -      |      |
| Acceptance | -      |      |

**Status**: Not Started / In Progress / Done / Blocked

## References

- Tech Spec: [xxx](../planning/xxx.md)
- Related Request: [yyy](./yyy.md)
```

## Naming Convention

**Format**: `YYYY-MM-DD-kebab-case-title.md`

```
2026-01-23-api-performance-optimization.md   OK
2026-01-23-api-cache-ttl.md     OK
api-optimization.md                         Missing date
2026-01-23-API_Optimization.md              Wrong case
```

## File Location

```
docs/features/{feature}/requests/YYYY-MM-DD-title.md
```

## Priority & Status

| Priority | Description | Timeline    |
| -------- | ----------- | ----------- |
| P0       | Critical    | Immediate   |
| P1       | High        | This week   |
| P2       | Medium      | This sprint |

| Status         | Description      |
| -------------- | ---------------- |
| Pending        | Not started      |
| In Development | Work in progress |
| Completed      | Done             |

## Writing Guidelines

| Principle           | Description                                          |
| ------------------- | ---------------------------------------------------- |
| Concise             | Background 1-2 sentences, requirements as lists      |
| Reference, don't inline | Pseudocode/spec details go in Tech Spec, request only links |
| Track progress      | Progress section marks each phase status             |
| Clear scope         | Scope section defines "what to do" and "what not to do" |
| Verifiable          | Acceptance Criteria use checkboxes for verification  |

## Granularity Guide

| Metric | Target | Action if exceeded |
|--------|--------|--------------------|
| Acceptance Criteria | ≤ 8 per request | Consider splitting by layer or functional area |
| Related Files layers | 1 concern layer | Split behavior-layer (.md rules/skills) from code-layer (.sh/.js hooks/scripts) |
| Estimated effort | ≤ 3 days | Split by deliverable |

Quality-gate ACs matching `Pass /<review-or-precommit-command>` don't count toward the ≤8 target. Canonical list: `/codex-review-fast`, `/codex-review-doc`, `/codex-review`, `/precommit`, `/precommit-fast`, `/pr-review`.

## Dependencies (conditional)

Add to request header metadata when splitting creates dependencies between sibling requests:

```markdown
> **Depends On**: [Request Title](./YYYY-MM-DD-xxx.md)
```

Place after `> **Tech Spec**:` line. Only include when this request requires another to complete first.
