---
name: pr-review
description: "PR self-review — review changes, produce checklist, update rules"
allowed-tools: Bash(git:*), Read, Grep, Glob, Edit
---

# PR Self-Review

## Trigger

- Keywords: pr review, pre-pr, review before PR, self-review, pr-review

## When NOT to Use

- Code review by Codex (use `/codex-review-fast`)
- Document review (use `/codex-review-doc`)
- Risk assessment only (use `/risk-assess`)

## Workflow

1. Run `/risk-assess --mode fast` — if High+, auto-escalate to deep mode
2. Review: correctness, security, performance
3. PR checklist: tests, rollout, compatibility
4. Discover new rules -> update CLAUDE.md or `.claude/rules/`

## Output

```markdown
## Review Notes

- <findings>

## PR Checklist

- [ ] Risk assessment: Low/Medium (or High+ reviewed and acknowledged)
- [ ] Tests pass
- [ ] No breaking changes
- [ ] Docs updated

## Rules Update (if any)

- <proposed patch>
```
