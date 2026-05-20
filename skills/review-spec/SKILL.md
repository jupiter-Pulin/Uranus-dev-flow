---
name: review-spec
description: "Review technical spec documents across completeness, feasibility, concision, risk, code consistency, and test strategy."
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(node:*), Agent
---

# Review Spec

## Trigger

- Keywords: review spec, spec review, tech spec review, review-spec

## When NOT to Use

- Code review (use `/codex-review-fast`)
- Document review (use `/codex-review-doc`)
- Writing a new spec (use `/tech-spec`)

## Agent Dispatch

```
Agent({
  description: "Review technical spec for completeness, feasibility, concision, risk, code consistency, and test strategy",
  subagent_type: "tech-spec-reviewer",
  prompt: `Review the following technical spec document.
Follow the review dimensions and output format defined in this skill.`
})
```

## Task

### Document to Review

```
$ARGUMENTS
```

### Review Flow

| Step | Focus |
|------|-------|
| 1 | Read the technical spec |
| 2 | Research related code |
| 3 | Completeness check |
| 4 | Feasibility assessment |
| 5 | **Concision check** (see `@skills/tech-spec/references/template.md` Review Dimensions + Anti-Patterns table) |
| 6 | Risk review |
| 7 | Code consistency |
| 8 | Test strategy |

## Output

```markdown
# Technical Spec Review Report

**Reviewed Document**: `$ARGUMENTS`

## Review Summary
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Completeness | ⭐⭐⭐⭐☆ | |
| Feasibility | ⭐⭐⭐☆☆ | |
| **Concision** | ⭐⭐⭐⭐☆ | line count, section count, anti-pattern hits |
| Risk Assessment | ⭐⭐⭐⭐☆ | |
| Code Consistency | ⭐⭐⭐⭐⭐ | |
| Test Strategy | ⭐⭐⭐☆☆ | |

## Overall Verdict
✅ Approved / ⚠️ Needs revision / ❌ Needs redesign

## Strengths
-

## Issues & Recommendations
### 🔴 Must Fix (Blocker)
### 🟡 Suggested Changes
### 🟢 Optional Improvements
```
