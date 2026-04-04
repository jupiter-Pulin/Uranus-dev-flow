---
name: simplify
description: "Wrap-up refactoring — simplify code, eliminate duplication, preserve behavior"
allowed-tools: Read, Grep, Glob, Edit, Bash(TEST_ENV=unit npx jest:*), Agent
---

# Code Simplification

## Trigger

- Keywords: simplify, clean up code, remove duplication, simplify code

## When NOT to Use

- New feature development (use `/feature-dev`)
- Document refactoring (use `/doc-refactor`)
- Full multi-target refactoring (use `/refactor`)

## Agent Dispatch

### Primary: Code Simplification

```
Agent({
  description: "Simplify code, eliminate duplication, preserve behavior",
  subagent_type: "code-simplifier",
  prompt: `Simplify the code at: $ARGUMENTS
Follow the task steps and constraints defined in this skill.`
})
```

### Secondary: Refactoring Risk Review

After simplification, dispatch risk assessment:

```
Agent({
  description: "Review refactoring risk and verify behavior preservation",
  subagent_type: "refactor-reviewer",
  prompt: `Review the refactoring changes just applied.
Check behavior preservation, dependency impact, test coverage, and rollback risk.`
})
```

## Task

For `$ARGUMENTS`:

1. **Run tests first** (establish baseline)
2. **Refactor**
   - Dead code removal
   - Extract duplicates (3+ repeats)
   - Simplify nesting (> 3 levels)
3. **Run tests again** (confirm nothing broken)

## Output

```markdown
## Refactoring Summary

- [file:line] <change>

## Test Results

✅/❌

## Next Steps

- <suggestions>
```

## Constraints

- ❌ Do not change business logic
- ❌ Do not add new features
